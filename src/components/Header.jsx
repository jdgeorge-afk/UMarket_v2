import { useState, useEffect, useRef } from 'react'
import { useSchool } from '../context/SchoolContext'
import { useAuth } from '../context/AuthContext'
import { SCHOOLS } from '../constants/schools'
import { supabase } from '../lib/supabase'

const NAV = [
  {
    label: 'Housing',
    value: 'housing',
    subs: [
      { label: 'All Housing',           value: 'housing'              },
      { label: 'Housing by Landlord',   value: 'housing:landlord'     },
      { label: 'Sublease by Tenant',    value: 'housing:sublease'     },
      { label: 'Looking for Roommates', value: 'housing:roommates'    },
      { label: 'Looking for Housing',   value: 'housing:looking_for'  },
    ],
  },
  {
    label: 'Marketplace',
    value: 'marketplace',
    subs: [
      { label: 'All Marketplace', value: 'marketplace'             },
      { label: 'Textbooks',       value: 'marketplace:textbooks'   },
      { label: 'Furniture',       value: 'marketplace:furniture'   },
      { label: 'Electronics',     value: 'marketplace:electronics' },
      { label: 'Clothing',        value: 'marketplace:clothing'    },
      { label: 'Sports',          value: 'marketplace:sports'      },
      { label: 'Events',          value: 'marketplace:events'      },
      { label: 'Misc',            value: 'marketplace:misc'        },
    ],
  },
  { label: 'Events',      value: 'events',      subs: [] },
  { label: 'Looking For', value: 'looking_for', subs: [] },
]

