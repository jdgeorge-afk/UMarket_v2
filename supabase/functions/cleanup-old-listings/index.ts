import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*' }
const MONTHS_OLD = 8
const VIEW_RETENTION_DAYS = 45

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Only allow calls with the service role key (invoked by pg_cron, not public users)
  const auth = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    serviceKey,
  )

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - MONTHS_OLD)
  const cutoffISO = cutoff.toISOString()

  // 1. Fetch old listings so we can pull their image URLs before deleting
  const { data: oldListings, error: fetchErr } = await supabase
    .from('listings')
    .select('id, images')
    .lt('created_at', cutoffISO)

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // 2. Collect all storage paths and delete them from the listing-images bucket
  const storagePaths = (oldListings ?? [])
    .flatMap((l) =>
      (l.images ?? []).map((url: string) => {
        const marker = '/listing-images/'
        const idx = url.indexOf(marker)
        return idx === -1 ? null : decodeURIComponent(url.slice(idx + marker.length))
      })
    )
    .filter(Boolean) as string[]

  let storageDeleted = 0
  if (storagePaths.length > 0) {
    // Supabase Storage remove() accepts up to 1000 paths per call
    const BATCH = 1000
    for (let i = 0; i < storagePaths.length; i += BATCH) {
      const { data } = await supabase.storage
        .from('listing-images')
        .remove(storagePaths.slice(i, i + BATCH))
      storageDeleted += data?.length ?? 0
    }
  }

  // 3. Delete the listing rows — FK cascades clean up favorites, reports, views, etc.
  const { error: deleteErr, count } = await supabase
    .from('listings')
    .delete({ count: 'exact' })
    .lt('created_at', cutoffISO)

  if (deleteErr) {
    return new Response(JSON.stringify({ error: deleteErr.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }

  // 4. Delete listing_views older than 45 days
  const viewCutoff = new Date()
  viewCutoff.setDate(viewCutoff.getDate() - VIEW_RETENTION_DAYS)
  const { count: viewsDeleted } = await supabase
    .from('listing_views')
    .delete({ count: 'exact' })
    .lt('viewed_at', viewCutoff.toISOString())

  console.log(`[cleanup] Deleted ${count} listings, ${storageDeleted} images, ${viewsDeleted} old views`)

  return new Response(
    JSON.stringify({
      ok: true,
      listingsDeleted: count,
      storageFilesDeleted: storageDeleted,
      viewsDeleted: viewsDeleted ?? 0,
      cutoff: cutoffISO,
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
