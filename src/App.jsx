import { useState } from 'react'
import { SchoolProvider, useSchool } from './context/SchoolContext'
import { AuthProvider, useAuth } from './context/AuthContext'

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

  // ── Navigation helpers ────────────────────────────────────────────────────
  const openListing = (listing) => {
    setSelectedListing(listing)
    setCurrentView('detail')
  }

  const openProfile = (userId) => {
    setViewedUserId(userId)
    setCurrentView('profile')
  }

  const goHome = () => {
    setCurrentView('feed')
    setSelectedListing(null)
    setViewedUserId(null)
    setActiveFilter('all')
  }

  const openFavorites = () => { setCurrentView('favorites'); setActiveFilter('all') }

  // ── Auth gate: run callback if authed, else open sign-in modal ───────────
  const requireAuth = (callback) => {
    if (!user) {
      setAuthMode('signin')
      setAuthModalOpen(true)
      return
    }
    callback()
  }

  const openPost  = () => requireAuth(() => setPostModalOpen(true))
  const openAdmin = () => { if (profile?.is_admin) setCurrentView('admin') }

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
              onFilter={setActiveFilter}
              onPostOpen={openPost}
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
              onBack={goHome}
              onOpenProfile={openProfile}
              onRequireAuth={requireAuth}
            />
          )}

          {currentView === 'profile' && (
            <UserProfile
              userId={viewedUserId}
              onBack={() => window.history.length > 1 ? setCurrentView(selectedListing ? 'detail' : 'feed') : goHome()}
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
            href="mailto:umarket.jr@gmail.com"
            className="text-sm font-bold text-white hover:underline"
          >
            umarket.jr@gmail.com
          </a>
          <p className="text-[11px] text-white/60 mt-1">We read every message and typically reply within 24 hours.</p>
        </div>
        <p className="text-[11px] text-white/50 leading-relaxed max-w-2xl mx-auto">
          UMarket is an independent platform and is not affiliated with, endorsed by, sponsored by, or officially connected to any university, college, or educational institution referenced on this site. All university names, colors, and identifiers are used solely for the purpose of helping students identify their campus community. UMarket makes no claim of association with any academic institution. Use of any university name does not imply any relationship or endorsement. UMarket is a student-to-student marketplace platform operated independently. All transactions are between individual users. UMarket is not responsible for the accuracy of listings, the conduct of users, or the outcome of any transaction. Use this platform at your own risk.
        </p>
      </footer>

      {/* Mobile bottom navigation */}
      <BottomNav
        currentView={currentView}
        onFeed={goHome}
        onFavorites={openFavorites}
        onPost={openPost}
        onProfile={() => (user ? openProfile(user.id) : setAuthModalOpen(true))}
      />

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {authModalOpen && (
        <AuthModal
          mode={authMode}
          onModeChange={setAuthMode}
          onClose={() => setAuthModalOpen(false)}
        />
      )}

      {postModalOpen && (
        <PostListingModal onClose={() => setPostModalOpen(false)} />
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
