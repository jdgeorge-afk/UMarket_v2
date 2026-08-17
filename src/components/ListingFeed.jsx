import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { useListings } from '../hooks/useListings'
import CategoryStrip from './CategoryStrip'
import FilterBar from './FilterBar'
import ListingCard from './ListingCard'
import AdCard from './AdCard'
import PremiumAdBlock from './PremiumAdBlock'
import SectionTabs from './SectionTabs'
import { useAds } from '../hooks/useAds'

const AD_INTERVAL = 8

/**
 * Translate the encoded activeFilter into useListings params.
 *
 * - All tab:           no filter → shows everything
 * - Housing section:  only housing/sublease categories
 * - Marketplace:      exclude housing AND looking_for rows
 * - Looking For:      only looking_for category (handled by LookingForPage)
 */
function resolveListingFilter(activeFilter) {
  if (!activeFilter || activeFilter === 'all') return {}

  // Housing section: top-level shows all housing types; sub-tabs drill down
  if (activeFilter === 'housing')
    return { categoryIn: ['housing', 'sublease', 'looking_housing', 'looking_roommate'] }
  if (activeFilter === 'housing:landlord')    return { category: 'housing' }
  if (activeFilter === 'housing:sublease')    return { category: 'sublease' }
  if (activeFilter === 'housing:roommates')   return { category: 'looking_roommate' }
  if (activeFilter === 'housing:looking_for') return { category: 'looking_housing' }

  // Events top-level tab
  if (activeFilter === 'events')             return { category: 'events' }

  // Looking For section: exact category match
  if (activeFilter === 'looking_for')        return { category: 'looking_for' }

  // Marketplace section: exclude housing rows AND looking_for rows
  if (activeFilter === 'marketplace')        return { noHousing: true, noLooking: true }
  if (activeFilter.startsWith('marketplace:')) {
    return { category: activeFilter.split(':')[1], noHousing: true, noLooking: true }
  }

  return {}
}

// Section title shown in the filter bar / heading
function filterToLabel(activeFilter) {
  const map = {
    all:                       'All Listings',
    housing:                          'All Housing',
    'housing:landlord':               'Housing by Landlord',
    'housing:sublease':               'Sublease by Tenant',
    'housing:roommates':              'Looking for Roommates',
    'housing:looking_for':            'Looking for Housing',
    events:                    'Events',
    looking_for:               'Looking For',
    marketplace:               'Marketplace',
    'marketplace:misc':        'Misc',
    'marketplace:clothing':    'Clothing',
    'marketplace:sports':      'Sports',
    'marketplace:textbooks':   'Textbooks',
    'marketplace:furniture':   'Furniture',
    'marketplace:electronics': 'Electronics',
    'marketplace:events':      'Events',
  }
  return map[activeFilter] ?? 'Listings'
}

// ── Events category banner ─────────────────────────────────────────────────────
function EventsBanner() {
  return (
    <div className="mx-4 mb-2 rounded-2xl overflow-hidden bg-gradient-to-r from-school-primary to-school-primary/70 px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="text-white font-extrabold text-lg leading-tight">
          Tickets. Passes. A good time.
        </p>
        <p className="text-white/80 text-sm mt-0.5">
          Buy and sell tickets, passes, experiences, and promote events from students at your school.
        </p>
      </div>
      <div className="shrink-0 text-3xl select-none" aria-hidden="true">
        <svg className="w-10 h-10 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a3 3 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
        </svg>
      </div>
    </div>
  )
}

function injectAds(listings, baseAds, premiumAd) {
  const result = []
  let adCount = 0
  listings.forEach((listing, i) => {
    result.push({ type: 'listing', data: listing, key: listing.id })
    if (i === 5 && premiumAd) {
      result.push({ type: 'premium', data: premiumAd, key: 'premium-ad' })
    }
    if (baseAds.length > 0 && (i + 1) % AD_INTERVAL === 0) {
      result.push({ type: 'ad', data: baseAds[adCount % baseAds.length], key: `ad-${adCount}` })
      adCount++
    }
  })
  return result
}

function FeedSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse border border-gray-100">
          <div className="aspect-square bg-gray-200" />
          <div className="p-3 space-y-2">
            <div className="h-3.5 bg-gray-200 rounded w-4/5" />
            <div className="h-4 bg-gray-200 rounded w-2/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Events page ───────────────────────────────────────────────────────────────
function EventsPage({ onOpenListing, onRequireAuth, onPostOpen }) {
  const { school } = useSchool()
  const { listings, loading, error } = useListings({ category: 'events' })

  return (
    <div>
      {/* Hero */}
      <div className="px-4 sm:px-8 pt-10 pb-6 text-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-school-primary mb-3">Events</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 leading-tight max-w-xl mx-auto">
          Tickets. Passes.<br />
          <span className="text-school-primary">A good time.</span>
        </h1>
        <p className="text-gray-400 text-base mt-4 max-w-md mx-auto">
          Buy and sell tickets, passes, experiences, and promote events from students at {school?.shortName ?? 'your school'}.
        </p>
        <button
          onClick={() => onRequireAuth(() => onPostOpen?.())}
          className="mt-6 inline-flex items-center gap-2 bg-school-primary text-white font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity shadow-sm"
        >
          Post an Event
        </button>
      </div>

      <div className="p-4">
        {loading && <FeedSkeleton />}
        {error && (
          <div className="text-center py-12 text-red-400">
            <p className="font-medium">Failed to load events</p>
          </div>
        )}
        {!loading && !error && listings.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="font-semibold text-gray-600 text-lg">No events yet</p>
            <p className="text-sm mt-1">Be the first to post an event or sell tickets!</p>
            <button
              onClick={() => onRequireAuth(() => onPostOpen?.())}
              className="mt-4 bg-school-primary text-white font-semibold px-5 py-2.5 rounded-xl hover:opacity-90"
            >
              Post an Event
            </button>
          </div>
        )}
        {!loading && listings.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {listings.map((item) => (
              <ListingCard key={item.id} listing={item} onOpen={onOpenListing} onRequireAuth={onRequireAuth} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Looking For page — "For You" feed ─────────────────────────────────────────
function LookingForPage({ onOpenListing, onRequireAuth, onPostOpen }) {
  const { school } = useSchool()
  const { listings, loading, error } = useListings({ category: 'looking_for' })

  return (
    <div>
      {/* Hero */}
      <div className="px-4 sm:px-8 pt-10 pb-6 text-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-school-primary mb-3">Looking For</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 leading-tight max-w-xl mx-auto">
          Post what you need.<br />
          <span className="text-school-primary">Let your campus</span> come to you.
        </h1>
        <p className="text-gray-400 text-base mt-4 max-w-md mx-auto">
          Tell students what you're searching for — housing, textbooks, gear, and more.
        </p>
        <button
          onClick={() => onRequireAuth(() => onPostOpen?.())}
          className="mt-6 inline-flex items-center gap-2 bg-school-primary text-white font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity shadow-sm"
        >
          Post a Need
        </button>
      </div>

      <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          See What People Are Looking For
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </h2>
      </div>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100">
              <div className="h-4 bg-gray-200 rounded w-3/5 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-2/5" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-400">
          <p className="font-medium">Failed to load</p>
          <p className="text-sm opacity-70">{error}</p>
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="font-semibold text-gray-600 text-lg">No requests yet</p>
          <p className="text-sm mt-1">Be the first to post what you're looking for!</p>
          <button
            onClick={() => onRequireAuth(() => onPostOpen?.())}
            className="mt-4 bg-school-primary text-white font-semibold px-5 py-2.5 rounded-xl hover:opacity-90"
          >
            Post a Need
          </button>
        </div>
      )}

      {!loading && listings.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {listings.map((item) => (
            <ListingCard
              key={item.id}
              listing={item}
              onOpen={onOpenListing}
              onRequireAuth={onRequireAuth}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

// ── Section hero banners (Housing / Marketplace) ──────────────────────────────
function SectionHero({ activeFilter, onPostOpen, onRequireAuth }) {
  const config = {
    housing: {
      eyebrow: 'Housing',
      headline: ['Find roommates, subleases,', 'and your next place near campus.'],
      highlight: 1, // which line gets the school color
      sub: 'Real listings posted by real students at your school.',
      cta: 'Post a Housing Listing',
    },
    marketplace: {
      eyebrow: 'Marketplace',
      headline: ['Buy and sell textbooks,', 'furniture, electronics, and more.'],
      highlight: 0,
      sub: 'Your campus secondhand market — fast, local, and free to list.',
      cta: 'Post a Listing',
    },
  }

  const section =
    activeFilter === 'housing' || activeFilter?.startsWith('housing:') ? 'housing'
    : activeFilter === 'marketplace' || activeFilter?.startsWith('marketplace:') ? 'marketplace'
    : null

  if (!section) return null

  const { eyebrow, headline, highlight, sub, cta } = config[section]

  return (
    <div className="px-4 sm:px-8 pt-10 pb-6 text-center">
      <p className="text-xs font-semibold tracking-widest uppercase text-school-primary mb-3">{eyebrow}</p>
      <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 leading-tight max-w-xl mx-auto">
        {headline.map((line, i) => (
          <span key={i} className={i === highlight ? 'text-school-primary' : ''}>
            {line}{i < headline.length - 1 && <br />}
          </span>
        ))}
      </h1>
      <p className="text-gray-400 text-base mt-4 max-w-md mx-auto">{sub}</p>
      <button
        onClick={() => onRequireAuth(() => onPostOpen?.())}
        className="mt-6 inline-flex items-center gap-2 bg-school-primary text-white font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity shadow-sm"
      >
        {cta}
      </button>
    </div>
  )
}

// ── Main feed ─────────────────────────────────────────────────────────────────
export default function ListingFeed({
  favoritesOnly = false,
  activeFilter = 'all',
  onFilter,
  sortBy,
  onSort,
  searchQuery,
  onOpenListing,
  onRequireAuth,
  onPostOpen,
  onAdvertiseOpen,
}) {
  const { user } = useAuth()
  // Initialize filter state from URL params so shareable links work
  const [minPrice, setMinPrice]       = useState(() => new URLSearchParams(window.location.search).get('min') ?? '')
  const [maxPrice, setMaxPrice]       = useState(() => new URLSearchParams(window.location.search).get('max') ?? '')
  const [conditions, setConditions]   = useState(() => { const v = new URLSearchParams(window.location.search).get('cond'); return v ? v.split(',') : [] })
  const [clothingSizes, setClothingSizes] = useState(() => { const v = new URLSearchParams(window.location.search).get('sizes'); return v ? v.split(',') : [] })
  const [genders, setGenders]         = useState(() => { const v = new URLSearchParams(window.location.search).get('cg'); return v ? v.split(',') : [] })
  const [minBeds, setMinBeds]         = useState(() => { const v = new URLSearchParams(window.location.search).get('beds'); return v ? Number(v) : null })
  const [minBaths, setMinBaths]       = useState(() => { const v = new URLSearchParams(window.location.search).get('baths'); return v ? Number(v) : null })
  const [minSpots, setMinSpots]       = useState(() => { const v = new URLSearchParams(window.location.search).get('spots'); return v ? Number(v) : null })
  const [genderPref, setGenderPref]   = useState(() => new URLSearchParams(window.location.search).get('gender') ?? null)
  const [listedWithin, setListedWithin] = useState(() => new URLSearchParams(window.location.search).get('within') ?? null)
  const [verifiedOnly, setVerifiedOnly] = useState(() => new URLSearchParams(window.location.search).get('verified') === '1')
  const [hasPhotos, setHasPhotos]     = useState(() => new URLSearchParams(window.location.search).get('photos') === '1')

  // Sync filter state → URL so filters are shareable and survive refresh
  const FILTER_PARAMS = ['min', 'max', 'beds', 'baths', 'spots', 'within', 'gender', 'photos', 'verified', 'cond', 'sizes', 'cg']
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    FILTER_PARAMS.forEach((k) => p.delete(k))
    if (minPrice !== '') p.set('min', minPrice)
    if (maxPrice !== '') p.set('max', maxPrice)
    if (minBeds !== null) p.set('beds', String(minBeds))
    if (minBaths !== null) p.set('baths', String(minBaths))
    if (minSpots !== null) p.set('spots', String(minSpots))
    if (listedWithin) p.set('within', listedWithin)
    if (genderPref) p.set('gender', genderPref)
    if (hasPhotos) p.set('photos', '1')
    if (verifiedOnly) p.set('verified', '1')
    if (conditions.length > 0) p.set('cond', conditions.join(','))
    if (clothingSizes.length > 0) p.set('sizes', clothingSizes.join(','))
    if (genders.length > 0) p.set('cg', genders.join(','))
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : '/')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minPrice, maxPrice, minBeds, minBaths, minSpots, listedWithin, genderPref, hasPhotos, verifiedOnly, conditions.join(','), clothingSizes.join(','), genders.join(',')])

  const toggleCondition = (c) =>
    setConditions((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])
  const toggleClothingSize = (s) =>
    setClothingSizes((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  const toggleGender = (g) =>
    setGenders((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])

  const clearExtraFilters = () => {
    setMinPrice(''); setMaxPrice(''); setConditions([]); setClothingSizes([]); setGenders([])
    setMinBeds(null); setMinBaths(null); setMinSpots(null); setGenderPref(null)
    setListedWithin(null); setVerifiedOnly(false); setHasPhotos(false)
  }
  const hasExtraFilters = minPrice !== '' || maxPrice !== '' || conditions.length > 0 || clothingSizes.length > 0 || genders.length > 0 || minBeds !== null || minBaths !== null || minSpots !== null || genderPref !== null || listedWithin !== null || verifiedOnly || hasPhotos

  const { baseAds, pinnedAd, premiumAd } = useAds()

  // useListings must be called unconditionally (Rules of Hooks) — before any early returns
  const listingFilter = resolveListingFilter(activeFilter)
  const { listings: rawListings, loading, error } = useListings({
    ...listingFilter,
    sortBy,
    searchQuery,
    favoritesOnly,
    userId: user?.id,
    minPrice: minPrice !== '' ? Number(minPrice) : null,
    maxPrice: maxPrice !== '' ? Number(maxPrice) : null,
    conditions: conditions.length > 0 ? conditions : null,
    clothingSizes: clothingSizes.length > 0 ? clothingSizes : null,
    genders: genders.length > 0 ? genders : null,
    minBeds,
    minSpots,
    listedWithin,
    userType: null,
  })

  // Client-side filters
  const listings = rawListings.filter((l) => {
    if (verifiedOnly && !l.profiles?.verified) return false
    if (hasPhotos && (!l.images || l.images.length === 0)) return false
    if (minBaths !== null) {
      const b = parseFloat(l.size)
      if (isNaN(b) || b < minBaths) return false
    }
    if (genderPref !== null && l.gender !== genderPref) return false
    return true
  })

  // Events tab gets its own full-page component
  if (!favoritesOnly && !searchQuery && activeFilter === 'events') {
    return (
      <>
        <div className="lg:hidden sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm">
          <SectionTabs activeFilter={activeFilter} onFilter={onFilter} onAdvertiseOpen={onAdvertiseOpen} />
        </div>
        <EventsPage
          onOpenListing={onOpenListing}
          onRequireAuth={onRequireAuth}
          onPostOpen={onPostOpen}
        />
      </>
    )
  }

  // "For You" / Looking For tab gets its own full-page component
  if (!favoritesOnly && !searchQuery && activeFilter === 'looking_for') {
    return (
      <>
        <div className="lg:hidden sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm">
          <SectionTabs activeFilter={activeFilter} onFilter={onFilter} onAdvertiseOpen={onAdvertiseOpen} />
        </div>
        <LookingForPage
          onOpenListing={onOpenListing}
          onRequireAuth={onRequireAuth}
          onPostOpen={onPostOpen}
        />
      </>
    )
  }

  const items = injectAds(listings, baseAds, premiumAd)

  return (
    <div>
      {/* ── Section tabs — mobile only (desktop uses header nav) ──────────────── */}
      {!favoritesOnly && (
        <div className="lg:hidden sticky top-16 z-30 bg-white border-b border-gray-100 shadow-sm">
          <SectionTabs activeFilter={activeFilter} onFilter={onFilter} onAdvertiseOpen={onAdvertiseOpen} />
        </div>
      )}

      {/* ── Section hero (Housing / Marketplace) ─────────────────────────────── */}
      {!favoritesOnly && !searchQuery && (
        <SectionHero
          activeFilter={activeFilter}
          onPostOpen={onPostOpen}
          onRequireAuth={onRequireAuth}
        />
      )}

      {/* ── Events banner ────────────────────────────────────────────────────── */}
      {activeFilter === 'marketplace:events' && !favoritesOnly && !searchQuery && (
        <EventsBanner />
      )}

      {/* ── Mobile subcategory pills — below the hero, above the listing grid ── */}
      {!favoritesOnly && <CategoryStrip activeFilter={activeFilter} onFilter={onFilter} />}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <FilterBar
        sortBy={sortBy}
        onSort={onSort}
        activeFilter={activeFilter}
        onClearFilter={() => { onFilter('all'); clearExtraFilters() }}
        totalCount={listings.length}
        label={filterToLabel(activeFilter)}
        minPrice={minPrice}
        maxPrice={maxPrice}
        conditions={conditions}
        onMinPrice={setMinPrice}
        onMaxPrice={setMaxPrice}
        onToggleCondition={toggleCondition}
        clothingSizes={clothingSizes}
        genders={genders}
        onToggleClothingSize={toggleClothingSize}
        onToggleGender={toggleGender}
        minBeds={minBeds}
        onMinBeds={setMinBeds}
        minBaths={minBaths}
        onMinBaths={setMinBaths}
        minSpots={minSpots}
        onMinSpots={setMinSpots}
        genderPref={genderPref}
        onGenderPref={setGenderPref}
        listedWithin={listedWithin}
        onListedWithin={setListedWithin}
        verifiedOnly={verifiedOnly}
        onVerifiedOnly={setVerifiedOnly}
        hasPhotos={hasPhotos}
        onHasPhotos={setHasPhotos}
        onClearExtraFilters={clearExtraFilters}
        hasExtraFilters={hasExtraFilters}
      />

      {/* ── Feed content ─────────────────────────────────────────────────────── */}
      {loading && <FeedSkeleton />}

      {error && (
        <div className="text-center py-16 text-red-400">
          <p className="font-medium">Failed to load listings</p>
          <p className="text-sm mt-1 opacity-70">{error}</p>
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">
            {''}
          </p>
          <p className="font-semibold text-gray-600 text-lg">
            {favoritesOnly
              ? 'No saved listings yet'
              : searchQuery
              ? `No results for "${searchQuery}"`
              : 'No listings yet — be the first to post!'}
          </p>
          {!favoritesOnly && (
            <button
              onClick={() => onRequireAuth(() => onPostOpen?.())}
              className="mt-4 bg-school-primary text-white font-semibold px-5 py-2.5 rounded-xl hover:opacity-90"
            >
              Post a Listing
            </button>
          )}
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 p-4">
          {pinnedAd && <AdCard ad={pinnedAd} />}
          {items.map((item) =>
            item.type === 'premium' ? (
              <PremiumAdBlock key={item.key} ad={item.data} />
            ) : item.type === 'ad' ? (
              <AdCard key={item.key} ad={item.data} />
            ) : (
              <ListingCard
                key={item.key}
                listing={item.data}
                onOpen={onOpenListing}
                onRequireAuth={onRequireAuth}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
