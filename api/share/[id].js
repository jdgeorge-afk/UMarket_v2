const { createClient } = require('@supabase/supabase-js')

// "apple" was too broad — matches AppleWebKit in every browser UA.
// Target only Apple's specific crawler (Applebot) plus known social bots.
const BOT_RE = /bot|crawl|spider|facebookexternalhit|twitterbot|whatsapp|telegram|slack|discord|linkedinbot|applebot/i

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = async function handler(req, res) {
  const { id } = req.query
  const ua = req.headers['user-agent'] || ''
  const isBot = BOT_RE.test(ua)

  // Real users: 302 directly to the listing page
  if (!isBot) {
    res.setHeader('Location', `https://u-market.app/listing/${id}`)
    return res.status(302).end()
  }

  // Bots: fetch listing data and serve OG tags
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
  const url   = `https://u-market.app/listing/${id}`

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(title)} | UMarket</title>
  <meta property="og:type"             content="website" />
  <meta property="og:url"              content="${esc(url)}" />
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
  <script>window.location.replace("https://u-market.app/listing/${esc(id)}")</script>
</head>
<body><p>${esc(title)}</p></body>
</html>`

  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=3600')
  res.status(200).send(html)
}
