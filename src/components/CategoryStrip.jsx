// Mobile-only category strip with expandable subcategories (hidden on lg+)

const SECTIONS = [
  {
    value: 'all',
    label: 'All',
    icon: '🏷️',
    subs: [],
  },
  {
    value: 'housing',
    label: 'Housing',
    icon: '🏠',
    subs: [
      { value: 'housing',             label: 'All Housing',          icon: '🏠' },
      { value: 'housing:sublease',    label: 'Sublease',             icon: '🔑' },
      { value: 'housing:looking_for', label: 'Looking for Housing',  icon: '🏘️' },
    ],
  },
  {
    value: 'looking_for',
    label: 'Looking For',
    icon: '🔍',
    subs: [],
  },
  {
    value: 'marketplace',
    label: 'Marketplace',
    icon: '🛍️',
    subs: [
      { value: 'marketplace',              label: 'All',         icon: '🛍️' },
      { value: 'marketplace:textbooks',    label: 'Textbooks',   icon: '📚' },
      { value: 'marketplace:furniture',    label: 'Furniture',   icon: '🛋️' },
      { value: 'marketplace:electronics',  label: 'Electronics', icon: '💻' },
      { value: 'marketplace:clothing',     label: 'Clothing',    icon: '👕' },
      { value: 'marketplace:sports',       label: 'Sports',      icon: '⚽' },
      { value: 'marketplace:misc',         label: 'Misc',        icon: '📦' },
    ],
  },
]

export default function CategoryStrip({ activeFilter, onFilter }) {
  // Determine which top-level section is active
  const activeSection = SECTIONS.find(
    (s) => activeFilter === s.value || activeFilter?.startsWith(s.value + ':')
  )
  const subs = activeSection?.subs ?? []

  return (
    <div className="lg:hidden">
      {/* ── Top-level section chips ────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-3 pb-1">
        {SECTIONS.map((s) => {
          const active = activeFilter === s.value || activeFilter?.startsWith(s.value + ':')
          return (
            <button
              key={s.value}
              onClick={() => onFilter(s.value)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors border',
                active
                  ? 'bg-school-primary text-white border-school-primary font-medium'
                  : 'bg-white text-gray-600 border-gray-200',
              ].join(' ')}
            >
              <span className="text-base leading-none">{s.icon}</span>
              {s.label}
            </button>
          )
        })}
      </div>

      {/* ── Subcategory chips (only shown when section has subs) ──────────── */}
      {subs.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-1 pb-2">
          {subs.map((sub) => {
            const active = activeFilter === sub.value
            return (
              <button
                key={sub.value}
                onClick={() => onFilter(sub.value)}
                className={[
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs whitespace-nowrap shrink-0 transition-colors border',
                  active
                    ? 'bg-school-primary/15 text-school-primary border-school-primary/30 font-semibold'
                    : 'bg-gray-50 text-gray-500 border-gray-200',
                ].join(' ')}
              >
                <span className="leading-none">{sub.icon}</span>
                {sub.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
