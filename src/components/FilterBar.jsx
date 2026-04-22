import { useState, useRef, useEffect } from 'react'

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor']
const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
const GENDERS = ["Men's", "Women's", 'Unisex']

// Build the sort options relevant to the current section.
// Global sorts always appear; housing/marketplace sorts are context-specific.
function getSortOptions(activeFilter) {
  const isHousing    = activeFilter === 'housing'     || activeFilter?.startsWith('housing:')
  const isMarketplace = activeFilter === 'marketplace' || activeFilter?.startsWith('marketplace:')
  return [
    { value: 'newest',         label: 'Newest' },
    { value: 'price_asc',      label: 'Price: Low → High' },
    { value: 'price_desc',     label: 'Price: High → Low' },
    { value: 'popular',        label: 'Most Popular' },
    { value: 'viewed',         label: 'Most Viewed' },
    ...(isHousing ? [
      { value: 'avail_asc',    label: 'Available Soonest' },
      { value: 'beds_asc',     label: 'Beds: Fewest → Most' },
      { value: 'beds_desc',    label: 'Beds: Most → Fewest' },
    ] : []),
    ...(isMarketplace ? [
      { value: 'condition_best', label: 'Condition: Best First' },
    ] : []),
  ]
}

export default function FilterBar({
  sortBy, onSort,
  activeFilter, onClearFilter,
  totalCount, label,
  minPrice, maxPrice, conditions,
  onMinPrice, onMaxPrice, onToggleCondition,
  clothingSizes, genders, onToggleClothingSize, onToggleGender,
  onClearExtraFilters, hasExtraFilters,
}) {
  const isClothing = activeFilter === 'marketplace:clothing'
  const hasFilter = (activeFilter && activeFilter !== 'all') || hasExtraFilters
  const sortOptions = getSortOptions(activeFilter)
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function handle(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="flex items-center gap-2 px-4 py-2 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900 text-base">{label ?? 'All Listings'}</span>
        {totalCount !== undefined && (
          <span className="text-sm text-gray-400">{totalCount} listings</span>
        )}
        {hasFilter && (
          <button
            onClick={onClearFilter}
            className="flex items-center gap-1 bg-school-primary/10 text-school-primary text-xs font-medium px-2 py-0.5 rounded-full hover:bg-school-primary/20 transition-colors"
          >
            {label} ×
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2 relative" ref={panelRef}>
        {/* Filters button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className={[
            'flex items-center gap-1 text-sm border px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 transition-colors',
            hasExtraFilters
              ? 'border-school-primary text-school-primary font-semibold'
              : 'border-gray-200 text-gray-500',
          ].join(' ')}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
          </svg>
          Filters{hasExtraFilters ? ' •' : ''}
        </button>

        {/* Filter panel */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 p-4 space-y-4">

            {/* Price range */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Price Range</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Min $"
                  value={minPrice}
                  onChange={(e) => onMinPrice(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
                />
                <span className="text-gray-400 shrink-0">–</span>
                <input
                  type="number"
                  min="0"
                  placeholder="Max $"
                  value={maxPrice}
                  onChange={(e) => onMaxPrice(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
                />
              </div>
            </div>

            {/* Condition */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Condition</p>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => {
                  const active = conditions.includes(c)
                  return (
                    <button
                      key={c}
                      onClick={() => onToggleCondition(c)}
                      className={[
                        'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                        active
                          ? 'bg-school-primary text-white border-school-primary'
                          : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300',
                      ].join(' ')}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Clothing size */}
            {isClothing && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Size</p>
                <div className="flex flex-wrap gap-2">
                  {CLOTHING_SIZES.map((s) => {
                    const active = clothingSizes.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() => onToggleClothingSize(s)}
                        className={[
                          'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                          active
                            ? 'bg-school-primary text-white border-school-primary'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300',
                        ].join(' ')}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Gender */}
            {isClothing && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Gender</p>
                <div className="flex flex-wrap gap-2">
                  {GENDERS.map((g) => {
                    const active = genders.includes(g)
                    return (
                      <button
                        key={g}
                        onClick={() => onToggleGender(g)}
                        className={[
                          'px-3 py-1 rounded-full text-xs font-semibold border transition-colors',
                          active
                            ? 'bg-school-primary text-white border-school-primary'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300',
                        ].join(' ')}
                      >
                        {g}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <button
                onClick={() => { onClearExtraFilters(); setOpen(false) }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Clear filters
              </button>
              <button
                onClick={() => setOpen(false)}
                className="bg-school-primary text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:opacity-90"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        <select
          value={sortBy}
          onChange={(e) => onSort(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-school-primary"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
