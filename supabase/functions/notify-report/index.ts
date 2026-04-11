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

    // Verify caller is authenticated (reporter must be logged in)
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user: reporterUser } } = await supabase.auth.getUser(jwt ?? '')
    if (!reporterUser) {
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

    if (!listing) throw new Error('Listing not found')

    // Get seller email
    const { data: { user: sellerUser } } = await supabase.auth.admin.getUserById(listing.seller_id)
    if (!sellerUser?.email) throw new Error('Seller email not found')

    // Insert in-app notification (neutral — no reporter identity or reason)
    await supabase.from('notifications').insert({
      user_id: listing.seller_id,
      type: 'report',
      listing_id: listing.id,
      message: `Your listing was flagged for review`,
      metadata: {},
      read: false,
    })

    // Build neutral email — no reporter identity or reason disclosed
    const html = buildEmail({
      heading: `Your listing has been flagged for review`,
      bodyHtml: `
        <p>Your listing <strong>"${listing.title}"</strong> has been flagged for review by another UMarket user.</p>
        <p>Our team will look into it within 24&ndash;48 hours. If your listing complies with our community guidelines, no action will be taken.</p>
        <p>If you have questions, reply to this email or contact us at <a href="mailto:umarket.jr@gmail.com" style="color:#CC0000;">umarket.jr@gmail.com</a>.</p>
      `,
      ctaLabel: 'View Your Listing',
    })

    await sendEmail({
      to: sellerUser.email,
      subject: `Your listing "${listing.title}" is under review`,
      html,
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[notify-report]', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
