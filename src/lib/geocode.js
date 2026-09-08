async function censusGeocode(fullAddress) {
  try {
    const params = new URLSearchParams({
      address: fullAddress,
      benchmark: 'Public_AR_Current',
      format: 'json',
    })
    const res = await fetch(
      `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?${params}`
    )
    if (res.ok) {
      const data = await res.json()
      const match = data?.result?.addressMatches?.[0]
      if (match) return { lat: match.coordinates.y, lng: match.coordinates.x }
    }
  } catch {}
  return null
}

async function nominatimGeocode(query) {
  try {
    const params = new URLSearchParams({
      format: 'json',
      limit: '1',
      countrycodes: 'us',
      q: query,
    })
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'UMarket/1.0' } }
    )
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
      }
    }
  } catch {}
  return null
}

export async function geocode(address, locationHint = '') {
  if (!address?.trim()) return null

  const addr = address.trim()
  const full = locationHint ? `${addr}, ${locationHint}` : addr

  // 1️⃣ Census geocoder with city/state hint
  const r1 = await censusGeocode(full)
  if (r1) return r1

  // 2️⃣ Census geocoder with address + USA (no hint — helps when hint is wrong/missing)
  if (locationHint) {
    const r2 = await censusGeocode(`${addr}, USA`)
    if (r2) return r2
  }

  // 3️⃣ Nominatim with full address + US country bias
  const r3 = await nominatimGeocode(full)
  if (r3) return r3

  // 4️⃣ Nominatim with bare address only (last resort)
  if (locationHint) {
    const r4 = await nominatimGeocode(addr)
    if (r4) return r4
  }

  return null
}
