import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { useListings } from '../hooks/useListings'
import CategoryStrip from './CategoryStrip'
import FilterBar from './FilterBar'
import ListingCard from './ListingCard'
import AdCard from './AdCard'
import SectionTabs from './SectionTabs'

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

  // Housing section: top-level shows housing + sublease; sub-tabs drill down
  if (activeFilter === 'housing')            return { categoryIn: ['housing', 'sublease'] }
  if (activeFilter === 'housing:sublease')   return { category: 'sublease' }
  if (activeFilter === 'housing:looking_for') return { category: 'looking_housing' }

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
    housing:                   'Housing & Subleases',
    'housing:sublease':        'Subleases',
    'housing:looking_for':     'Looking for Housing',
    looking_for:               'Looking For',
    marketplace:               'Marketplace',
    'marketplace:misc':        'Misc',
    'marketplace:clothing':    'Clothing',
    'marketplace:sports':      'Sports',
    'marketplace:textbooks':   'Textbooks',
    'marketplace:furniture':   'Furniture',
    'marketplace:electronics': 'Electronics',
  }
  return map[activeFilter] ?? 'Listings'
}

function injectAds(listings) {
  const result = []
  let adCount = 0
  listings.forEach((listing, i) => {
    result.push({ type: 'listing', data: listing, key: listing.id })
    if ((i + 1) % AD_INTERVAL === 0) {
      result.push({ type: 'ad', adIndex: adCount++, key: `ad-${adCount}` })
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
          🔍 Post a Need
        </button>
      </div>

      <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">See What People Are Looking For</h2>
        <button
          onClick={() => onRequireAuth(() => onPostOpen?.())}
          className="bg-school-primary text-white text-sm font-semibold px-4 py-2 rounded-xl hover:opacity-90"
        >
          + Post a Need
        </button>
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
          <p className="text-3xl mb-2">⚠️</p>
          <p className="font-medium">Failed to load</p>
          <p className="text-sm opacity-70">{error}</p>
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">🔍</p>
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
      cta: '🏠 Post a Housing Listing',
    },
    marketplace: {
      eyebrow: 'Marketplace',
      headline: ['Buy and sell textbooks,', 'furniture, electronics, and more.'],
      highlight: 0,
      sub: 'Your campus secondhand market — fast, local, and free to list.',
      cta: '🛍️ Post a Listing',
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
}) {
  const { user } = useAuth()

  // "For You" / Looking For tab gets its own full-page component
  if (!favoritesOnly && !searchQuery && activeFilter === 'looking_for') {
    return (
      <>
        <SectionTabs activeFilter={activeFilter} onFilter={onFilter} />
        <LookingForPage
          onOpenListing={onOpenListing}
          onRequireAuth={onRequireAuth}
          onPostOpen={onPostOpen}
        />
      </>
    )
  }

  const listingFilter = resolveListingFilter(activeFilter)
  const { listings, loading, error } = useListings({
    ...listingFilter,
    sortBy,
    searchQuery,
    favoritesOnly,
    userId: user?.id,
  })

  const items = injectAds(listings)

  return (
    <div>
      {/* ── Section tabs ─────────────────────────────────────────────────────── */}
      {!favoritesOnly && (
        <div className="sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm">
          <SectionTabs activeFilter={activeFilter} onFilter={onFilter} />
        </div>
      )}

      {/* ── Mobile sub-category chips ────────────────────────────────────────── */}
      {!favoritesOnly && <CategoryStrip activeFilter={activeFilter} onFilter={onFilter} />}

      {/* ── Section hero (Housing / Marketplace) ─────────────────────────────── */}
      {!favoritesOnly && !searchQuery && (
        <SectionHero
          activeFilter={activeFilter}
          onPostOpen={onPostOpen}
          onRequireAuth={onRequireAuth}
        />
      )}

      {/* ── Filter bar ───────────────────────────────────────────────────────── */}
      <FilterBar
        sortBy={sortBy}
        onSort={onSort}
        activeFilter={activeFilter}
        onClearFilter={() => onFilter('all')}
        totalCount={listings.length}
        label={filterToLabel(activeFilter)}
      />

      {/* ── Feed content ─────────────────────────────────────────────────────── */}
      {loading && <FeedSkeleton />}

      {error && (
        <div className="text-center py-16 text-red-400">
          <p className="text-4xl mb-2">⚠️</p>
          <p className="font-medium">Failed to load listings</p>
          <p className="text-sm mt-1 opacity-70">{error}</p>
        </div>
      )}

      {!loading && !error && listings.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-3">
            {favoritesOnly ? '💔' : searchQuery ? '🔍' : '📭'}
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
          {items.map((item) =>
            item.type === 'ad' ? (
              <AdCard key={item.key} index={item.adIndex} />
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
