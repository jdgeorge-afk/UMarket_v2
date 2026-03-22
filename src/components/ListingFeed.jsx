import { useAuth } from '../context/AuthContext'
import { useListings } from '../hooks/useListings'
import CategoryStrip from './CategoryStrip'
import FilterBar from './FilterBar'
import ListingCard from './ListingCard'
import AdCard from './AdCard'
import HeroBanner from './HeroBanner'
import StatsRow from './StatsRow'
import LookingForStrip from './LookingForStrip'

const AD_INTERVAL = 8

// Map the encoded activeFilter to what useListings expects
function filterToCategory(activeFilter) {
  if (!activeFilter || activeFilter === 'all') return 'all'
  if (activeFilter === 'housing') return 'housing'
  if (activeFilter === 'housing:sublease') return 'sublease'
  if (activeFilter === 'housing:looking_for') return 'looking_housing'
  if (activeFilter === 'looking_for') return 'looking_for'
  if (activeFilter === 'marketplace') return 'all'
  if (activeFilter.startsWith('marketplace:')) return activeFilter.split(':')[1]
  return 'all'
}

// Section title shown in the filter bar / heading
function filterToLabel(activeFilter) {
  const map = {
    all: 'All Listings',
    housing: 'Housing',
    'housing:sublease': 'Subleases',
    'housing:looking_for': 'Looking for Housing',
    looking_for: 'Looking For',
    marketplace: 'Marketplace',
    'marketplace:misc': 'Misc',
    'marketplace:clothing': 'Clothing',
    'marketplace:sports': 'Sports',
    'marketplace:textbooks': 'Textbooks',
    'marketplace:furniture': 'Furniture',
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
  const { listings, loading, error } = useListings({ category: 'looking_for' })

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">🔍 See What People Are Looking For</h2>
        </div>
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
        <div className="space-y-3">
          {listings.map((item) => (
            <button
              key={item.id}
              onClick={() => onOpenListing(item)}
              className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow text-left"
            >
              <span className="text-2xl shrink-0">🔍</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.title}</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  {item.profiles?.name?.split(' ')[0] ?? 'Someone'}
                  {item.budget ? ` · Budget $${Number(item.budget).toLocaleString()}` : ''}
                </p>
              </div>
              {item.budget && (
                <span className="shrink-0 bg-school-primary/10 text-school-primary text-sm font-semibold px-3 py-1 rounded-full">
                  ${Number(item.budget).toLocaleString()}
                </span>
              )}
              <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Top-level section tab bar ──────────────────────────────────────────────────
function SectionTabs({ activeFilter, onFilter }) {
  const tabs = [
    { label: 'All',              value: 'all'         },
    { label: 'Housing',          value: 'housing'     },
    { label: 'Marketplace',      value: 'marketplace' },
    { label: 'Looking For',      value: 'looking_for' },
  ]

  const activeTop =
    activeFilter === 'all'                                    ? 'all'
    : activeFilter === 'housing' || activeFilter?.startsWith('housing:') ? 'housing'
    : activeFilter === 'marketplace' || activeFilter?.startsWith('marketplace:') ? 'marketplace'
    : activeFilter === 'looking_for'                          ? 'looking_for'
    : 'all'

  return (
    <div className="flex items-center gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => {
        const active = activeTop === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => onFilter(tab.value)}
            className={[
              'px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-colors border',
              active
                ? 'bg-school-primary text-white border-school-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
            ].join(' ')}
          >
            {tab.label}
          </button>
        )
      })}
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

  const category = filterToCategory(activeFilter)
  const { listings, loading, error } = useListings({
    category,
    sortBy,
    searchQuery,
    favoritesOnly,
    userId: user?.id,
  })

  const items = injectAds(listings)
  const isAllTab = !favoritesOnly && !searchQuery && activeFilter === 'all'
  const isHousingTab = !favoritesOnly && !searchQuery && activeFilter === 'housing'

  return (
    <div>
      {/* ── Section tabs — always at the very top ───────────────────────────── */}
      {!favoritesOnly && <SectionTabs activeFilter={activeFilter} onFilter={onFilter} />}

      {/* ── Mobile sub-category chips ────────────────────────────────────────── */}
      {!favoritesOnly && <CategoryStrip activeFilter={activeFilter} onFilter={onFilter} />}

      {/* ── Hero + stats — only on the main All tab ─────────────────────────── */}
      {isAllTab && (
        <>
          <HeroBanner
            onBrowseHousing={() => onFilter('housing')}
            onPostNeed={() => onRequireAuth(() => onPostOpen?.())}
          />
          <StatsRow onFilter={onFilter} />
          <LookingForStrip
            onOpenListing={onOpenListing}
            onFilter={onFilter}
            onPostOpen={() => onRequireAuth(() => onPostOpen?.())}
          />
        </>
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
