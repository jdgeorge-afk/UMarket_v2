import { useAuth } from '../context/AuthContext'
import { useListings } from '../hooks/useListings'
import CategoryStrip from './CategoryStrip'
import ListingCard from './ListingCard'
import AdCard from './AdCard'
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

// ── Looking For page ───────────────────────────────────────────────────────────
function LookingForPage({ onOpenListing, onRequireAuth, onPostOpen }) {
  const { listings, loading, error } = useListings({ category: 'looking_for' })

  return (
    <div className="p-4">
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

// ── Top-level tab bar (All / Explore Housing / Browse Marketplace) ─────────────
function TabBar({ activeFilter, onFilter }) {
  const tabs = [
    { label: 'All',                value: 'all'         },
    { label: 'Explore Housing',    value: 'housing'     },
    { label: 'Browse Marketplace', value: 'marketplace' },
  ]

  const activeTop =
    activeFilter === 'all'            ? 'all'
    : activeFilter === 'housing' || activeFilter?.startsWith('housing:') ? 'housing'
    : activeFilter === 'marketplace'  || activeFilter?.startsWith('marketplace:') ? 'marketplace'
    : 'all'

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-3 flex-wrap">
      {tabs.map((tab) => {
        const active = activeTop === tab.value
        return (
          <button
            key={tab.value}
            onClick={() => onFilter(tab.value)}
            className={[
              'px-5 py-2 rounded-full text-sm font-semibold transition-colors border',
              active
                ? 'bg-white border-school-primary text-school-primary'
                : 'bg-gray-100 border-transparent text-gray-700 hover:bg-gray-200',
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
  onSearch,
  onOpenListing,
  onRequireAuth,
  onPostOpen,
}) {
  const { user } = useAuth()

  // "For You" / Looking For tab gets its own full-page component
  if (!favoritesOnly && !searchQuery && activeFilter === 'looking_for') {
    return (
      <LookingForPage
        onOpenListing={onOpenListing}
        onRequireAuth={onRequireAuth}
        onPostOpen={onPostOpen}
      />
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

  return (
    <div>
      {/* ── Hero — only on the main All tab ────────────────────────────────── */}
      {isAllTab && (
        <div className="px-4 sm:px-8 pt-10 pb-6 text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight max-w-2xl mx-auto">
            Find housing, roommates, subleases, and student deals in one place.
          </h1>
        </div>
      )}

      {/* ── Stats cards — only on the main All tab ──────────────────────────── */}
      {isAllTab && (
        <div className="max-w-3xl mx-auto">
          <StatsRow onFilter={onFilter} />
        </div>
      )}

      {/* ── Looking For strip — only on main All tab ─────────────────────────── */}
      {isAllTab && (
        <LookingForStrip
          onOpenListing={onOpenListing}
          onFilter={onFilter}
          onPostOpen={() => onRequireAuth(() => onPostOpen?.())}
        />
      )}

      {/* ── Tab bar — always shown (except favorites) ────────────────────────── */}
      {!favoritesOnly && <TabBar activeFilter={activeFilter} onFilter={onFilter} />}

      {/* ── Mobile sub-category chips (Housing / Marketplace sub-filters) ───── */}
      {!favoritesOnly && <CategoryStrip activeFilter={activeFilter} onFilter={onFilter} />}

      {/* ── Search + filter bar ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 sm:px-6 py-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search listings..."
            className="w-full h-10 pl-9 pr-9 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-school-primary focus:border-school-primary"
          />
          {searchQuery && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>

        <button className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
          </svg>
          Filters
        </button>

        <select
          value={sortBy}
          onChange={(e) => onSort(e.target.value)}
          className="hidden sm:block text-sm border border-gray-200 rounded-xl px-2 py-2 bg-white text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-school-primary shrink-0"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price ↑</option>
          <option value="price_desc">Price ↓</option>
        </select>

        {listings.length > 0 && (
          <span className="hidden sm:block text-sm text-gray-400 shrink-0">{listings.length} listings</span>
        )}
      </div>

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
