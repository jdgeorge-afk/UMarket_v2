import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Custom pin using a DivIcon — avoids Vite asset-bundling issues with default marker images
const PIN_ICON = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 28px; height: 28px;
      background: #ef4444;
      border: 3px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    "></div>
  `,
  iconSize:   [28, 28],
  iconAnchor: [14, 28], // tip of the pin points at the location
})

/**
 * Renders an OpenStreetMap tile map centered on [lat, lng] with a red pin.
 * No API key required.
 */
export default function MapPreview({ lat, lng, className = '' }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markerRef    = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !lat || !lng) return

    if (mapRef.current) {
      // Already mounted — move view and pin
      mapRef.current.setView([lat, lng], 15)
      markerRef.current?.setLatLng([lat, lng])
      return
    }

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    markerRef.current = L.marker([lat, lng], { icon: PIN_ICON }).addTo(map)
    mapRef.current    = map

    // Recalculate size after paint — fixes blank map in modals / flex containers
    setTimeout(() => map.invalidateSize(), 50)
  }, [lat, lng])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current    = null
      markerRef.current = null
    }
  }, [])

  if (!lat || !lng) return null

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-xl overflow-hidden border border-gray-200 ${className}`}
      style={{ height: 200 }}
    />
  )
}
