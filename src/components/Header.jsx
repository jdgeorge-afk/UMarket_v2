import { useState } from 'react'
import { useSchool } from '../context/SchoolContext'
import { useAuth } from '../context/AuthContext'
import { SCHOOLS } from '../constants/schools'

export default function Header({ onAuthOpen, onPostOpen, onGoHome, onFavorites, onOpenProfile }) {
  const { school, selectSchool, clearSchool } = useSchool()
  const { user, profile, signOut } = useAuth()
  const [schoolDropOpen, setSchoolDropOpen] = useState(false)
  const [schoolSearch, setSchoolSearch] = useState('')
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 shadow-sm" style={{ background: school?.gradient ?? 'var(--school-gradient)' }}>
      <div className="w-full px-4 sm:px-6 h-14 flex items-center gap-3">

        {/* Logo */}
        <button onClick={onGoHome} className="flex items-center gap-2 shrink-0">
          <span className="w-8 h-8 rounded-full bg-white/25 flex items-center justify-center text-white font-extrabold text-base">
            U
          </span>
          <div className="hidden sm:block text-left">
            <p className="text-white font-extrabold text-sm leading-tight">U Marketplace</p>
            <p className="text-white/70 text-[11px] leading-tight">Student housing + marketplace</p>
          </div>
          <p className="sm:hidden text-white font-extrabold text-base leading-none">UMarket</p>
        </button>

        {/* School switcher pill — centered */}
        <div className="relative mx-auto">
          <button
            onClick={() => setSchoolDropOpen((p) => !p)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-3 py-1.5 rounded-full transition-colors border border-white/30"
          >
            <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {school?.shortName ?? 'Select School'}
            <svg className="w-3 h-3 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {schoolDropOpen && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[220px] z-50">
              <div className="px-2 pt-1 pb-1">
                <input
                  autoFocus
                  type="text"
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                  placeholder="Search schools..."
                  className="w-full text-sm px-3 py-1.5 rounded-lg border border-gray-200 outline-none focus:border-school-primary text-gray-700 placeholder:text-gray-400"
                />
              </div>
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
                  <span className="text-gray-400 text-xs ml-1">{s.name}</span>
                </button>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
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

        {/* Right — auth / post actions */}
        <div className="flex items-center gap-2 shrink-0">
          {user ? (
            <>
              <button
                onClick={onFavorites}
                className="hidden sm:block text-white/80 hover:text-white text-sm px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                Saved
              </button>
              <button
                onClick={onPostOpen}
                className="flex items-center gap-1 bg-white text-school-primary font-bold text-sm px-3 py-1.5 rounded-full hover:bg-white/90 transition-colors shadow-sm"
              >
                + Post
              </button>
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
                    <button onClick={() => { setUserMenuOpen(false); onOpenProfile?.() }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">My Profile</button>
                    <button onClick={() => { setUserMenuOpen(false); onFavorites() }} className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left">Saved Listings</button>
                    <button onClick={() => { setUserMenuOpen(false); signOut() }} className="w-full px-3 py-2 text-sm text-red-500 hover:bg-gray-50 text-left">Sign Out</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => onAuthOpen('signin')}
                className="text-white font-semibold text-sm px-4 py-1.5 rounded-full border border-white/60 hover:bg-white/10 transition-colors"
              >
                Log In
              </button>
              <button
                onClick={() => onAuthOpen('signup')}
                className="text-school-primary font-bold text-sm px-4 py-1.5 rounded-full bg-white hover:bg-white/90 transition-colors shadow-sm"
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </div>

      {(schoolDropOpen || userMenuOpen) && (
        <div className="fixed inset-0 z-30" onClick={() => { setSchoolDropOpen(false); setSchoolSearch(''); setUserMenuOpen(false) }} />
      )}
    </header>
  )
}
