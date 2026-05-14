#!/usr/bin/env node
// Queries the listing_outcomes table and writes data/sales-report.md
// Requires SUPABASE_URL and SUPABASE_SERVICE_KEY env vars (GitHub secrets).

const https = require('https')
const fs    = require('fs')
const path  = require('path')

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY')
  process.exit(1)
}

function fetch(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr)
    const options = {
      hostname: url.hostname,
      path:     url.pathname + url.search,
      method:   'GET',
      headers: {
        'apikey':        SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept':        'application/json',
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => resolve(JSON.parse(data)))
    })
    req.on('error', reject)
    req.end()
  })
}

function pct(n, total) {
  if (!total) return '—'
  return `${Math.round((n / total) * 100)}%`
}

function row(...cells) {
  return `| ${cells.map((c) => String(c ?? '—').replace(/\|/g, '\\|')).join(' | ')} |`
}

function formatContact(type, value) {
  if (!value) return '—'
  if (type === 'phone')     return `📱 ${value}`
  if (type === 'email')     return `✉️ ${value}`
  if (type === 'instagram') return `📸 @${value}`
  if (type === 'snapchat')  return `👻 @${value}`
  return value
}

async function main() {
  const rows = await fetch(
    `${SUPABASE_URL}/rest/v1/listing_outcomes?select=*&order=created_at.desc&limit=5000`
  )

  if (!Array.isArray(rows)) {
    console.error('Unexpected response:', rows)
    process.exit(1)
  }

  const total      = rows.length
  const viaUmarket = rows.filter((r) => r.sold_via_umarket === true).length
  const elsewhere  = rows.filter((r) => r.sold_via_umarket === false).length
  const skipped    = rows.filter((r) => r.sold_via_umarket === null).length

  const soldRows    = rows.filter((r) => r.action === 'sold')
  const deletedRows = rows.filter((r) => r.action === 'deleted')

  // ── Outreach lists ───────────────────────────────────────────────────────────
  const didSellViaUmarket = rows.filter((r) => r.sold_via_umarket === true)
  const didNotSell        = rows.filter((r) => r.sold_via_umarket === false)

  // ── By school ────────────────────────────────────────────────────────────────
  const bySchool = {}
  rows.forEach((r) => {
    const s = r.school_id || 'Unknown'
    if (!bySchool[s]) bySchool[s] = { total: 0, via: 0, not: 0 }
    bySchool[s].total++
    if (r.sold_via_umarket === true)  bySchool[s].via++
    if (r.sold_via_umarket === false) bySchool[s].not++
  })

  // ── By category ──────────────────────────────────────────────────────────────
  const byCat = {}
  rows.forEach((r) => {
    const c = r.listing_category || 'Unknown'
    if (!byCat[c]) byCat[c] = { total: 0, via: 0 }
    byCat[c].total++
    if (r.sold_via_umarket === true) byCat[c].via++
  })

  // ── Last 30 days ─────────────────────────────────────────────────────────────
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const recent    = rows.filter((r) => new Date(r.created_at) > cutoff)
  const recentVia = recent.filter((r) => r.sold_via_umarket === true).length

  const now = new Date().toUTCString()

  const md = `# UMarket Sales Report
> Last updated: ${now}
> Auto-runs every Monday. Trigger manually: **Actions → Generate Sales Report → Run workflow**

---

## Summary

${row('Metric', 'Value')}
${row('---', '---')}
${row('Total outcomes tracked', total)}
${row('✅ Sold via UMarket', `${viaUmarket} (${pct(viaUmarket, total)})`)}
${row('👋 Sold elsewhere / removed', `${elsewhere} (${pct(elsewhere, total)})`)}
${row('⏭️ Survey skipped', `${skipped} (${pct(skipped, total)})`)}
${row('📊 Survey completion rate', pct(viaUmarket + elsewhere, total))}
${row('📅 Last 30 days', `${recent.length} outcomes, ${recentVia} via UMarket (${pct(recentVia, recent.length)})`)}

---

## By Action

${row('Action', 'Total', 'Via UMarket', 'Elsewhere', 'Skipped', 'UMarket %')}
${row('---', '---', '---', '---', '---', '---')}
${row(
  'Marked Sold',
  soldRows.length,
  soldRows.filter((r) => r.sold_via_umarket === true).length,
  soldRows.filter((r) => r.sold_via_umarket === false).length,
  soldRows.filter((r) => r.sold_via_umarket === null).length,
  pct(soldRows.filter((r) => r.sold_via_umarket === true).length, soldRows.length),
)}
${row(
  'Deleted',
  deletedRows.length,
  deletedRows.filter((r) => r.sold_via_umarket === true).length,
  deletedRows.filter((r) => r.sold_via_umarket === false).length,
  deletedRows.filter((r) => r.sold_via_umarket === null).length,
  pct(deletedRows.filter((r) => r.sold_via_umarket === true).length, deletedRows.length),
)}

---

## By School

${row('School', 'Total', 'Via UMarket', 'Elsewhere', 'UMarket %')}
${row('---', '---', '---', '---', '---')}
${Object.entries(bySchool)
  .sort((a, b) => b[1].total - a[1].total)
  .map(([school, d]) => row(school, d.total, d.via, d.not, pct(d.via, d.total)))
  .join('\n')}

---

## By Category

${row('Category', 'Total', 'Via UMarket', 'UMarket %')}
${row('---', '---', '---', '---')}
${Object.entries(byCat)
  .sort((a, b) => b[1].total - a[1].total)
  .map(([cat, d]) => row(cat, d.total, d.via, pct(d.via, d.total)))
  .join('\n')}

---

## 🎯 Outreach: Did NOT Sell via UMarket (${didNotSell.length})

These sellers said their item sold somewhere else, or deleted without selling through UMarket.
Reach out to understand why and bring them back.

${didNotSell.length === 0
  ? '_No records yet._'
  : `${row('Date', 'Seller', 'Contact', 'Listing', 'Price', 'School', 'Action')}
${row('---', '---', '---', '---', '---', '---', '---')}
${didNotSell.map((r) => row(
  new Date(r.created_at).toLocaleDateString('en-US'),
  r.seller_name || '—',
  formatContact(r.seller_contact_type, r.seller_contact),
  (r.listing_title || '—').slice(0, 35),
  r.listing_price != null ? `$${Number(r.listing_price).toLocaleString()}` : '—',
  r.school_id || '—',
  r.action,
)).join('\n')}`}

---

## ✅ Sold via UMarket (${didSellViaUmarket.length})

These sellers confirmed their item sold through UMarket. Great for testimonials and success tracking.

${didSellViaUmarket.length === 0
  ? '_No records yet._'
  : `${row('Date', 'Seller', 'Contact', 'Listing', 'Price', 'School')}
${row('---', '---', '---', '---', '---', '---')}
${didSellViaUmarket.map((r) => row(
  new Date(r.created_at).toLocaleDateString('en-US'),
  r.seller_name || '—',
  formatContact(r.seller_contact_type, r.seller_contact),
  (r.listing_title || '—').slice(0, 35),
  r.listing_price != null ? `$${Number(r.listing_price).toLocaleString()}` : '—',
  r.school_id || '—',
)).join('\n')}`}
`

  const outPath = path.join(process.cwd(), 'data', 'sales-report.md')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, md)
  console.log(`Report written to ${outPath} (${total} rows, ${didNotSell.length} outreach, ${didSellViaUmarket.length} via UMarket)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
