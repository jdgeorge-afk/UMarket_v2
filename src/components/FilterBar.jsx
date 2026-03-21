export default function FilterBar({ sortBy, onSort, activeFilter, onClearFilter, totalCount, label }) {
  const hasFilter = activeFilter && activeFilter !== 'all'

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

      <div className="ml-auto flex items-center gap-2">
        {/* Filters icon placeholder — functional sort only for now */}
        <button className="flex items-center gap-1 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
          </svg>
          Filters
        </button>

        <select
          value={sortBy}
          onChange={(e) => onSort(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-school-primary"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
        </select>
      </div>
    </div>
  )
}
