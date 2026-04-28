import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix broken marker icons in Vite builds
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

/**
 * Renders an OpenStreetMap tile map centered on [lat, lng] with a pin.
 * No API key required.
 */
export default function MapPreview({ lat, lng, className = '' }) {
  const containerRef = useRef(null)
  const mapRef       = useRef(null)
  const markerRef    = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !lat || !lng) return

    if (mapRef.current) {
      // Already mounted — just move the view and marker
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

    markerRef.current = L.marker([lat, lng]).addTo(map)
    mapRef.current    = map
  }, [lat, lng])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      mapRef.current?.remove()
      mapRef.current   = null
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
