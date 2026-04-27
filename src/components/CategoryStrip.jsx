// Mobile-only subcategory filter strip (hidden on lg+).
// Rendered just above the listing grid — below the section hero — so it
// feels like it belongs to the content rather than the navigation.
import { useRef, useEffect } from 'react'

const SECTIONS = [
  {
    value: 'all',
    label: 'All',
    subs: [],
  },
  {
    value: 'housing',
    label: 'Housing',
    subs: [
      { value: 'housing',             label: 'All Housing'           },
      { value: 'housing:roommates',   label: 'Looking for Roommates' },
      { value: 'housing:looking_for', label: 'Looking for Housing'   },
    ],
  },
  {
    value: 'looking_for',
    label: 'Looking For',
    subs: [],
  },
  {
    value: 'marketplace',
    label: 'Marketplace',
    subs: [
      { value: 'marketplace',             label: 'All'         },
      { value: 'marketplace:textbooks',   label: 'Textbooks'   },
      { value: 'marketplace:furniture',   label: 'Furniture'   },
      { value: 'marketplace:electronics', label: 'Electronics' },
      { value: 'marketplace:clothing',    label: 'Clothing'    },
      { value: 'marketplace:sports',      label: 'Sports'      },
      { value: 'marketplace:events',      label: 'Events'      },
      { value: 'marketplace:misc',        label: 'Misc'        },
    ],
  },
]

export default function CategoryStrip({ activeFilter, onFilter }) {
  const activeSection = SECTIONS.find(
    (s) => activeFilter === s.value || activeFilter?.startsWith(s.value + ':')
  )
  const subs = activeSection?.subs ?? []
  const scrollRef = useRef(null)
  const activeRef = useRef(null)

  // Scroll the active pill into view whenever the selection changes
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      })
    }
  }, [activeFilter])

  // Smooth height transition so the strip appearing/disappearing doesn't
  // cause a hard layout jump — expands to fit one pill row, collapses to 0.
  const hasSubs = subs.length > 0

  return (
    <div
      className={[
        'relative lg:hidden overflow-hidden transition-all duration-200 ease-in-out',
        hasSubs ? 'max-h-20 opacity-100' : 'max-h-0 opacity-0',
      ].join(' ')}
      aria-hidden={!hasSubs}
    >
      {/* Scrollable pill row */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-3 pb-2"
      >
        {subs.map((sub) => {
          const active = activeFilter === sub.value
          return (
            <button
              key={sub.value}
              ref={active ? activeRef : null}
              onClick={() => onFilter(sub.value)}
              className={[
                'flex items-center px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0',
                'transition-all duration-150 active:scale-95',
                active
                  ? 'bg-school-primary text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              ].join(' ')}
            >
              {sub.label}
            </button>
          )
        })}
        {/* Spacer so the last pill isn't hidden behind the fade */}
        <div className="w-8 shrink-0" aria-hidden="true" />
      </div>

      {/* Right-edge fade — indicates more pills are scrollable */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-gray-50 to-transparent"
        aria-hidden="true"
      />
    </div>
  )
}
