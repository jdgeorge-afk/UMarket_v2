import { useEffect, useRef } from 'react'

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

// Load the Google Maps JS API once, return a promise that resolves when ready
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

export default function MapPreview({ lat, lng, className = '' }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!lat || !lng || !KEY) return
    loadGoogleMaps().then(() => {
      if (!containerRef.current) return
      if (!mapRef.current) {
        mapRef.current = new window.google.maps.Map(containerRef.current, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        })
        new window.google.maps.Marker({
          position: { lat, lng },
          map: mapRef.current,
        })
      } else {
        mapRef.current.setCenter({ lat, lng })
      }
    }).catch(() => {})
  }, [lat, lng])

  if (!lat || !lng || !KEY) return null

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-xl overflow-hidden border border-gray-200 ${className}`}
      style={{ height: 220 }}
    />
  )
}
