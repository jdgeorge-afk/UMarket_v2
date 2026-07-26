const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

/**
 * Google Maps static image centered on [lat, lng] with a red pin.
 * Updates instantly whenever coordinates change — no JS map runtime needed.
 */
export default function MapPreview({ lat, lng, className = '' }) {
  if (!lat || !lng || !KEY) return null

  const src =
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}` +
    `&zoom=15` +
    `&size=600x300` +
    `&scale=2` +
    `&markers=color:red%7C${lat},${lng}` +
    `&style=feature:poi|visibility:off` +
    `&key=${KEY}`

  return (
    <div className={`w-full rounded-xl overflow-hidden border border-gray-200 ${className}`} style={{ height: 200 }}>
      <img
        src={src}
        alt="Map preview"
        className="w-full h-full object-cover"
        loading="lazy"
      />
    </div>
  )
}
