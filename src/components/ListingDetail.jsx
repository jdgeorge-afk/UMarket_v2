import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useFavorites } from '../hooks/useFavorites'
import Lightbox from './Lightbox'
import ContactModal from './ContactModal'
import ReportModal from './ReportModal'
import { getCategoryLabel } from '../constants/categories'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function Chip({ children, accent }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        accent ? 'bg-school-primary text-white' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {children}
    </span>
  )
}

export default function ListingDetail({ listing, onBack, onOpenProfile, onRequireAuth }) {
  const { user } = useAuth()
  const { isFavorited, toggleFavorite } = useFavorites()
  const [seller, setSeller] = useState(listing.profiles ?? null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [contactOpen, setContactOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [markingAsSold, setMarkingAsSold] = useState(false)

  const images = listing.images ?? []
  const isOwner = user?.id === listing.seller_id

  useEffect(() => {
    if (!seller || !seller.contact) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', listing.seller_id)
        .single()
        .then(({ data }) => { if (data) setSeller(data) })
    }
  }, [listing.seller_id]) // eslint-disable-line

  const openLightbox = (i) => {
    setLightboxIndex(i)
    setLightboxOpen(true)
  }

  const markAsSold = async () => {
    setMarkingAsSold(true)
    await supabase.from('listings').update({ sold: true }).eq('id', listing.id)
    setMarkingAsSold(false)
    onBack()
  }

  const formatPrice = () => {
    if (listing.is_looking) return listing.budget ? `Budget: $${Number(listing.budget).toLocaleString()}` : 'No budget listed'
    if (!listing.price || Number(listing.price) === 0) return 'Free'
    return `$${Number(listing.price).toLocaleString()}`
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      {/* Back */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-school-primary font-medium mb-4 hover:opacity-75 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Image grid */}
      {images.length > 0 && (
        <div
          className={`grid gap-2 mb-5 ${
            images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          }`}
        >
          {images.slice(0, 5).map((img, i) => (
            <div
              key={i}
              className={`relative cursor-pointer rounded-xl overflow-hidden ${
                i === 0 && images.length > 1 ? 'col-span-2' : ''
              }`}
              onClick={() => openLightbox(i)}
            >
              <img
                src={img}
                alt={`Photo ${i + 1}`}
                className={`w-full object-cover ${i === 0 && images.length > 1 ? 'aspect-video' : 'aspect-square'}`}
              />
              {/* +N more overlay on last visible */}
              {i === 4 && images.length > 5 && (
                <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white font-bold text-xl rounded-xl">
                  +{images.length - 5}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Title, price, save */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">{listing.title}</h1>
          <p className="text-3xl font-extrabold text-school-primary mt-1">{formatPrice()}</p>
        </div>
        <button
          onClick={() => onRequireAuth(() => toggleFavorite(listing.id))}
          aria-label="Save listing"
          className="shrink-0 w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-red-300 transition-colors"
        >
          <svg
            className={`w-5 h-5 transition-colors ${isFavorited(listing.id) ? 'text-red-500 fill-red-500' : 'text-gray-300'}`}
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Chip>{getCategoryLabel(listing.category)}</Chip>
        {listing.condition && <Chip>{listing.condition}</Chip>}
        {listing.location && <Chip>📍 {listing.location}</Chip>}
        {listing.is_housing && listing.beds && <Chip>{listing.beds} BR</Chip>}
        {listing.is_housing && listing.size && <Chip>{listing.size}</Chip>}
        {listing.is_housing && listing.avail && <Chip>Available {listing.avail}</Chip>}
        {listing.boosted && <Chip accent>⚡ Featured</Chip>}
        <Chip>{timeAgo(listing.created_at)}</Chip>
      </div>

      {/* Description */}
      {listing.description && (
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">{listing.description}</p>
        </div>
      )}

      {/* Seller card */}
      {seller && (
        <button
          onClick={() => onOpenProfile(listing.seller_id)}
          className="w-full flex items-center gap-3 border border-gray-200 rounded-2xl p-4 mb-4 hover:bg-gray-50 transition-colors text-left group"
        >
          <div className="w-12 h-12 rounded-full bg-school-primary flex items-center justify-center text-white font-bold text-lg shrink-0">
            {seller.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 flex items-center gap-1.5">
              {seller.name}
              {seller.verified && (
                <svg className="w-4 h-4 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </p>
            <p className="text-sm text-gray-400">⭐ {seller.score ?? '5.0'} · {seller.sold_count ?? 0} sold · {seller.grade ?? ''}</p>
          </div>
          <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* CTA buttons */}
      {!isOwner ? (
        <>
          <button
            onClick={() => onRequireAuth(() => setContactOpen(true))}
            className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-lg hover:opacity-90 transition-opacity shadow-md mb-3"
          >
            Contact Seller
          </button>
          <button
            onClick={() => onRequireAuth(() => setReportOpen(true))}
            className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition-colors"
          >
            Report this listing
          </button>
        </>
      ) : (
        <button
          onClick={markAsSold}
          disabled={markingAsSold || listing.sold}
          className="w-full border-2 border-school-primary text-school-primary font-bold py-3 rounded-2xl hover:bg-school-primary hover:text-white transition-colors disabled:opacity-40"
        >
          {listing.sold ? '✓ Marked as Sold' : markingAsSold ? 'Marking…' : 'Mark as Sold'}
        </button>
      )}

      {/* Modals */}
      {lightboxOpen && (
        <Lightbox images={images} startIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}
      {contactOpen && seller && (
        <ContactModal seller={seller} onClose={() => setContactOpen(false)} />
      )}
      {reportOpen && (
        <ReportModal listingId={listing.id} onClose={() => setReportOpen(false)} />
      )}
    </div>
  )
}
