import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = { 'Access-Control-Allow-Origin': '*' }
const MONTHS_OLD = 8
const VIEW_RETENTION_DAYS = 45
const SOLD_DELETE_DAYS = 3

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

  // ── Helper: delete images + listing rows for a given filter ───────────────
  async function deleteListingsWithImages(
    listings: { id: string; images: string[] }[]
  ): Promise<{ storageDeleted: number; rowsDeleted: number }> {
    if (!listings.length) return { storageDeleted: 0, rowsDeleted: 0 }

    // Collect storage paths
    const storagePaths = listings
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
      const BATCH = 1000
      for (let i = 0; i < storagePaths.length; i += BATCH) {
        const { data } = await supabase.storage
          .from('listing-images')
          .remove(storagePaths.slice(i, i + BATCH))
        storageDeleted += data?.length ?? 0
      }
    }

    const ids = listings.map((l) => l.id)
    const { count } = await supabase
      .from('listings')
      .delete({ count: 'exact' })
      .in('id', ids)

    return { storageDeleted, rowsDeleted: count ?? 0 }
  }

  // ── 1. Delete listings older than 8 months ────────────────────────────────
  const ageCutoff = new Date()
  ageCutoff.setMonth(ageCutoff.getMonth() - MONTHS_OLD)

  const { data: oldListings } = await supabase
    .from('listings')
    .select('id, images')
    .lt('created_at', ageCutoff.toISOString())

  const { storageDeleted: oldStorage, rowsDeleted: oldRows } =
    await deleteListingsWithImages(oldListings ?? [])

  // ── 2. Delete sold listings older than 3 days ─────────────────────────────
  const soldCutoff = new Date()
  soldCutoff.setDate(soldCutoff.getDate() - SOLD_DELETE_DAYS)

  const { data: soldListings } = await supabase
    .from('listings')
    .select('id, images')
    .eq('sold', true)
    .lt('sold_at', soldCutoff.toISOString())

  const { storageDeleted: soldStorage, rowsDeleted: soldRows } =
    await deleteListingsWithImages(soldListings ?? [])

  // ── 3. Delete listing_views older than 45 days ────────────────────────────
  const viewCutoff = new Date()
  viewCutoff.setDate(viewCutoff.getDate() - VIEW_RETENTION_DAYS)
  const { count: viewsDeleted } = await supabase
    .from('listing_views')
    .delete({ count: 'exact' })
    .lt('viewed_at', viewCutoff.toISOString())

  console.log(
    `[cleanup] Old: ${oldRows} listings, ${oldStorage} images | ` +
    `Sold: ${soldRows} listings, ${soldStorage} images | ` +
    `Views: ${viewsDeleted}`
  )

  return new Response(
    JSON.stringify({
      ok: true,
      oldListingsDeleted: oldRows,
      soldListingsDeleted: soldRows,
      storageFilesDeleted: oldStorage + soldStorage,
      viewsDeleted: viewsDeleted ?? 0,
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
