import { useState, useEffect, useRef } from 'react'
import { SchoolProvider, useSchool } from './context/SchoolContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import { SUPPORT_EMAIL } from './constants/config'
import ResetPasswordPage from './components/ResetPasswordPage'

// Layout
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import Sidebar from './components/Sidebar'

// Views
import SchoolPicker from './components/SchoolPicker'
import LandingPage from './components/LandingPage'
import ListingFeed from './components/ListingFeed'
import ListingDetail from './components/ListingDetail'
import UserProfile from './components/UserProfile'
import AdminDashboard from './components/AdminDashboard'

// Modals
import AuthModal from './components/AuthModal'
import PostListingModal from './components/PostListingModal'
import BoostModal from './components/BoostModal'

// ── Fetch a listing by ID with full seller profile join ──────────────────────
const LISTING_SELECT = '*, profiles!seller_id(name, score, verified, grade, contact, contact_type, sold_count, avatar_url)'

function parseListingPath(pathname) {
  const m = pathname.match(/^\/listing\/([^/]+)$/)
  return m ? m[1] : null
}

// ── "Listing no longer available" fallback screen ────────────────────────────
function ListingNotFound({ onGoHome }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <p className="text-5xl mb-4">🔍</p>
      <h2 className="text-xl font-bold text-gray-900 mb-2">This listing is no longer available</h2>
      <p className="text-gray-400 text-sm mb-6 max-w-xs leading-relaxed">
        It may have been sold, removed, or the link might be incorrect.
      </p>
      <button
        onClick={onGoHome}
        className="bg-school-primary text-white font-bold px-6 py-3 rounded-2xl hover:opacity-90 transition-opacity shadow-md"
      >
        Browse Listings
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner app — consumes both contexts (which are set up in the App wrapper below)
// ─────────────────────────────────────────────────────────────────────────────
function AppInner() {
  const { school, mounted } = useSchool()
  const { user, profile } = useAuth()

  // ── Navigation state ──────────────────────────────────────────────────────
  // 'feed' | 'favorites' | 'detail' | 'profile' | 'admin'
  const [currentView, setCurrentView] = useState('feed')
  const [selectedListing, setSelectedListing] = useState(null)
  const [viewedUserId, setViewedUserId] = useState(null)
  const [listingNotFound, setListingNotFound] = useState(false)

  // History stack — each entry: { view, listing, userId }
  const [navHistory, setNavHistory] = useState([])

  // ── Feed filter state ─────────────────────────────────────────────────────
  // activeFilter encodes section + sub-filter:
  //   'all' | 'housing' | 'housing:roommates' | 'housing:looking_for'
  //   'looking_for' | 'marketplace' | 'marketplace:misc' | etc.
  const [activeFilter, setActiveFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [searchQuery, setSearchQuery] = useState('')

  // ── Modal state ───────────────────────────────────────────────────────────
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signin') // 'signin' | 'signup'
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [boostAfterPost, setBoostAfterPost] = useState(false)
  const [boostListing, setBoostListing] = useState(null)

  // ── Navigation helpers ────────────────────────────────────────────────────
  const pushNav = (newView, listing = null, userId = null) => {
    setNavHistory(h => [...h, { view: currentView, listing: selectedListing, userId: viewedUserId }])
    setCurrentView(newView)
    setListingNotFound(false)
    if (listing !== null) setSelectedListing(listing)
    if (userId !== null) setViewedUserId(userId)
  }

  const goBack = () => {
    setListingNotFound(false)
    setNavHistory(h => {
      const prev = h[h.length - 1]
      if (!prev) {
        // No history — happens when user refreshed directly on this page.
        // Fall back to the feed so the back button always does something useful.
        setCurrentView('feed')
        setSelectedListing(null)
        setViewedUserId(null)
        return h
      }
      setCurrentView(prev.view)
      setSelectedListing(prev.listing)
      setViewedUserId(prev.userId)
      return h.slice(0, -1)
    })
  }

  // Opens a listing: pushState so the URL becomes /listing/:id and the browser
  // back button creates a real history entry to return to.
  const openListing = (listing) => {
    window.history.pushState(null, '', `/listing/${listing.id}`)
    pushNav('detail', listing, null)
  }

  const openProfile = (userId) => pushNav('profile', null, userId)

  const goHome = () => {
    setNavHistory([])
    setCurrentView('feed')
    setSelectedListing(null)
    setViewedUserId(null)
    setActiveFilter('all')
    setListingNotFound(false)
  }

  const openFavorites = () => {
    setNavHistory([])
    setCurrentView('favorites')
    setActiveFilter('all')
    setListingNotFound(false)
  }

  // ── Auth gate: run callback if authed, else open sign-in modal ───────────
  const requireAuth = (callback) => {
    if (!user) {
      setAuthMode('signin')
      setAuthModalOpen(true)
      return
    }
    callback()
  }

  const openPost         = () => requireAuth(() => { setBoostAfterPost(false); setPostModalOpen(true) })
  const openPostAndBoost = () => requireAuth(() => { setBoostAfterPost(true);  setPostModalOpen(true) })
  const openAdmin        = () => { if (profile?.is_admin) setCurrentView('admin') }

  // Scroll to top on every view or category change (not on modal open)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [currentView, activeFilter])

  // Reset sort to 'newest' when the user switches to a different top-level section
  // (e.g. Housing → Marketplace). Sub-filter changes within a section keep the sort.
  const prevTopLevelRef = useRef('all')
  useEffect(() => {
    const newTop = activeFilter ? activeFilter.split(':')[0] : 'all'
    if (newTop !== prevTopLevelRef.current) {
      prevTopLevelRef.current = newTop
      setSortBy('newest')
    }
  }, [activeFilter])

  // ── URL ↔ state sync ──────────────────────────────────────────────────────
  // Track whether we've done the one-time URL restore on initial load
  const urlRestoredRef = useRef(false)

  // On first render (once school is available), parse URL and restore state.
  // Checks /listing/:id path first, then falls back to legacy ?listing= params.
  useEffect(() => {
    if (!mounted || !school || urlRestoredRef.current) return
    urlRestoredRef.current = true

    const listingId = parseListingPath(window.location.pathname)
    if (listingId) {
      supabase.from('listings').select(LISTING_SELECT).eq('id', listingId).single()
        .then(({ data }) => {
          if (data) {
            setSelectedListing(data)
            setCurrentView('detail')
          } else {
            setListingNotFound(true)
            setCurrentView('detail')
          }
        })
      return
    }

    const p = new URLSearchParams(window.location.search)
    if (p.has('listing')) {
      supabase.from('listings').select(LISTING_SELECT).eq('id', p.get('listing')).single()
        .then(({ data }) => {
          if (data) { setSelectedListing(data); setCurrentView('detail') }
          else { setListingNotFound(true); setCurrentView('detail') }
        })
    } else if (p.has('profile')) {
      setViewedUserId(p.get('profile'))
      setCurrentView('profile')
    } else if (p.get('view') === 'favorites') {
      setCurrentView('favorites')
    } else if (p.get('view') === 'admin') {
      setCurrentView('admin')
    } else if (p.has('filter')) {
      setActiveFilter(p.get('filter'))
    } else if (p.has('search')) {
      setSearchQuery(p.get('search'))
    }
  }, [mounted, school]) // eslint-disable-line react-hooks/exhaustive-deps

  // Browser back/forward — re-derive state from the URL so native navigation works
  useEffect(() => {
    const handlePopState = () => {
      const listingId = parseListingPath(window.location.pathname)
      if (listingId) {
        supabase.from('listings').select(LISTING_SELECT).eq('id', listingId).single()
          .then(({ data }) => {
            if (data) {
              setSelectedListing(data)
              setCurrentView('detail')
              setListingNotFound(false)
            } else {
              setSelectedListing(null)
              setListingNotFound(true)
              setCurrentView('detail')
            }
          })
      } else {
        setCurrentView('feed')
        setSelectedListing(null)
        setListingNotFound(false)
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep URL in sync with navigation state.
  // Detail view uses /listing/:id path; everything else uses query params.
  // replaceState is used so this effect never fights the pushState in openListing.
  useEffect(() => {
    if (!mounted || !school) return
    if (currentView === 'detail' && selectedListing) {
      window.history.replaceState(null, '', `/listing/${selectedListing.id}`)
    } else if (currentView === 'detail' && listingNotFound) {
      // keep whatever URL the user came in on
    } else if (currentView === 'profile' && viewedUserId) {
      window.history.replaceState(null, '', `?profile=${viewedUserId}`)
    } else if (currentView === 'favorites') {
      window.history.replaceState(null, '', '?view=favorites')
    } else if (currentView === 'admin') {
      window.history.replaceState(null, '', '?view=admin')
    } else if (currentView === 'feed') {
      const p = new URLSearchParams()
      if (activeFilter && activeFilter !== 'all') p.set('filter', activeFilter)
      if (searchQuery) p.set('search', searchQuery)
      const qs = p.toString()
      window.history.replaceState(null, '', qs ? `?${qs}` : '/')
    }
  }, [mounted, school, currentView, selectedListing, listingNotFound, viewedUserId, activeFilter, searchQuery])

  // Landing page: All tab, no search, not in favorites/detail/profile
  const isLanding = currentView === 'feed' && activeFilter === 'all' && !searchQuery

  // ── Prevent flash of SchoolPicker while localStorage is being read ────────
  if (!mounted) return null

  // ── School not selected yet → show full-screen picker ────────────────────
  if (!school) return <SchoolPicker />

  // ── Main app layout ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onAuthOpen={(mode = 'signin') => {
          setAuthMode(mode)
          setAuthModalOpen(true)
        }}
        onPostOpen={openPost}
        onGoHome={goHome}
        onFavorites={openFavorites}
        onOpenProfile={() => user && openProfile(user.id)}
        onAdminOpen={profile?.is_admin ? openAdmin : null}
      />

      <div className="flex w-full">
        {/* Desktop sidebar — only on Housing / Marketplace / Looking For */}
        {!isLanding && (
          <aside className="hidden lg:block w-64 shrink-0">
            <Sidebar
              activeFilter={activeFilter}
              onFilter={(filter) => { setActiveFilter(filter); setCurrentView('feed') }}
              onPostOpen={openPost}
              onBoostOpen={openPostAndBoost}
            />
          </aside>
        )}

        {/* Main content area */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-8">
          {/* Scrollable landing page — All tab, no search */}
          {isLanding && (
            <LandingPage
              onFilter={setActiveFilter}
              onPostOpen={openPost}
              onRequireAuth={requireAuth}
              onOpenListing={openListing}
            />
          )}

          {!isLanding && (currentView === 'feed' || currentView === 'favorites') && (
            <ListingFeed
              favoritesOnly={currentView === 'favorites'}
              activeFilter={activeFilter}
              onFilter={setActiveFilter}
              sortBy={sortBy}
              onSort={setSortBy}
              searchQuery={searchQuery}
              onOpenListing={openListing}
              onRequireAuth={requireAuth}
              onPostOpen={openPost}
            />
          )}

          {currentView === 'detail' && selectedListing && (
            <ListingDetail
              listing={selectedListing}
              onBack={goBack}
              onOpenProfile={openProfile}
              onRequireAuth={requireAuth}
            />
          )}

          {currentView === 'detail' && !selectedListing && listingNotFound && (
            <ListingNotFound onGoHome={goHome} />
          )}

          {currentView === 'profile' && (
            <UserProfile
              userId={viewedUserId}
              onBack={goBack}
              onOpenListing={openListing}
              onRequireAuth={requireAuth}
              onPostOpen={openPost}
            />
          )}

          {currentView === 'admin' && (
            <AdminDashboard onBack={goHome} />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer
        className="px-6 py-8 pb-28 lg:pb-10 text-center space-y-4"
        style={{ background: school?.gradient ?? 'var(--school-gradient)' }}
      >
        <div>
          <p className="text-xs font-semibold text-white/70 mb-1">Questions or feedback?</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-sm font-bold text-white hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>
          <p className="text-[11px] text-white/60 mt-1">We read every message and typically reply within 24 hours.</p>
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed max-w-2xl mx-auto">
          UMarket is an independent platform and is not affiliated with, endorsed by, sponsored by, or officially connected to any university, college, or educational institution referenced on this site. All university names, colors, and identifiers are used solely for the purpose of helping students identify their campus community. UMarket makes no claim of association with any academic institution. Use of any university name does not imply any relationship or endorsement. UMarket is a student-to-student marketplace platform operated independently. All transactions are between individual users. UMarket is not responsible for the accuracy of listings, the conduct of users, or the outcome of any transaction. Use this platform at your own risk.
        </p>
      </footer>

      {/* Mobile bottom navigation — hidden when any modal is open */}
      {!postModalOpen && !authModalOpen && (
        <BottomNav
          currentView={currentView}
          onFeed={goHome}
          onFavorites={openFavorites}
          onPost={openPost}
          onProfile={() => (user ? openProfile(user.id) : setAuthModalOpen(true))}
        />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {authModalOpen && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthModalOpen(false)}
        />
      )}

      {postModalOpen && (
        <PostListingModal
          onClose={() => { setPostModalOpen(false); setBoostAfterPost(false) }}
          onPosted={boostAfterPost ? (listing) => { setPostModalOpen(false); setBoostAfterPost(false); setBoostListing(listing) } : null}
        />
      )}

      {boostListing && (
        <BoostModal listing={boostListing} onClose={() => setBoostListing(null)} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Root export — wraps AppInner with both providers
// ─────────────────────────────────────────────────────────────────────────────
// Root export — intercepts /reset-password before mounting the full app so
// the reset page works even without a school selection or auth session.
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  if (window.location.pathname === '/reset-password') {
    // SchoolProvider loads the school theme from localStorage so the page
    // inherits the user's color scheme if they've visited before.
    return (
      <SchoolProvider>
        <ResetPasswordPage />
      </SchoolProvider>
    )
  }

  return (
    <SchoolProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </SchoolProvider>
  )
}
