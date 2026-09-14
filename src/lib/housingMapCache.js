// Shared preload cache so HousingMap renders instantly when the user clicks Map.
// ListingFeed calls preloadHousingMap() as soon as the housing section is entered;
// HousingMap reads from the same promises, so nothing is fetched twice.

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

// ── Google Maps script ────────────────────────────────────────────────────────
let _mapsPromise = null
export function preloadGoogleMaps() {
  if (!KEY) return Promise.resolve()
  if (window.google?.maps) return Promise.resolve()
  if (_mapsPromise) return _mapsPromise
  _mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}&loading=async`
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return _mapsPromise
}

// ── Listings data ─────────────────────────────────────────────────────────────
const _listingsCache = {} // keyed by school_id

export async function preloadHousingListings(supabase, schoolId) {
  if (!schoolId) return []
  if (_listingsCache[schoolId]) return _listingsCache[schoolId]

  const { data } = await supabase
    .from('listings')
    .select('id, title, price, location, lat, lng, images, beds, baths, category, is_housing, profiles!seller_id(name, verified)')
    .eq('school_id', schoolId)
    .eq('is_housing', true)
    .eq('sold', false)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('created_at', { ascending: false })

  _listingsCache[schoolId] = data ?? []
  return _listingsCache[schoolId]
}

export function getCachedListings(schoolId) {
  return _listingsCache[schoolId] ?? null
}
