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

export default function ListingFeed({
  favoritesOnly = false,
  activeCategory,
  onCategory,
  sortBy,
  onSort,
  searchQuery,
  onOpenListing,
  onRequireAuth,
  onPostOpen,
}) {
  const { user } = useAuth()
  const { listings, loading, error } = useListings({
    category: activeCategory,
    sortBy,
    searchQuery,
    favoritesOnly,
    userId: user?.id,
  })

  const items = injectAds(listings)
  const showHero = !favoritesOnly && !searchQuery && activeCategory === 'all'

  return (
    <div>
      {/* Mobile category chips */}
      <CategoryStrip activeCategory={activeCategory} onCategory={onCategory} />

      {/* Hero + stats — only on the default "All" feed */}
      {showHero && (
        <>
          <HeroBanner
            onBrowseHousing={() => onCategory('housing')}
            onPostNeed={() => onRequireAuth(() => onPostOpen?.())}
          />
          <StatsRow onCategory={onCategory} />
          <LookingForStrip
            onOpenListing={onOpenListing}
            onCategory={onCategory}
            onPostOpen={() => onRequireAuth(() => onPostOpen?.())}
          />
        </>
      )}

      {/* Filter bar */}
      <FilterBar
        sortBy={sortBy}
        onSort={onSort}
        activeCategory={activeCategory}
        onClearCategory={() => onCategory('all')}
        totalCount={listings.length}
      />

      {/* Feed content */}
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
