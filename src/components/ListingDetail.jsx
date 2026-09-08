import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { useFavorites } from '../hooks/useFavorites'
import { useListings } from '../hooks/useListings'
import { trackView } from '../lib/personalization'
import Lightbox from './Lightbox'
import ContactModal from './ContactModal'
import ReportModal from './ReportModal'
import SoldSurveyModal from './SoldSurveyModal'
import MapPreview from './MapPreview'
import ListingCard from './ListingCard'
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

function formatPrice(listing) {
  if (listing.is_looking) return listing.budget ? `Budget: $${Number(listing.budget).toLocaleString()}` : 'No budget listed'
  if (!listing.price || Number(listing.price) === 0) return 'Free'
  const base = `$${Number(listing.price).toLocaleString()}`
  return listing.is_housing ? `${base}/mo` : base
}

// ── Photo grid — SubletBuff style ─────────────────────────────────────────────
function PhotoGrid({ images, onOpen }) {
  if (!images.length) return null

  if (images.length === 1) {
    return (
      <div className="rounded-2xl overflow-hidden cursor-pointer mb-6" onClick={() => onOpen(0)}>
        <img src={images[0]} alt="Photo 1" className="w-full max-h-[480px] object-cover" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[2fr_1fr] gap-2 mb-6 rounded-2xl overflow-hidden cursor-pointer" style={{ maxHeight: 480 }}>
      {/* Main large photo */}
      <div className="overflow-hidden" onClick={() => onOpen(0)}>
        <img src={images[0]} alt="Photo 1" className="w-full h-full object-cover" />
      </div>
      {/* Right stack */}
      <div className="flex flex-col gap-2">
        {images.slice(1, 3).map((img, i) => (
          <div
            key={i}
            className="relative flex-1 overflow-hidden"
            onClick={() => onOpen(i + 1)}
          >
            <img src={img} alt={`Photo ${i + 2}`} className="w-full h-full object-cover" />
            {/* +N more overlay on last visible slot */}
            {i === 1 && images.length > 3 && (
              <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white font-bold text-xl">
                +{images.length - 3}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── "You Might Also Like" strip ───────────────────────────────────────────────
function SimilarListings({ listing, onOpenListing, onRequireAuth }) {
  const categoryFilter = listing.category
    ? { category: listing.category }
    : listing.is_housing
    ? { categoryIn: ['housing', 'sublease', 'looking_housing', 'looking_roommate'] }
    : { noHousing: true, noLooking: true }

  const { listings } = useListings({ ...categoryFilter, sortBy: 'newest' })
  const similar = listings.filter((l) => l.id !== listing.id).slice(0, 4)

  if (!similar.length) return null

  return (
    <div className="mt-12 border-t border-gray-100 pt-10">
      <h2 className="text-xl font-bold text-gray-900 mb-5">You Might Also Like</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {similar.map((l) => (
          <ListingCard key={l.id} listing={l} onOpen={onOpenListing} onRequireAuth={onRequireAuth} />
        ))}
      </div>
    </div>
  )
}

// ── Detail meta row item ───────────────────────────────────────────────────────
function Meta({ icon, children }) {
  return (
    <span className="flex items-center gap-1.5 text-sm text-gray-600">
      {icon}
      {children}
    </span>
  )
}

export default function ListingDetail({ listing, onBack, onOpenListing, onOpenProfile, onRequireAuth, onAdminDelete }) {
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

  useEffect(() => {
    if (!listing.is_housing || coords || !listing.location) return
    const hint = SCHOOLS.find((s) => s.id === listing.school_id)?.location ?? ''
    geocodeLocation(listing.location, hint).then((result) => {
      if (!result) return
      setCoords(result)
      supabase.from('listings').update({ lat: result.lat, lng: result.lng })
        .eq('id', listing.id).then(() => {})
    })
  }, [listing.id]) // eslint-disable-line

  useEffect(() => {
    trackView(listing, listing.school_id)
    supabase.from('listing_views').insert({
      listing_id: listing.id,
      viewer_id:  user?.id ?? null,
    }).then(() => {}).catch(() => {})
  }, [listing.id]) // eslint-disable-line

  const openLightbox = (i) => { setLightboxIndex(i); setLightboxOpen(true) }

  const markAsSold = () => setSoldSurveyOpen(true)

  const doMarkAsSold = async (soldViaUmarket) => {
    if (soldViaUmarket === null || soldViaUmarket === undefined) return
    setSoldSurveyOpen(false)
    setMarkingAsSold(true)
    await supabase.from('listings').update({ sold: true, sold_at: new Date().toISOString() }).eq('id', listing.id)
    const { data: profileData } = await supabase
      .from('profiles').select('sold_count').eq('id', user.id).single()
    await supabase
      .from('profiles')
      .update({ sold_count: (profileData?.sold_count ?? 0) + 1 })
      .eq('id', user.id)
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
      try { await navigator.share({ title: listing.title, text: smsBody }) } catch {}
    } else {
      try { await navigator.clipboard.writeText(shareUrl) } catch {
        window.prompt('Copy this link:', shareUrl); return
      }
      setShareToast(true)
      setTimeout(() => setShareToast(false), 2500)
    }
  }

  const priceLabel = formatPrice(listing)

  // ── Sidebar contact card ──────────────────────────────────────────────────
  const ContactSidebar = (
    <div className="space-y-4">
      {/* Seller card */}
      {seller && (
        <div className="border border-gray-200 rounded-2xl p-5">
          <button
            onClick={() => onOpenProfile(listing.seller_id)}
            className="flex items-center gap-3 w-full text-left group mb-4"
          >
            <div className="w-12 h-12 rounded-full bg-school-primary flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden">
              {seller.avatar_url
                ? <img src={seller.avatar_url} className="w-full h-full object-cover" alt={seller.name} />
                : (seller.name?.[0]?.toUpperCase() ?? '?')
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap">
                {seller.name}
                {seller.verified && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-400">{seller.grade ?? ''} · {seller.sold_count ?? 0} sold</p>
            </div>
          </button>

          {!isOwner ? (
            <div className="space-y-2">
              <button
                onClick={() => onRequireAuth(() => setContactOpen(true))}
                className="w-full bg-school-primary text-white font-bold py-3 rounded-xl text-sm hover:opacity-90 transition-opacity shadow-sm"
              >
                Message {seller.name?.split(' ')[0] ?? 'Seller'}
              </button>
              <button
                onClick={() => onRequireAuth(() => toggleFavorite(listing.id))}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm border-2 transition-all ${
                  isFavorited(listing.id)
                    ? 'bg-red-50 border-red-400 text-red-500'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <svg
                  className={`w-4 h-4 ${isFavorited(listing.id) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`}
                  viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {isFavorited(listing.id) ? 'Saved' : 'Save'}
              </button>
            </div>
          ) : (
            <button
              onClick={markAsSold}
              disabled={markingAsSold || listing.sold}
              className="w-full border-2 border-school-primary text-school-primary font-bold py-3 rounded-xl text-sm hover:bg-school-primary hover:text-white transition-colors disabled:opacity-40"
            >
              {listing.sold ? 'Marked as Sold' : markingAsSold ? 'Marking…' : 'Mark as Sold'}
            </button>
          )}
        </div>
      )}

      {/* Listing details card */}
      {listing.is_housing && listing.price > 0 && (
        <div className="border border-gray-200 rounded-2xl p-5">
          <p className="font-semibold text-gray-900 mb-3">Listing Details</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Monthly Rent</span>
              <span className="font-semibold text-gray-900">${Number(listing.price).toLocaleString()}/mo</span>
            </div>
            {listing.avail && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Available</span>
                <span className="font-semibold text-gray-900">{listing.avail}</span>
              </div>
            )}
            {listing.beds && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Bedrooms</span>
                <span className="font-semibold text-gray-900">{listing.beds}</span>
              </div>
            )}
            {listing.size && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Bathrooms</span>
                <span className="font-semibold text-gray-900">{listing.size}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin */}
      {isAdmin && (
        <button
          onClick={adminDeleteListing}
          disabled={adminDeleting}
          className="w-full border-2 border-red-400 text-red-500 font-bold py-3 rounded-xl text-sm hover:bg-red-500 hover:text-white transition-colors disabled:opacity-40"
        >
          {adminDeleting ? 'Removing…' : '🛡️ Admin: Remove Listing'}
        </button>
      )}
    </div>
  )

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 pb-24 lg:pb-8" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>

      {/* Back link */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm font-medium mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Listings
      </button>

      {/* Photo grid */}
      <PhotoGrid images={images} onOpen={openLightbox} />

      {/* Two-column layout on desktop */}
      <div className="lg:grid lg:grid-cols-[1fr_340px] lg:gap-10">

        {/* ── Left: main content ──────────────────────────────────────────── */}
        <div>
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 bg-gray-50">
              {getCategoryLabel(listing.category)}
            </span>
            {listing.condition && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold border border-gray-200 text-gray-600 bg-gray-50">
                {listing.condition}
              </span>
            )}
            {listing.boosted && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-school-primary/10 text-school-primary border border-school-primary/20">
                Featured
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-3">
            {listing.title}
          </h1>

          {/* Price badge */}
          <div className="mb-4">
            <span
              className="inline-block px-4 py-1.5 rounded-lg text-white font-bold text-lg"
              style={{ background: school?.primary ?? '#CC0000' }}
            >
              {priceLabel}
            </span>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 mb-6 text-gray-500">
            {listing.location && (
              <Meta icon={
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }>{listing.location}</Meta>
            )}
            {listing.is_housing && listing.beds && (
              <Meta icon={
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              }>{listing.beds} bed{listing.beds !== 1 ? 's' : ''}</Meta>
            )}
            {listing.is_housing && listing.size && (
              <Meta icon={
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }>{listing.size} bath{parseFloat(listing.size) !== 1 ? 's' : ''}</Meta>
            )}
            {listing.avail && (
              <Meta icon={
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }>Available {listing.avail}</Meta>
            )}
            {listing.category === 'sublease' && listing.spots_available && (
              <Meta icon={
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }>{listing.spots_available} spot{listing.spots_available !== 1 ? 's' : ''} available</Meta>
            )}
          </div>

          {/* Description */}
          {listing.description && (
            <div className="mb-8">
              <h2 className="text-base font-bold text-gray-900 mb-2">About This Listing</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap text-sm">{listing.description}</p>
            </div>
          )}

          {/* Map */}
          {listing.is_housing && coords && (
            <div className="mb-8">
              <h2 className="text-base font-bold text-gray-900 mb-2">Location</h2>
              <MapPreview lat={coords.lat} lng={coords.lng} />
              <p className="text-xs text-gray-400 mt-1.5">
                Approximate location — exact address shared after contact
              </p>
            </div>
          )}

          {/* Share / Report row */}
          <div className="flex items-center gap-3 flex-wrap mb-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
              </svg>
              Share
            </button>
            {!isOwner && (
              <button
                onClick={() => onRequireAuth(() => setReportOpen(true))}
                className="flex items-center gap-1 text-gray-400 text-sm hover:text-gray-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                Report this listing
              </button>
            )}
          </div>

          {/* Post ID */}
          <p className="text-xs text-gray-300 font-mono mt-2">ID: {listing.id.slice(0, 8).toUpperCase()}</p>

          {/* Mobile contact card (below content, above similar) */}
          <div className="lg:hidden mt-8">
            {ContactSidebar}
          </div>
        </div>

        {/* ── Right: sticky sidebar (desktop only) ──────────────────────── */}
        <div className="hidden lg:block">
          <div className="sticky top-20">
            {ContactSidebar}
          </div>
        </div>
      </div>

      {/* "You Might Also Like" — full width below both columns */}
      <SimilarListings
        listing={listing}
        onOpenListing={onOpenListing ?? onBack}
        onRequireAuth={onRequireAuth}
      />

      {/* "Link copied" toast */}
      {shareToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl pointer-events-none">
          Link copied
        </div>
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
