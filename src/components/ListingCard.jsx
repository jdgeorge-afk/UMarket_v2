import PhotoCarousel from './PhotoCarousel'
import { useFavorites } from '../hooks/useFavorites'

// Returns a badge object {label, color} or null — shown on the photo
function listingBadge(listing) {
  const now   = Date.now()
  const DAY   = 86400000

  // Price drop (within 14 days)
  if (listing.price_dropped_at) {
    if (now - new Date(listing.price_dropped_at).getTime() < 14 * DAY)
      return { label: 'Price Drop', cls: 'bg-orange-500' }
  }
  // Updated (within 7 days, but older than 2 days so it doesn't clash with Just Listed)
  if (listing.updated_at) {
    const updatedAge = now - new Date(listing.updated_at).getTime()
    const createdAge = now - new Date(listing.created_at).getTime()
    if (updatedAge < 7 * DAY && createdAge > 2 * DAY)
      return { label: 'Updated', cls: 'bg-blue-500' }
  }
  // Just Listed (within 2 days)
  if (now - new Date(listing.created_at).getTime() < 2 * DAY)
    return { label: 'Just Listed', cls: 'bg-green-500' }

  return null
}

function formatPrice(listing) {
  if (listing.is_looking) {
    return listing.budget ? `Budget: $${Number(listing.budget).toLocaleString()}` : 'Looking'
  }
  if (!listing.price || Number(listing.price) === 0) return 'Free'
  const base = `$${Number(listing.price).toLocaleString()}`
  // Housing and sublease listings show monthly rent
  return listing.is_housing ? `${base}/mo` : base
}

export default function ListingCard({ listing, onOpen, onRequireAuth }) {
  const { isFavorited, toggleFavorite } = useFavorites()
  const faved = isFavorited(listing.id)

  const handleFavorite = (e) => {
    e.stopPropagation()
    onRequireAuth(() => toggleFavorite(listing.id))
  }

  return (
    <div
      onClick={() => onOpen(listing)}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group"
    >
      {/* Image area */}
      <div className="relative">
        <PhotoCarousel
          images={listing.images ?? []}
          alt={listing.title}
          onClick={() => onOpen(listing)}
        />

        {/* Top-left badge — Featured takes priority, otherwise status badge */}
        {listing.boosted ? (
          <span className="absolute top-2 left-2 bg-school-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            Featured
          </span>
        ) : (() => { const b = listingBadge(listing); return b ? (
          <span className={`absolute top-2 left-2 ${b.cls} text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full`}>
            {b.label}
          </span>
        ) : null })()}

        {/* Sold overlay */}
        {listing.sold && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="bg-white text-gray-900 font-bold text-sm px-3 py-1 rounded-full tracking-wide">
              SOLD
            </span>
          </div>
        )}

        {/* Heart / save button */}
        <button
          onClick={handleFavorite}
          aria-label={faved ? 'Remove from saved' : 'Save listing'}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-md transition-all ${
            faved ? 'bg-white' : 'bg-black/30 hover:bg-black/40'
          }`}
        >
          <svg
            className={`w-4 h-4 transition-all ${faved ? 'text-red-500 fill-red-500 scale-110' : 'text-white'}`}
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Card body */}
      <div className="p-2.5">
        <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{listing.title}</p>

        {/* Price + bedroom count for housing */}
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <p className="text-school-primary font-bold text-base">{formatPrice(listing)}</p>
          {listing.is_housing && listing.beds && (
            <span className="text-xs text-gray-400">{listing.beds}bd</span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-1.5 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {listing.condition && !listing.is_looking && !listing.is_housing && (
              <span className="text-[10px] text-gray-400 truncate">{listing.condition}</span>
            )}
            {listing.is_housing && listing.avail && (
              <span className="text-[10px] text-gray-400 truncate">{listing.avail}</span>
            )}
            {listing.category === 'sublease' && listing.spots_available && (
              <span className="text-[10px] text-gray-400">{listing.spots_available} spot{listing.spots_available !== 1 ? 's' : ''} avail.</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {listing.profiles?.verified && (
              <svg className="w-3 h-3 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
