import PhotoCarousel from './PhotoCarousel'
import { useFavorites } from '../hooks/useFavorites'

// Formats a listing's age as "2h ago", "3d ago", etc.
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30)  return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatPrice(listing) {
  if (listing.is_looking) {
    return listing.budget ? `Budget: $${Number(listing.budget).toLocaleString()}` : 'Looking'
  }
  if (!listing.price || Number(listing.price) === 0) return 'Free'
  return `$${Number(listing.price).toLocaleString()}`
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

        {/* Boosted / featured badge */}
        {listing.boosted && (
          <span className="absolute top-2 left-2 bg-school-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            Featured
          </span>
        )}

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
          className="absolute top-2 right-2 w-7 h-7 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-colors ${faved ? 'text-red-500 fill-red-500' : 'text-gray-300'}`}
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Card body */}
      <div className="p-2.5">
        <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{listing.title}</p>

        {/* Price */}
        <p className="text-school-primary font-bold text-base mt-0.5">{formatPrice(listing)}</p>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-1.5 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            {listing.condition && !listing.is_looking && (
              <span className="text-[10px] text-gray-400 truncate">{listing.condition}</span>
            )}
            {listing.is_housing && listing.beds && (
              <span className="text-[10px] text-gray-400">{listing.beds}BR · {listing.avail}</span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {listing.profiles?.verified && (
              <svg className="w-3 h-3 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <span className="text-[10px] text-gray-300">{timeAgo(listing.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
