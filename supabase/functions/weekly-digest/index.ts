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

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const results: { userId: string; email: string; sent: boolean }[] = []

    // Get all users with active (not sold) listings
    const { data: sellers } = await supabase
      .from('listings')
      .select('seller_id')
      .eq('sold', false)

    if (!sellers?.length) {
      return new Response(JSON.stringify({ ok: true, message: 'No active sellers' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const uniqueSellerIds = [...new Set(sellers.map((s) => s.seller_id))]

    for (const sellerId of uniqueSellerIds) {
      try {
        // Get this seller's active listing IDs
        const { data: sellerListings } = await supabase
          .from('listings')
          .select('id, title')
          .eq('seller_id', sellerId)
          .eq('sold', false)

        if (!sellerListings?.length) continue

        const listingIds = sellerListings.map((l) => l.id)

        // Count views this week
        const { count: viewCount } = await supabase
          .from('listing_views')
          .select('*', { count: 'exact', head: true })
          .in('listing_id', listingIds)
          .gte('viewed_at', weekAgo)

        // Count saves this week
        const { count: saveCount } = await supabase
          .from('favorites')
          .select('*', { count: 'exact', head: true })
          .in('listing_id', listingIds)
          .gte('created_at', weekAgo)

        // Count interest requests this week
        const { count: interestCount } = await supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', sellerId)
          .eq('type', 'interest')
          .gte('created_at', weekAgo)

        const totalActivity = (viewCount ?? 0) + (saveCount ?? 0) + (interestCount ?? 0)

        // Skip users with zero activity this week
        if (totalActivity === 0) continue

        // Get seller email
        const { data: { user: sellerUser } } = await supabase.auth.admin.getUserById(sellerId)
        if (!sellerUser?.email) continue

        const listingCount = sellerListings.length
        const topListing = sellerListings[0]

        const html = buildEmail({
          heading: `Your weekly UMarket summary`,
          bodyHtml: `
            <p>Here's how your listing${listingCount > 1 ? 's' : ''} performed this week:</p>
            <table style="margin:16px 0;border:1px solid #eee;border-radius:10px;overflow:hidden;width:100%;border-collapse:collapse;font-size:14px;">
              <tr style="background:#f9f9f9;">
                <td style="padding:12px 16px;color:#888;">Profile views</td>
                <td style="padding:12px 16px;font-size:22px;font-weight:800;color:#111;text-align:right;">${viewCount ?? 0}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#888;border-top:1px solid #eee;">Times saved (&#9825;)</td>
                <td style="padding:12px 16px;font-size:22px;font-weight:800;color:#CC0000;text-align:right;border-top:1px solid #eee;">${saveCount ?? 0}</td>
              </tr>
              <tr style="background:#f9f9f9;">
                <td style="padding:12px 16px;color:#888;border-top:1px solid #eee;">Interest requests</td>
                <td style="padding:12px 16px;font-size:22px;font-weight:800;color:#111;text-align:right;border-top:1px solid #eee;">${interestCount ?? 0}</td>
              </tr>
              <tr>
                <td style="padding:12px 16px;color:#888;border-top:1px solid #eee;">Active listings</td>
                <td style="padding:12px 16px;font-weight:600;color:#111;text-align:right;border-top:1px solid #eee;">${listingCount}</td>
              </tr>
            </table>
            ${(interestCount ?? 0) > 0
              ? `<p style="background:#fff8f8;border:1px solid #fce8e8;border-radius:8px;padding:12px 14px;font-size:13px;color:#c00;">
                  You have <strong>${interestCount} new interest request${(interestCount ?? 0) > 1 ? 's' : ''}</strong> this week. Check your Notifications tab to see buyer contact info.
                </p>`
              : ''}
            <p style="color:#666;font-size:13px;">Top listing: <strong>${topListing.title}</strong></p>
          `,
          ctaLabel: 'View Your Profile',
        })

        await sendEmail({
          to: sellerUser.email,
          subject: `Your UMarket weekly summary — ${viewCount ?? 0} views, ${saveCount ?? 0} saves`,
          html,
        })

        results.push({ userId: sellerId, email: sellerUser.email, sent: true })
      } catch (sellerErr) {
        console.error(`[weekly-digest] Failed for seller ${sellerId}:`, sellerErr)
        results.push({ userId: sellerId, email: '', sent: false })
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: results.filter((r) => r.sent).length, total: uniqueSellerIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[weekly-digest]', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
