/**
 * Client-side personalization — tracks engagement signals in localStorage
 * and uses them to re-rank the feed, similar to how Facebook Marketplace
 * learns what you're looking for.
 *
 * Signals tracked (all stored in localStorage, never sent to the server):
 *   - Category affinity: how many listings the user has opened per category
 *   - Viewed IDs: listing IDs the user has already seen (soft penalty)
 *   - Price range: rolling average of prices on opened listings
 *   - Recently viewed: compact stubs for the "Recently Viewed" strip
 *
 * Scoring (applied to the non-boosted portion of the feed):
 *   +0–3  category affinity  (proportional to interest count vs. max)
 *   -1.5  already seen        (pushes viewed items down, doesn't hide them)
 *   +0–0.5 price range match (bonus when price is close to the user's average)
 */

const KEY          = 'umarket_interests'
const MAX_RECENT   = 12   // stubs kept in the "recently viewed" strip
const MAX_SEEN_IDS = 300  // oldest IDs dropped after this many unique views
const MIN_SIGNAL   = 3    // minimum total views before we start re-ranking

// ── Storage helpers ───────────────────────────────────────────────────────────

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}
function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)) } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record that the user opened a listing.
 * Call this whenever a ListingDetail is mounted.
 */
export function trackView(listing) {
  if (!listing?.id) return
  const d = read()

  // Category affinity counter
  d.cats = d.cats || {}
  if (listing.category) {
    d.cats[listing.category] = (d.cats[listing.category] || 0) + 1
  }

  // Seen IDs (circular buffer — drop oldest if over limit)
  d.seen = d.seen || []
  if (!d.seen.includes(listing.id)) {
    d.seen.push(listing.id)
    if (d.seen.length > MAX_SEEN_IDS) d.seen = d.seen.slice(-MAX_SEEN_IDS)
  }

  // Price/budget rolling sum for average
  const price = listing.price ?? listing.budget
  if (price != null && Number(price) > 0) {
    d.priceSum   = (d.priceSum   || 0) + Number(price)
    d.priceCount = (d.priceCount || 0) + 1
  }

  // Recently viewed stubs (deduped, newest first)
  d.recent = (d.recent || []).filter((r) => r.id !== listing.id)
  d.recent.unshift({
    id:         listing.id,
    title:      listing.title,
    price:      listing.price,
    budget:     listing.budget,
    category:   listing.category,
    images:     listing.images?.slice(0, 1) ?? [],
    condition:  listing.condition,
    is_housing: listing.is_housing,
    is_looking: listing.is_looking,
    boosted:    listing.boosted,
    sold:       listing.sold,
    profiles:   listing.profiles ?? null,
  })
  if (d.recent.length > MAX_RECENT) d.recent = d.recent.slice(0, MAX_RECENT)

  write(d)
}

/**
 * Return true once the user has opened at least MIN_SIGNAL listings —
 * below that threshold the ranking is basically noise, so we don't apply it.
 */
export function hasSignal() {
  const d = read()
  const total = Object.values(d.cats || {}).reduce((a, b) => a + b, 0)
  return total >= MIN_SIGNAL
}

/**
 * Re-rank an array of listings by relevance to the current user.
 * Boosted listings should be separated out *before* calling this.
 */
export function scoreListings(listings) {
  if (!listings?.length) return listings
  const d        = read()
  const cats     = d.cats || {}
  const seen     = new Set(d.seen || [])
  const avgPrice = d.priceCount > 0 ? d.priceSum / d.priceCount : null
  const maxCat   = Math.max(1, ...Object.values(cats))

  const score = (l) => {
    let s = 0

    // Category affinity: 0–3 pts
    s += ((cats[l.category] || 0) / maxCat) * 3

    // Already seen: –1.5 pts (gentle push-down, not hidden)
    if (seen.has(l.id)) s -= 1.5

    // Price range match: 0–0.5 pts
    if (avgPrice != null) {
      const p = l.price ?? l.budget
      if (p != null && Number(p) > 0) {
        const diff = Math.abs(Number(p) - avgPrice) / Math.max(avgPrice, 1)
        if (diff < 1) s += (1 - diff) * 0.5
      }
    }

    return s
  }

  return [...listings].sort((a, b) => score(b) - score(a))
}

/**
 * Return compact listing stubs for the "Recently Viewed" strip.
 */
export function getRecentlyViewed() {
  return read().recent || []
}
