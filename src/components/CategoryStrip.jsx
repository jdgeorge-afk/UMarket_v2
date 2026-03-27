// Mobile-only category strip with expandable subcategories (hidden on lg+)

const SECTIONS = [
  {
    value: 'all',
    label: 'All',
    icon: '',
    subs: [],
  },
  {
    value: 'housing',
    label: 'Housing',
    icon: '',
    subs: [
      { value: 'housing',                      label: 'All Housing',             icon: '' },
      { value: 'housing:landlord',             label: 'Housing by Landlord',     icon: '' },
      { value: 'housing:sublease',             label: 'Subleases by Tenant',     icon: '' },
      { value: 'housing:roommates',            label: 'Looking for Roommates',   icon: '' },
      { value: 'housing:looking_sublease',     label: 'Looking for Sublease',    icon: '' },
      { value: 'housing:looking_for',          label: 'Looking for Housing',     icon: '' },
    ],
  },
  {
    value: 'looking_for',
    label: 'Looking For',
    icon: '',
    subs: [],
  },
  {
    value: 'marketplace',
    label: 'Marketplace',
    icon: '',
    subs: [
      { value: 'marketplace',              label: 'All',         icon: '' },
      { value: 'marketplace:textbooks',    label: 'Textbooks',   icon: '' },
      { value: 'marketplace:furniture',    label: 'Furniture',   icon: '' },
      { value: 'marketplace:electronics',  label: 'Electronics', icon: '' },
      { value: 'marketplace:clothing',     label: 'Clothing',    icon: '' },
      { value: 'marketplace:sports',       label: 'Sports',      icon: '' },
      { value: 'marketplace:events',       label: 'Events',      icon: '' },
      { value: 'marketplace:misc',         label: 'Misc',        icon: '' },
    ],
  },
]

// Only renders subcategory chips — top-level tabs are handled by SectionTabs
export default function CategoryStrip({ activeFilter, onFilter }) {
  const activeSection = SECTIONS.find(
    (s) => activeFilter === s.value || activeFilter?.startsWith(s.value + ':')
  )
  const subs = activeSection?.subs ?? []

  if (subs.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-1 pb-2 lg:hidden">
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
            {sub.label}
          </button>
        )
      })}
    </div>
  )
}
