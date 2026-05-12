const { createClient } = require('@supabase/supabase-js')

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = async function handler(req, res) {
  const { id } = req.query
  const listingUrl = `https://u-market.app/listing/${id}`

  // If no ID, redirect home
  if (!id) {
    res.setHeader('Location', 'https://u-market.app')
    return res.status(302).end()
  }

  // Try to fetch listing for OG tags — failures are non-fatal
  let listing = null
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY,
    )
    const { data } = await supabase
      .from('listings')
      .select('title, description, price, images, is_housing')
      .eq('id', id)
      .single()
    listing = data
  } catch (_) {}

  const title = listing?.title ?? 'Listing on UMarket'
  const price = listing?.price != null
    ? `$${Number(listing.price).toLocaleString()}${listing.is_housing ? '/mo' : ''}`
    : null
  const desc  = [price, listing?.description].filter(Boolean).join(' — ').slice(0, 200)
            || 'Buy, sell, find housing and subleases near your campus.'
  const image = listing?.images?.[0] ?? 'https://u-market.app/og-image.png'

  // Bots read the OG tags. Real users are immediately redirected by the script.
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
  <meta property="og:image:width"      content="1200" />
  <meta property="og:image:height"     content="630" />
  <meta name="twitter:card"            content="summary_large_image" />
  <meta name="twitter:title"           content="${esc(title)}" />
  <meta name="twitter:description"     content="${esc(desc)}" />
  <meta name="twitter:image"           content="${esc(image)}" />
  <script>window.location.replace(${JSON.stringify(listingUrl)})</script>
</head>
<body><p>Loading…</p></body>
</html>`

  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(html)
}
