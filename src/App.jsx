import { useState, useEffect, useRef } from 'react'
import { SchoolProvider, useSchool } from './context/SchoolContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import { SUPPORT_EMAIL } from './constants/config'

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

  // History stack — each entry: { view, listing, userId }
  const [navHistory, setNavHistory] = useState([])

  // ── Feed filter state ─────────────────────────────────────────────────────
  // activeFilter encodes section + sub-filter:
  //   'all' | 'housing' | 'housing:sublease' | 'housing:looking_for'
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
    if (listing !== null) setSelectedListing(listing)
    if (userId !== null) setViewedUserId(userId)
  }

  const goBack = () => {
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

  const openListing = (listing) => pushNav('detail', listing, null)

  const openProfile = (userId) => pushNav('profile', null, userId)

  const goHome = () => {
    setNavHistory([])
    setCurrentView('feed')
    setSelectedListing(null)
    setViewedUserId(null)
    setActiveFilter('all')
  }

  const openFavorites = () => { setNavHistory([]); setCurrentView('favorites'); setActiveFilter('all') }

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

  // ── URL ↔ state sync ──────────────────────────────────────────────────────
  // Track whether we've done the one-time URL restore on initial load
  const urlRestoredRef = useRef(false)

  // On first render (once school is available), parse URL and restore state
  useEffect(() => {
    if (!mounted || !school || urlRestoredRef.current) return
    urlRestoredRef.current = true

    const p = new URLSearchParams(window.location.search)
    if (p.has('listing')) {
      supabase.from('listings').select('*').eq('id', p.get('listing')).single()
        .then(({ data }) => {
          if (data) { setSelectedListing(data); setCurrentView('detail') }
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

  // Keep URL in sync with navigation state — replaceState so browser back
  // button doesn't fight the app's own navHistory stack
  useEffect(() => {
    if (!mounted || !school) return
    const p = new URLSearchParams()
    if (currentView === 'detail' && selectedListing) {
      p.set('listing', selectedListing.id)
    } else if (currentView === 'profile' && viewedUserId) {
      p.set('profile', viewedUserId)
    } else if (currentView === 'favorites') {
      p.set('view', 'favorites')
    } else if (currentView === 'admin') {
      p.set('view', 'admin')
    } else if (currentView === 'feed') {
      if (activeFilter && activeFilter !== 'all') p.set('filter', activeFilter)
      if (searchQuery) p.set('search', searchQuery)
    }
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : '/')
  }, [mounted, school, currentView, selectedListing, viewedUserId, activeFilter, searchQuery])

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
export default function App() {
  return (
    <SchoolProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </SchoolProvider>
  )
}
