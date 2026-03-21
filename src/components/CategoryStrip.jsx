// Mobile-only horizontal scroll strip of main section chips (hidden on lg+)
const SECTIONS = [
  { value: 'all',          label: 'All',         icon: '🏷️' },
  { value: 'housing',      label: 'Housing',      icon: '🏠' },
  { value: 'looking_for',  label: 'Looking For',  icon: '✨' },
  { value: 'marketplace',  label: 'Marketplace',  icon: '🛍️' },
]

export default function CategoryStrip({ activeFilter, onFilter }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-3 pb-1 lg:hidden">
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
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            ].join(' ')}
          >
            <span className="text-base leading-none">{s.icon}</span>
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
