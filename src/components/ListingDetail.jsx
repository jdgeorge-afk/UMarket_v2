import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { useFavorites } from '../hooks/useFavorites'
import { trackView } from '../lib/personalization'
import Lightbox from './Lightbox'
import ContactModal from './ContactModal'
import ReportModal from './ReportModal'
import SoldSurveyModal from './SoldSurveyModal'
import MapPreview from './MapPreview'
import { getCategoryLabel } from '../constants/categories'
import { APP_URL } from '../constants/config'
import { SCHOOLS } from '../constants/schools'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

async function geocodeLocation(address, locationHint = '') {
  if (!address?.trim() || !MAPS_KEY) return null
  try {
    const full = locationHint ? `${address.trim()}, ${locationHint}` : address.trim()
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(full)}&key=${MAPS_KEY}`
    )
    if (res.ok) {
      const data = await res.json()
      const loc = data?.results?.[0]?.geometry?.location
      if (loc) return { lat: loc.lat, lng: loc.lng }
    }
  } catch {}
  return null
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

export default function ListingDetail({ listing, onBack, onOpenProfile, onRequireAuth, onAdminDelete }) {
  const { user, profile } = useAuth()
  const { school } = useSchool()
  const { isFavorited, toggleFavorite } = useFavorites()
  const [seller, setSeller] = useState(listing.profiles ?? null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [coords, setCoords] = useState(
    listing.lat && listing.lng ? { lat: listing.lat, lng: listing.lng } : null
  )
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [contactOpen, setContactOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [markingAsSold, setMarkingAsSold] = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const [soldSurveyOpen, setSoldSurveyOpen] = useState(false)

  const images = listing.images ?? []
  const isOwner = user?.id === listing.seller_id
  const isAdmin = profile?.is_admin === true

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

  // Geocode on-the-fly for housing listings that have a location but no coordinates
  useEffect(() => {
    if (!listing.is_housing || coords || !listing.location) return
    const hint = SCHOOLS.find((s) => s.id === listing.school_id)?.location ?? ''
    geocodeLocation(listing.location, hint).then((result) => {
      if (!result) return
      setCoords(result)
      // Save back to DB so we don't geocode again next time
      supabase.from('listings').update({ lat: result.lat, lng: result.lng })
        .eq('id', listing.id).then(() => {})
    })
  }, [listing.id]) // eslint-disable-line

  // Track listing view — record to Supabase for analytics and to localStorage
  // for client-side personalization (feed re-ranking, recently viewed strip)
  useEffect(() => {
    trackView(listing, listing.school_id)
    supabase.from('listing_views').insert({
      listing_id: listing.id,
      viewer_id:  user?.id ?? null,
    }).then(() => {}).catch(() => {})
  }, [listing.id]) // eslint-disable-line

  const openLightbox = (i) => {
    setLightboxIndex(i)
    setLightboxOpen(true)
  }

  const markAsSold = () => {
    // Show survey before marking — survey onAnswer callback does the actual work
    setSoldSurveyOpen(true)
  }

  const doMarkAsSold = async (soldViaUmarket) => {
    if (soldViaUmarket === null || soldViaUmarket === undefined) return // must pick an option
    setSoldSurveyOpen(false)
    setMarkingAsSold(true)
    await supabase.from('listings').update({ sold: true, sold_at: new Date().toISOString() }).eq('id', listing.id)
    const { data: profileData } = await supabase
      .from('profiles').select('sold_count').eq('id', user.id).single()
    await supabase
      .from('profiles')
      .update({ sold_count: (profileData?.sold_count ?? 0) + 1 })
      .eq('id', user.id)
    // Record the survey response
    await supabase.from('listing_outcomes').insert({
      listing_id:          listing.id,
      seller_id:           user.id,
      action:              'sold',
      sold_via_umarket:    soldViaUmarket,
      listing_title:       listing.title,
      listing_price:       listing.price ?? null,
      listing_category:    listing.category,
      school_id:           listing.school_id,
      seller_name:         seller?.name ?? null,
      seller_contact:      seller?.contact ?? null,
      seller_contact_type: seller?.contact_type ?? null,
    }).then(() => {}).catch(() => {})
    setMarkingAsSold(false)
    onBack()
  }

  const [adminDeleting, setAdminDeleting] = useState(false)
  const adminDeleteListing = async () => {
    if (!window.confirm(`Remove "${listing.title}" from the platform? This cannot be undone.`)) return
    setAdminDeleting(true)
    await supabase.from('listings').delete().eq('id', listing.id)
    setAdminDeleting(false)
    if (onAdminDelete) onAdminDelete()
    else onBack()
  }

  const handleShare = async () => {
    const shareUrl = `${APP_URL}/share/${listing.id}`
    const price = listing.price != null
      ? ` — $${Number(listing.price).toLocaleString()}${listing.is_housing ? '/mo' : ''}`
      : ''
    const smsBody = `Check out this listing on UMarket: "${listing.title}"${price}\n${shareUrl}`

    if (navigator.share) {
      try {
        await navigator.share({ title: listing.title, text: smsBody })
      } catch {
        // user cancelled — do nothing
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl)
      } catch {
        window.prompt('Copy this link:', shareUrl)
        return
      }
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2500)
    }
  }

  const formatPrice = () => {
    if (listing.is_looking) return listing.budget ? `Budget: $${Number(listing.budget).toLocaleString()}` : 'No budget listed'
    if (!listing.price || Number(listing.price) === 0) return 'Free'
    const base = `$${Number(listing.price).toLocaleString()}`
    // Housing and sublease listings show monthly rent
    return listing.is_housing ? `${base}/mo` : base
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      {/* Top bar: Back ← · · · Share */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-school-primary font-medium hover:opacity-75 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-school-primary font-semibold text-sm border border-school-primary/30 bg-school-primary/5 rounded-full px-3 py-1.5 hover:bg-school-primary/10 active:scale-95 transition-all"
          aria-label="Share listing"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
          </svg>
          Share
        </button>
      </div>

      {/* "Link copied" toast */}
      {shareToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl pointer-events-none">
          Link copied
        </div>
      )}

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

      {/* Title + price */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 leading-tight">{listing.title}</h1>
        <p className="text-3xl font-extrabold text-school-primary mt-1">{formatPrice()}</p>
        {listing.is_housing && listing.beds && (
          <p className="text-sm text-gray-500 mt-0.5">
            {listing.beds} bedroom{listing.beds !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <Chip>{getCategoryLabel(listing.category)}</Chip>
        {listing.condition && <Chip>{listing.condition}</Chip>}
        {listing.location && <Chip>{listing.location}</Chip>}
        {listing.is_housing && listing.beds && <Chip>{listing.beds} BR</Chip>}
        {listing.is_housing && listing.size && <Chip>{listing.size}</Chip>}
        {listing.is_housing && listing.avail && <Chip>Available {listing.avail}</Chip>}
        {listing.category === 'sublease' && listing.spots_available && (
          <Chip>{listing.spots_available} spot{listing.spots_available !== 1 ? 's' : ''} available</Chip>
        )}
        {listing.category === 'events' && listing.avail && <Chip>{listing.avail}</Chip>}
        {listing.boosted && <Chip accent>Featured</Chip>}
      </div>

      {/* Map preview — housing listings */}
      {listing.is_housing && coords && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Location</p>
          <MapPreview lat={coords.lat} lng={coords.lng} />
        </div>
      )}

      {/* Post ID — for reporting & boost requests */}
      <p className="text-xs text-gray-400 font-mono mb-4 select-all">
        Post ID: {listing.id.slice(0, 8).toUpperCase()}
      </p>

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
          <div className="w-12 h-12 rounded-full bg-school-primary flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden">
            {seller.avatar_url
              ? <img src={seller.avatar_url} className="w-full h-full object-cover" alt={seller.name} />
              : (seller.name?.[0]?.toUpperCase() ?? '?')
            }
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
            <p className="text-sm text-gray-400">{seller.score ?? '5.0'} · {seller.sold_count ?? 0} sold · {seller.grade ?? ''}</p>
          </div>
          <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* CTA buttons */}
      {!isOwner ? (
        <>
          <div className="flex gap-3 mb-3">
            <button
              onClick={() => onRequireAuth(() => setContactOpen(true))}
              className="flex-1 bg-school-primary text-white font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-opacity shadow-md"
            >
              I'm Interested
            </button>
            <button
              onClick={() => onRequireAuth(() => toggleFavorite(listing.id))}
              aria-label={isFavorited(listing.id) ? 'Remove from saved' : 'Save listing'}
              className={`flex items-center justify-center gap-2 px-5 py-4 rounded-2xl font-bold text-base border-2 transition-all ${
                isFavorited(listing.id)
                  ? 'bg-red-50 border-red-400 text-red-500'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <svg
                className={`w-5 h-5 transition-all ${isFavorited(listing.id) ? 'fill-red-500 text-red-500 scale-110' : 'text-gray-400'}`}
                viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {isFavorited(listing.id) ? 'Saved' : 'Save'}
            </button>
          </div>
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
          {listing.sold ? 'Marked as Sold' : markingAsSold ? 'Marking…' : 'Mark as Sold'}
        </button>
      )}

      {/* Admin: remove any listing */}
      {isAdmin && (
        <button
          onClick={adminDeleteListing}
          disabled={adminDeleting}
          className="w-full mt-3 border-2 border-red-400 text-red-500 font-bold py-3 rounded-2xl hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40 text-sm"
        >
          {adminDeleting ? 'Removing…' : '🛡️ Admin: Remove Listing'}
        </button>
      )}

      {/* Modals */}
      {lightboxOpen && (
        <Lightbox images={images} startIndex={lightboxIndex} onClose={() => setLightboxOpen(false)} />
      )}
      {contactOpen && (
        <ContactModal listing={listing} seller={seller} onClose={() => setContactOpen(false)} />
      )}
      {reportOpen && (
        <ReportModal listingId={listing.id} onClose={() => setReportOpen(false)} />
      )}
      {soldSurveyOpen && (
        <SoldSurveyModal action="sold" onAnswer={doMarkAsSold} />
      )}
    </div>
  )
}
