import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APP_URL  = 'https://u-market.app'
const FROM     = 'UMarket <notifications@u-market.app>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Email builder ─────────────────────────────────────────────────────────────

function buildEmail(heading: string, bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
        <tr>
          <td style="padding:24px 28px 16px;border-bottom:1px solid #f0f0f0;">
            <span style="font-size:22px;font-weight:900;color:#CC0000;letter-spacing:-0.5px;">UMarket&#8482;</span>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 8px;">
            <h1 style="margin:0 0 14px;font-size:17px;font-weight:700;color:#111;">${heading}</h1>
            <div style="font-size:14px;color:#444;line-height:1.65;">${bodyHtml}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 28px 28px;">
            <a href="${ctaUrl}" style="display:inline-block;background:#CC0000;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">${ctaLabel} &rarr;</a>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px;background:#fafafa;border-top:1px solid #f0f0f0;">
            <p style="margin:0;font-size:11px;color:#aaa;line-height:1.6;">
              UMarket&#8482; &mdash; The College Student Marketplace.<br>
              You are receiving this because you have an active listing.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('[sell-prompt] RESEND_API_KEY not set — skipping send')
    return { ok: true, skipped: true }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error('[sell-prompt] Resend error:', res.status, body)
    return { ok: false, error: body }
  }
  return { ok: true }
}

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret) return true
  return req.headers.get('Authorization') === `Bearer ${secret}`
}

// ── Main ──────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: candidates, error: qErr } = await supabase.rpc('get_sell_prompt_candidates')
  if (qErr) {
    console.error('[sell-prompt] RPC error:', qErr)
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!candidates?.length) {
    return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No candidates' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let sent = 0, failed = 0

  for (const row of candidates as Array<{
    listing_id: string; seller_id: string; title: string
    contact_count: number; price: number | null; is_housing: boolean
  }>) {
    try {
      const { data: { user: seller } } = await supabase.auth.admin.getUserById(row.seller_id)
      if (!seller?.email) { console.warn('[sell-prompt] No email for', row.seller_id); continue }

      const priceStr = row.price
        ? `$${Number(row.price).toLocaleString()}${row.is_housing ? '/mo' : ''}`
        : null
      const listingUrl = `${APP_URL}/share/${row.listing_id}`

      const bodyHtml = `
        <p>Hey! Your listing has been getting a lot of attention on UMarket —
           <strong>${row.contact_count} people</strong> have reached out about it.</p>
        <table style="margin:16px 0;border:1px solid #eee;border-radius:10px;overflow:hidden;width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="background:#f9f9f9;">
            <td style="padding:10px 14px;color:#888;width:38%;">Listing</td>
            <td style="padding:10px 14px;font-weight:600;color:#111;">${row.title}</td>
          </tr>
          ${priceStr ? `<tr>
            <td style="padding:10px 14px;color:#888;border-top:1px solid #eee;">Price</td>
            <td style="padding:10px 14px;font-weight:600;color:#CC0000;border-top:1px solid #eee;">${priceStr}</td>
          </tr>` : ''}
          <tr style="background:#f9f9f9;">
            <td style="padding:10px 14px;color:#888;border-top:1px solid #eee;">Interested buyers</td>
            <td style="padding:10px 14px;font-weight:700;color:#111;border-top:1px solid #eee;">${row.contact_count}</td>
          </tr>
        </table>
        <p>If it sold, tap below to mark it — that way no one else reaches out unnecessarily.
           If it hasn't sold yet, no worries, your listing stays active.</p>
      `

      const html = buildEmail(`Did "${row.title}" sell?`, bodyHtml, 'View My Listing', listingUrl)
      const result = await sendEmail(seller.email, `Did your listing "${row.title}" sell?`, html)

      if (result.ok && !result.skipped) {
        await supabase.from('listings')
          .update({ sell_prompt_sent_at: new Date().toISOString() })
          .eq('id', row.listing_id)

        await supabase.from('notifications').insert({
          user_id:    row.seller_id,
          type:       'sell_prompt',
          listing_id: row.listing_id,
          message:    `Did "${row.title}" sell? ${row.contact_count} people have reached out.`,
          read:       false,
          metadata:   { contact_count: row.contact_count },
        })

        console.log(`[sell-prompt] ✓ ${seller.email} — ${row.title}`)
        sent++
      } else if (result.skipped) {
        sent++ // count as sent in dev mode
      } else {
        failed++
      }
    } catch (err) {
      console.error('[sell-prompt] Error for', row.listing_id, err)
      failed++
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, failed, total: candidates.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
