import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

let _loadPromise = null
function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve()
  if (_loadPromise) return _loadPromise
  _loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${KEY}`
    script.async = true
    script.onload = resolve
    script.onerror = reject
    document.head.appendChild(script)
  })
  return _loadPromise
}

function priceLabel(l) {
  if (!l.price || Number(l.price) === 0) return 'Free'
  return `$${Number(l.price).toLocaleString()}/mo`
}

export default function HousingMap({ onOpenListing }) {
  const { school } = useSchool()
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [noKey, setNoKey] = useState(false)

  useEffect(() => {
    if (!school?.id) return
    supabase
      .from('listings')
      .select('id, title, price, location, lat, lng, images, beds, is_housing, profiles!seller_id(name, verified)')
      .eq('school_id', school.id)
      .eq('is_housing', true)
      .eq('sold', false)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setListings(data ?? [])
        setLoading(false)
      })
  }, [school?.id])

  useEffect(() => {
    if (loading || listings.length === 0 || !containerRef.current) return
    if (!KEY) { setNoKey(true); return }

    loadGoogleMaps().then(() => {
      const G = window.google.maps
      const bounds = new G.LatLngBounds()

      if (!mapRef.current) {
        mapRef.current = new G.Map(containerRef.current, {
          zoom: 13,
          center: { lat: listings[0].lat, lng: listings[0].lng },
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        })
      }

      // Clear old markers
      markersRef.current.forEach(m => m.setMap(null))
      markersRef.current = []
      if (infoWindowRef.current) infoWindowRef.current.close()
      infoWindowRef.current = new G.InfoWindow()

      listings.forEach(l => {
        const pos = { lat: l.lat, lng: l.lng }
        bounds.extend(pos)

        const marker = new G.Marker({ position: pos, map: mapRef.current, title: l.title })
        markersRef.current.push(marker)

        marker.addListener('click', () => {
          const img = l.images?.[0]
            ? `<img src="${l.images[0]}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;margin-bottom:8px;" />`
            : ''
          const beds = l.beds ? `<p style="color:#6b7280;font-size:12px;">${l.beds} bed</p>` : ''
          const addr = l.location ? `<p style="color:#9ca3af;font-size:11px;margin-top:2px;line-height:1.3;">${l.location}</p>` : ''
          infoWindowRef.current.setContent(`
            <div style="width:200px;font-family:system-ui,sans-serif;">
              ${img}
              <p style="font-weight:600;color:#111827;font-size:13px;line-height:1.3;margin:0 0 2px;">${l.title}</p>
              <p style="color:#cc0000;font-weight:700;font-size:13px;margin:0 0 2px;">${priceLabel(l)}</p>
              ${beds}${addr}
              <button
                onclick="window.__housingMapOpen('${l.id}')"
                style="margin-top:8px;width:100%;background:#cc0000;color:#fff;border:none;border-radius:8px;padding:6px 0;font-size:12px;font-weight:600;cursor:pointer;"
              >View Listing</button>
            </div>
          `)
          infoWindowRef.current.open(mapRef.current, marker)
        })
      })

      mapRef.current.fitBounds(bounds)
    }).catch(() => setNoKey(true))
  }, [listings, loading])

  // Bridge for the InfoWindow button (can't pass React handler into raw HTML)
  useEffect(() => {
    window.__housingMapOpen = (id) => {
      const listing = listings.find(l => l.id === id)
      if (listing) onOpenListing?.(listing)
    }
    return () => { delete window.__housingMapOpen }
  }, [listings, onOpenListing])

  if (loading) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height: 'calc(100vh - 120px)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-red-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading map…</p>
        </div>
      </div>
    )
  }

  if (noKey) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height: 'calc(100vh - 120px)' }}>
        <p className="text-sm text-center px-4">Google Maps API key not configured.<br />Add <code className="text-xs bg-gray-100 px-1 rounded">VITE_GOOGLE_MAPS_KEY</code> to your environment.</p>
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400" style={{ height: 'calc(100vh - 120px)' }}>
        <p className="text-sm">No housing listings with addresses yet.</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: 'calc(100vh - 120px)' }}
    />
  )
}
