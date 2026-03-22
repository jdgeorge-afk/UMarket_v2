import { useState, useEffect } from 'react'
import { useSchool } from '../context/SchoolContext'
import { useAuth } from '../context/AuthContext'
import { SCHOOLS } from '../constants/schools'
import { supabase } from '../lib/supabase'

export default function Header({ searchQuery, onSearch, onAuthOpen, onPostOpen, onGoHome, onFavorites, onOpenProfile, onAdminOpen }) {
  const { school, selectSchool, clearSchool } = useSchool()
  const { user, profile, signOut } = useAuth()
  const [schoolDropOpen, setSchoolDropOpen] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [unreadNotifs, setUnreadNotifs] = useState(0)

  useEffect(() => {
    if (!user) { setUnreadNotifs(0); return }
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false)
      .then(({ count }) => setUnreadNotifs(count ?? 0))
  }, [user])

  return (
    <header className="sticky top-0 z-40 shadow-md" style={{ background: school?.gradient ?? 'var(--school-gradient)' }}>
      <div className="w-full px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">

        {/* Logo */}
        <button
          onClick={onGoHome}
          className="flex items-center gap-2 shrink-0 text-white font-extrabold text-2xl sm:text-3xl leading-none tracking-tight"
        >
          UMarket
          <span className="text-[10px] font-semibold bg-white/25 text-white px-1.5 py-0.5 rounded-full tracking-wide self-center">
            BETA
          </span>
        </button>

        {/* School switcher pill */}
        <div className="relative shrink-0">
          <button
            onClick={() => setSchoolDropOpen((p) => !p)}
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-2.5 py-1 rounded-full transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-white/80 inline-block" />
            {school?.shortName ?? 'Select School'}
            <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {schoolDropOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[220px] z-50 flex flex-col max-h-72">
              {/* Search — fixed at top */}
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
              {/* Scrollable school list */}
              <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {SCHOOLS.filter((s) => s.live && (
                  !schoolSearch ||
                  s.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
                  s.shortName.toLowerCase().includes(schoolSearch.toLowerCase())
                )).map((s) => (
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
              {/* Switch school — fixed at bottom */}
              <div className="border-t border-gray-100 pt-1 shrink-0">
                <button
                  onClick={() => { clearSchool(); setSchoolDropOpen(false) }}
                  className="w-full px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 text-left"
                >
                  Switch school
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search bar — fixed width, left-anchored */}
        <div className="relative w-64 sm:w-80">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={`Search listings, housing, textbooks...`}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/20 text-white placeholder:text-white/60 text-sm outline-none focus:bg-white/30 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-base"
            >
              ×
            </button>
          )}
        </div>

        {/* Desktop auth / post actions */}
        <div className="hidden sm:flex items-center gap-2 shrink-0 ml-auto">
          {user ? (
            <>
              {/* Saved */}
              <button
                onClick={onFavorites}
                className="text-white/80 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                Saved
              </button>

              {/* Notification bell */}
              <button
                onClick={onOpenProfile}
                className="relative text-white/80 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Notifications"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadNotifs > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </button>

              {/* Post button */}
              <button
                onClick={onPostOpen}
                className="flex items-center gap-1 bg-white text-school-primary font-bold text-sm px-3 py-1.5 rounded-lg hover:bg-white/90 transition-colors shadow-sm"
              >
                + Post
              </button>

              {/* User avatar + dropdown */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((p) => !p)}
                  className="w-8 h-8 rounded-full bg-white/25 hover:bg-white/35 text-white font-bold text-sm flex items-center justify-center transition-colors"
                >
                  {profile?.name?.[0]?.toUpperCase() ?? 'U'}
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px] z-50">
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
                className="text-white font-medium text-sm px-3 py-1.5 rounded-lg border border-white/40 hover:bg-white/10 transition-colors"
              >
                Log In
              </button>
              <button
                onClick={() => onAuthOpen('signup')}
                className="text-white font-medium text-sm px-3 py-1.5 rounded-lg border border-white/40 hover:bg-white/10 transition-colors"
              >
                Sign Up
              </button>
              <button
                onClick={onPostOpen}
                className="flex items-center gap-1 bg-white text-school-primary font-bold text-sm px-3 py-1.5 rounded-lg hover:bg-white/90 transition-colors shadow-sm"
              >
                + Post
              </button>
            </>
          )}
        </div>

        {/* Mobile post button */}
        <button
          onClick={onPostOpen}
          className="sm:hidden bg-white text-school-primary font-bold text-sm px-2.5 py-1.5 rounded-lg shrink-0 ml-auto"
        >
          + Post
        </button>
      </div>

      {/* Close dropdowns when clicking outside */}
      {(schoolDropOpen || userMenuOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => { setSchoolDropOpen(false); setSchoolSearch(''); setUserMenuOpen(false) }}
        />
      )}
    </header>
  )
}
