import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildEmail, sendEmail, corsHeaders } from '../_shared/email.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { listing_id } = await req.json()

    // Verify caller
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user: saverUser } } = await supabase.auth.getUser(jwt ?? '')
    if (!saverUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get listing + seller
    const { data: listing } = await supabase
      .from('listings')
      .select('id, title, seller_id')
      .eq('id', listing_id)
      .single()

    // Skip if listing not found or user saved their own listing
    if (!listing || listing.seller_id === saverUser.id) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Count total saves
    const { count: saveCount } = await supabase
      .from('favorites')
      .select('*', { count: 'exact', head: true })
      .eq('listing_id', listing_id)

    // Get seller email
    const { data: { user: sellerUser } } = await supabase.auth.admin.getUserById(listing.seller_id)
    if (!sellerUser?.email) throw new Error('Seller email not found')

    // Insert in-app notification
    await supabase.from('notifications').insert({
      user_id: listing.seller_id,
      type: 'saved',
      listing_id: listing.id,
      message: `Someone saved your listing`,
      metadata: { save_count: saveCount ?? 1 },
      read: false,
    })

    // Build email
    const saveLine = saveCount && saveCount > 1
      ? `<p style="color:#666;">Total saves on this listing: <strong>${saveCount}</strong></p>`
      : ''

    const html = buildEmail({
      heading: `Your listing was saved!`,
      bodyHtml: `
        <p>Someone just saved <strong>"${listing.title}"</strong> to their favorites on UMarket.</p>
        ${saveLine}
        <p>They may reach out soon &mdash; make sure your contact info is up to date on your profile.</p>
      `,
      ctaLabel: 'View Your Listing',
    })

    await sendEmail({
      to: sellerUser.email,
      subject: `"${listing.title}" was saved on UMarket`,
      html,
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[notify-saved]', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
