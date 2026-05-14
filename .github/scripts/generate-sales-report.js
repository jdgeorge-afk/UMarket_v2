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
  return `| ${cells.join(' | ')} |`
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

  // ── By school ───────────────────────────────────────────────────────────────
  const bySchool = {}
  rows.forEach((r) => {
    const s = r.school_id || 'Unknown'
    if (!bySchool[s]) bySchool[s] = { total: 0, via: 0, not: 0 }
    bySchool[s].total++
    if (r.sold_via_umarket === true)  bySchool[s].via++
    if (r.sold_via_umarket === false) bySchool[s].not++
  })

  // ── By category ─────────────────────────────────────────────────────────────
  const byCat = {}
  rows.forEach((r) => {
    const c = r.listing_category || 'Unknown'
    if (!byCat[c]) byCat[c] = { total: 0, via: 0 }
    byCat[c].total++
    if (r.sold_via_umarket === true) byCat[c].via++
  })

  // ── Recent 30 days ──────────────────────────────────────────────────────────
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const recent = rows.filter((r) => new Date(r.created_at) > cutoff)
  const recentVia = recent.filter((r) => r.sold_via_umarket === true).length

  // ── Last 10 outcomes ────────────────────────────────────────────────────────
  const last10 = rows.slice(0, 10)

  const now = new Date().toUTCString()

  const md = `# UMarket Sales Report
> Last updated: ${now}
> Run this report anytime from **Actions → Generate Sales Report → Run workflow**.

---

## Summary

${row('Metric', 'Value')}
${row('---', '---')}
${row('Total outcomes tracked', total)}
${row('✅ Sold via UMarket', `${viaUmarket} (${pct(viaUmarket, total)})`)}
${row('👋 Sold elsewhere / removed', `${elsewhere} (${pct(elsewhere, total)})`)}
${row('⏭️ Survey skipped', `${skipped} (${pct(skipped, total)})`)}
${row('📊 Survey completion rate', pct(viaUmarket + elsewhere, total))}

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

## Last 30 Days

${row('Metric', 'Value')}
${row('---', '---')}
${row('Outcomes', recent.length)}
${row('Sold via UMarket', `${recentVia} (${pct(recentVia, recent.length)})`)}

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

## Recent Outcomes (Last 10)

${row('Date', 'Title', 'Price', 'Category', 'School', 'Action', 'Via UMarket?')}
${row('---', '---', '---', '---', '---', '---', '---')}
${last10.map((r) => row(
  new Date(r.created_at).toLocaleDateString('en-US'),
  (r.listing_title ?? '—').slice(0, 40),
  r.listing_price != null ? `$${Number(r.listing_price).toLocaleString()}` : '—',
  r.listing_category ?? '—',
  r.school_id ?? '—',
  r.action,
  r.sold_via_umarket === true ? '✅ Yes' : r.sold_via_umarket === false ? '👋 No' : '⏭️ Skipped',
)).join('\n')}
`

  const outPath = path.join(process.cwd(), 'data', 'sales-report.md')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, md)
  console.log(`Report written to ${outPath} (${total} rows)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
