import { useState, useRef, useEffect } from 'react'

const SUBS = {
  housing: [
    { label: 'All Housing',           value: 'housing'              },
    { label: 'Housing by Landlord',   value: 'housing:landlord'     },
    { label: 'Sublease by Tenant',    value: 'housing:sublease'     },
    { label: 'Looking for Roommates', value: 'housing:roommates'    },
    { label: 'Looking for Housing',   value: 'housing:looking_for'  },
  ],
  marketplace: [
    { label: 'All Marketplace', value: 'marketplace'             },
    { label: 'Textbooks',       value: 'marketplace:textbooks'   },
    { label: 'Furniture',       value: 'marketplace:furniture'   },
    { label: 'Electronics',     value: 'marketplace:electronics' },
    { label: 'Clothing',        value: 'marketplace:clothing'    },
    { label: 'Sports',          value: 'marketplace:sports'      },
    { label: 'Events',          value: 'marketplace:events'      },
    { label: 'Misc',            value: 'marketplace:misc'        },
  ],
}

export default function SectionTabs({ activeFilter, onFilter, onAdvertiseOpen }) {
  const [openDrop, setOpenDrop] = useState(null)
  const dropRef = useRef(null)

  const tabs = [
    { label: 'Home',        value: 'all'         },
    { label: 'Housing',     value: 'housing'     },
    { label: 'Marketplace', value: 'marketplace' },
    { label: 'Events',      value: 'events'      },
    { label: 'Looking For', value: 'looking_for' },
  ]

  const activeTop =
    activeFilter === 'all'                                                         ? 'all'
    : activeFilter === 'housing' || activeFilter?.startsWith('housing:')           ? 'housing'
    : activeFilter === 'marketplace' || activeFilter?.startsWith('marketplace:')   ? 'marketplace'
    : activeFilter === 'events'                                                    ? 'events'
    : activeFilter === 'looking_for'                                               ? 'looking_for'
    : 'all'

  useEffect(() => {
    if (!openDrop) return
    function handle(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpenDrop(null)
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('touchstart', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('touchstart', handle)
    }
  }, [openDrop])

  const pick = (val) => { onFilter(val); setOpenDrop(null) }

  return (
    <div className="relative" ref={dropRef}>
      <div className="flex items-center gap-2 px-4 sm:px-6 py-3 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => {
          const active = activeTop === tab.value
          const hasSubs = !!SUBS[tab.value]
          return (
            <button
              key={tab.value}
              onClick={() => {
                if (hasSubs) {
                  setOpenDrop(openDrop === tab.value ? null : tab.value)
                } else {
                  pick(tab.value)
                }
              }}
              className={[
                'flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-colors border',
                active
                  ? 'bg-school-primary text-white border-school-primary'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
              ].join(' ')}
            >
              {tab.label}
              {hasSubs && (
                <svg
                  className={`w-3 h-3 transition-transform duration-150 ${openDrop === tab.value ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
          )
        })}

        <button
          onClick={onAdvertiseOpen}
          className="ml-1 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-colors bg-red-500 hover:bg-red-600 text-white border border-red-500"
        >
          Advertise with Us
        </button>
      </div>

      {/* Subcategory dropdown */}
      {openDrop && SUBS[openDrop] && (
        <div className="absolute left-4 top-full z-50 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 min-w-[220px]">
          {SUBS[openDrop].map((sub) => (
            <button
              key={sub.value}
              onClick={() => pick(sub.value)}
              className={[
                'w-full text-left px-5 py-3 text-sm font-medium transition-colors',
                activeFilter === sub.value
                  ? 'text-school-primary font-semibold bg-school-primary/5'
                  : 'text-gray-700 hover:bg-gray-50',
              ].join(' ')}
            >
              {sub.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
