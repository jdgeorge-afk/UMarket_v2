const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
)

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = async function handler(req, res) {
  const { id } = req.query

  const { data: listing } = await supabase
    .from('listings')
    .select('title, description, price, images, is_housing')
    .eq('id', id)
    .single()

  const listingUrl = `https://www.u-market.app/listing/${id}`

  // Listing not found — redirect straight to home
  if (!listing) {
    res.setHeader('Location', 'https://www.u-market.app')
    return res.status(302).end()
  }

  const title = listing.title ?? 'Listing on UMarket'
  const price = listing.price != null
    ? `$${Number(listing.price).toLocaleString()}${listing.is_housing ? '/mo' : ''}`
    : null
  const desc  = [price, listing.description].filter(Boolean).join(' — ').slice(0, 200)
  const image = listing.images?.[0] ?? 'https://www.u-market.app/og-image.png'

  // Bots (iMessage, WhatsApp, etc.) read the OG tags and stop here.
  // Real users hit the <script> redirect and land on the correct listing page.
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)} | UMarket</title>

  <meta property="og:type"             content="website" />
  <meta property="og:url"              content="${esc(listingUrl)}" />
  <meta property="og:title"            content="${esc(title)}" />
  <meta property="og:description"      content="${esc(desc)}" />
  <meta property="og:image"            content="${esc(image)}" />
  <meta property="og:image:secure_url" content="${esc(image)}" />
  <meta property="og:image:type"       content="image/jpeg" />
  <meta property="og:image:width"      content="1200" />
  <meta property="og:image:height"     content="630" />

  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image"       content="${esc(image)}" />

  <script>window.location.replace("${listingUrl}")</script>
</head>
<body>
  <p>Loading listing…</p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=3600')
  res.status(200).send(html)
}
