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

    const { listing_id, buyer_name, buyer_contact_type, buyer_contact_value } = await req.json()

    // Verify caller is authenticated
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user: buyerUser } } = await supabase.auth.getUser(jwt ?? '')
    if (!buyerUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get listing
    const { data: listing } = await supabase
      .from('listings')
      .select('id, title, seller_id')
      .eq('id', listing_id)
      .single()

    if (!listing) throw new Error('Listing not found')

    // Don't notify sellers of interest in their own listing
    if (listing.seller_id === buyerUser.id) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get seller's email via admin API
    const { data: { user: sellerUser } } = await supabase.auth.admin.getUserById(listing.seller_id)
    if (!sellerUser?.email) throw new Error('Seller email not found')

    const date = new Date().toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
    const contactLabel = { phone: 'Phone', email: 'Email', instagram: 'Instagram', snapchat: 'Snapchat' }[buyer_contact_type as string] ?? 'Contact'

    // Insert in-app notification
    await supabase.from('notifications').insert({
      user_id: listing.seller_id,
      type: 'interest',
      listing_id: listing.id,
      buyer_id: buyerUser.id,
      message: `${buyer_name} is interested in your listing`,
      metadata: { buyer_name, buyer_contact_type, buyer_contact_value },
      read: false,
    })

    // Build email
    const html = buildEmail({
      heading: `Someone is interested in "${listing.title}"`,
      bodyHtml: `
        <p>Good news! <strong>${buyer_name}</strong> wants to connect about your listing.</p>
        <table style="margin:16px 0;border:1px solid #eee;border-radius:10px;overflow:hidden;width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="background:#f9f9f9;">
            <td style="padding:10px 14px;color:#888;width:38%;">Listing</td>
            <td style="padding:10px 14px;font-weight:600;color:#111;">${listing.title}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#888;border-top:1px solid #eee;">Their Name</td>
            <td style="padding:10px 14px;font-weight:600;color:#111;border-top:1px solid #eee;">${buyer_name}</td>
          </tr>
          <tr style="background:#f9f9f9;">
            <td style="padding:10px 14px;color:#888;border-top:1px solid #eee;">${contactLabel}</td>
            <td style="padding:10px 14px;font-weight:700;color:#CC0000;border-top:1px solid #eee;">${buyer_contact_value}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:#888;border-top:1px solid #eee;">Date</td>
            <td style="padding:10px 14px;color:#666;border-top:1px solid #eee;">${date}</td>
          </tr>
        </table>
        <p>Reach out to them directly using the contact info above. Good luck with the sale!</p>
      `,
      ctaLabel: 'View Your Listing',
    })

    await sendEmail({
      to: sellerUser.email,
      subject: `${buyer_name} is interested in "${listing.title}"`,
      html,
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[notify-interest]', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