export default function Header({
  searchQuery, onSearch,
  onAuthOpen, onPostOpen, onGoHome, onFavorites, onOpenProfile, onAdminOpen,
  activeFilter, onFilter, onAdvertiseOpen,
}) {
  const { school, selectSchool, clearSchool } = useSchool()
  const { user, profile, signOut } = useAuth()

  const [schoolDropOpen, setSchoolDropOpen] = useState(false)
  const [schoolSearch, setSchoolSearch]     = useState('')
  const [userMenuOpen, setUserMenuOpen]     = useState(false)
  const [unreadNotifs, setUnreadNotifs]     = useState(0)
  const [openNav, setOpenNav]               = useState(null)
  const [searchFocused, setSearchFocused]   = useState(false)
  const leaveTimer = useRef(null)

  useEffect(() => {
    if (!user) { setUnreadNotifs(0); return }
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false)
      .then(({ count }) => setUnreadNotifs(count ?? 0))
  }, [user])

  const activeTop = activeFilter ? activeFilter.split(':')[0] : 'all'

  const enterNav = (val) => {
    clearTimeout(leaveTimer.current)
    setOpenNav(val)
  }
  const leaveNav = () => {
    leaveTimer.current = setTimeout(() => setOpenNav(null), 120)
  }
  const pick = (val) => { onFilter?.(val); setOpenNav(null) }

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="w-full px-4 sm:px-6 h-16 flex items-center gap-3">

        {/* ── Logo ──────────────────────────────────────────────── */}
        <button
          onClick={onGoHome}
          className="shrink-0 flex items-center gap-2 leading-none"
        >
          {/* UMarket logo — diagonal red/blue split with white U */}
          <svg width="34" height="34" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <defs>
              <clipPath id="um-clip">
                <rect width="100" height="100" rx="22" ry="22"/>
              </clipPath>
            </defs>
            <g clipPath="url(#um-clip)">
              <rect width="100" height="100" fill="#CC0000"/>
              <polygon points="100,0 100,100 0,100" fill="#1a3fc4"/>
            </g>
            <text x="50" y="76" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="66" fill="white" textAnchor="middle">U</text>
          </svg>
          <span className="font-extrabold text-2xl tracking-tight" style={{ color: school?.primary ?? '#CC0000' }}>
            UMarket™
          </span>
        </button>

        {/* ── School switcher ───────────────────────────────────── */}
        <div className="relative shrink-0">
          <button
            onClick={() => setSchoolDropOpen((p) => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: school?.primary ?? '#CC0000' }} />
            {school?.shortName ?? 'School'}
            <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {schoolDropOpen && (
            <div className="absolute top-full left-0 mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[230px] z-50 flex flex-col max-h-72">
              <div className="px-2 pt-1 pb-1 shrink-0">
                <input
                  autoFocus
                  type="text"
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  placeholder="Search schools..."
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-school-primary text-gray-700 placeholder:text-gray-400"
                />
              </div>
              <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {SCHOOLS.filter((s) =>
                  s.live && (!schoolSearch ||
                    s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
                    s.shortName.toLowerCase().includes(schoolSearch.toLowerCase()))
                ).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { selectSchool(s.id); setSchoolDropOpen(false); setSchoolSearch('') }}
                    className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-gray-50 ${
                      school?.id === s.id ? 'font-semibold text-school-primary' : 'text-gray-700'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.primary }} />
                    {s.shortName}
                    <span className="text-gray-400 text-xs ml-1 truncate">{s.name}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-gray-100 pt-1 shrink-0">
                <button
                  onClick={() => { clearSchool(); setSchoolDropOpen(false) }}
                  className="w-full px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 text-left font-medium"
                >
                  Switch school
                </button>
                <p className="px-3 pb-2 text-[10px] text-gray-400 leading-snug">
                  UMarket is not affiliated with or endorsed by any university.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Desktop center nav ────────────────────────────────── */}
        <nav className="hidden lg:flex items-center gap-0.5 mx-auto">
          {/* Home */}
          <button
            onClick={() => pick('all')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTop === 'all'
                ? 'bg-school-primary/10 text-school-primary'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            Home
          </button>

          {NAV.map((item) => {
            const isActive = activeTop === item.value
            return (
              <div
                key={item.value}
                className="relative"
                onMouseEnter={() => enterNav(item.value)}
                onMouseLeave={leaveNav}
              >
                <button
                  onClick={() => item.subs.length ? setOpenNav(openNav === item.value ? null : item.value) : pick(item.value)}
                  className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-school-primary/10 text-school-primary'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                  {item.subs.length > 0 && (
                    <svg
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${openNav === item.value ? 'rotate-180' : ''}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>

                {item.subs.length > 0 && openNav === item.value && (
                  <div
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 min-w-[210px] z-50"
                    onMouseEnter={() => enterNav(item.value)}
                    onMouseLeave={leaveNav}
                  >
                    {item.subs.map((sub) => (
                      <button
                        key={sub.value}
                        onClick={() => pick(sub.value)}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          activeFilter === sub.value
                            ? 'text-school-primary font-semibold bg-school-primary/5'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Advertise */}
          <button
            onClick={onAdvertiseOpen}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors text-school-primary hover:bg-school-primary/10"
          >
            Advertise
          </button>
        </nav>

        {/* ── Desktop right actions ─────────────────────────────── */}
        <div className="hidden sm:flex items-center gap-2 shrink-0 ml-auto lg:ml-0">
          {/* Search */}
          <div className="relative">
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
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search…"
              className={`h-9 pl-9 pr-3 rounded-full bg-gray-100 text-gray-800 placeholder:text-gray-400 text-sm outline-none transition-all border ${
                searchFocused ? 'w-56 border-gray-300 bg-white' : 'w-36 border-transparent'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => onSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base"
              >
                ×
              </button>
            )}
          </div>

          {user ? (
            <>
              <button
                onClick={onFavorites}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Saved
              </button>

              <button
                onClick={onOpenProfile}
                className="relative text-gray-500 hover:text-gray-900 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Notifications"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifs > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-school-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </button>

              <button
                onClick={onPostOpen}
                className="flex items-center gap-1 font-bold text-sm px-4 py-2 rounded-full transition-colors text-white"
                style={{ background: school?.primary ?? '#CC0000' }}
              >
                + Post
              </button>

              {/* Avatar + dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="w-8 h-8 rounded-full text-white font-bold text-sm flex items-center justify-center transition-colors"
                  style={{ background: school?.primary ?? '#CC0000' }}
                >
                  {profile?.name?.[0]?.toUpperCase() ?? 'U'}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1.5 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px] z-50">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{profile?.name ?? 'Account'}</p>
                      <p className="text-xs text-gray-400 truncate">{profile?.grade ?? ''}</p>
                    </div>
                    <button
                      onClick={() => { setUserMenuOpen(false); onOpenProfile?.() }}
                      className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                    >
                      My Profile
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); onFavorites() }}
                      className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                    >
                      Saved Listings
                    </button>
                    {onAdminOpen && (
                      <button
                        onClick={() => { setUserMenuOpen(false); onAdminOpen() }}
                        className="w-full px-3 py-2 text-sm text-purple-600 hover:bg-gray-50 text-left font-semibold"
                      >
                        Admin Dashboard
                      </button>
                    )}
                    <button
                      onClick={() => { setUserMenuOpen(false); signOut() }}
                      className="w-full px-3 py-2 text-sm text-red-500 hover:bg-gray-50 text-left"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => onAuthOpen('signin')}
                className="text-sm font-semibold px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
              >
                Log In
              </button>
              <button
                onClick={() => onAuthOpen('signup')}
                className="text-sm font-semibold px-4 py-2 rounded-full text-white transition-colors"
                style={{ background: school?.primary ?? '#CC0000' }}
              >
                Sign Up
              </button>
              <button
                onClick={onPostOpen}
                className="flex items-center gap-1 font-bold text-sm px-4 py-2 rounded-full text-white transition-colors"
                style={{ background: school?.primary ?? '#CC0000' }}
              >
                + Post
              </button>
            </>
          )}
        </div>

        {/* ── Mobile: search + post ─────────────────────────────── */}
        <div className="sm:hidden flex items-center gap-2 ml-auto shrink-0">
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search…"
              className="h-9 w-32 pl-8 pr-3 rounded-full bg-gray-100 text-gray-800 placeholder:text-gray-400 text-sm outline-none border border-transparent focus:border-gray-300 focus:bg-white transition-all"
            />
          </div>
          <button
            onClick={onPostOpen}
            className="font-bold text-sm px-3 py-2 rounded-full text-white shrink-0"
            style={{ background: school?.primary ?? '#CC0000' }}
          >
            + Post
          </button>
        </div>
      </div>

      {/* Backdrop to close open dropdowns */}
      {(schoolDropOpen || userMenuOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => { setSchoolDropOpen(false); setSchoolSearch(''); setUserMenuOpen(false) }}
        />
      )}
    </header>
  )
}
