const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
)

// Bundled at deploy time via vercel.json includeFiles
const INDEX_HTML = fs.readFileSync(
  path.join(__dirname, '../../dist/index.html'),
  'utf-8',
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

  // No listing found — serve the SPA as-is
  if (!listing) {
    res.setHeader('Content-Type', 'text/html')
    return res.status(200).send(INDEX_HTML)
  }

  const title = listing.title ?? 'Listing'
  const price = listing.price != null
    ? `$${Number(listing.price).toLocaleString()}${listing.is_housing ? '/mo' : ''}`
    : null
  const desc  = [price, listing.description].filter(Boolean).join(' — ').slice(0, 200)
  const image = listing.images?.[0] ?? 'https://www.u-market.app/og-image.png'
  const url   = `https://www.u-market.app/listing/${id}`

  const ogTags = `
    <title>${esc(title)} | UMarket</title>
    <meta property="og:type"         content="website" />
    <meta property="og:url"          content="${url}" />
    <meta property="og:title"        content="${esc(title)}" />
    <meta property="og:description"  content="${esc(desc)}" />
    <meta property="og:image"        content="${esc(image)}" />
    <meta property="og:image:width"  content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card"        content="summary_large_image" />
    <meta name="twitter:title"       content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image"       content="${esc(image)}" />`

  // Strip existing title + OG/Twitter tags then inject listing-specific ones
  const html = INDEX_HTML
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta property="og:[^>]*>/g, '')
    .replace(/<meta name="twitter:[^>]*>/g, '')
    .replace('</head>', `${ogTags}\n  </head>`)

  res.setHeader('Content-Type', 'text/html')
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=3600')
  res.status(200).send(html)
}
