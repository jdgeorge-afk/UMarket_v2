// Shared email utilities for all UMarket edge functions

const FROM = 'UMarket <notifications@u-market.app>'
const APP_URL = 'https://u-market.app'

export function buildEmail({
  heading,
  bodyHtml,
  ctaLabel,
  ctaUrl = APP_URL,
}: {
  heading: string
  bodyHtml: string
  ctaLabel: string
  ctaUrl?: string
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${heading}</title>
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
              <a href="${APP_URL}" style="color:#bbb;text-decoration:underline;">Unsubscribe in your account settings.</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping send')
    return { ok: true, skipped: true }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[email] Resend error:', res.status, body)
    return { ok: false, error: body }
  }

  return { ok: true }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
