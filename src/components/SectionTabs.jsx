export default function SectionTabs({ activeFilter, onFilter }) {
  const tabs = [
    { label: 'Home',        value: 'all'         },
    { label: 'Housing',     value: 'housing'     },
    { label: 'Marketplace', value: 'marketplace' },
    { label: 'Looking For', value: 'looking_for' },
  ]

  const activeTop =
    activeFilter === 'all'                                              ? 'all'
    : activeFilter === 'housing' || activeFilter?.startsWith('housing:')       ? 'housing'
    : activeFilter === 'marketplace' || activeFilter?.startsWith('marketplace:') ? 'marketplace'
    : activeFilter === 'looking_for'                                    ? 'looking_for'
    : 'all'

  return (
    <div className="flex items-center gap-2 px-4 sm:px-6 py-3 overflow-x-auto scrollbar-hide">
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
