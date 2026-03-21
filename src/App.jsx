import { useState } from 'react'
import { SchoolProvider, useSchool } from './context/SchoolContext'
import { AuthProvider, useAuth } from './context/AuthContext'

// Layout
import Header from './components/Header'
import BottomNav from './components/BottomNav'
import Sidebar from './components/Sidebar'

// Views
import SchoolPicker from './components/SchoolPicker'
import ListingFeed from './components/ListingFeed'
import ListingDetail from './components/ListingDetail'
import UserProfile from './components/UserProfile'

// Modals
import AuthModal from './components/AuthModal'
import PostListingModal from './components/PostListingModal'

// ─────────────────────────────────────────────────────────────────────────────
// Inner app — consumes both contexts (which are set up in the App wrapper below)
// ─────────────────────────────────────────────────────────────────────────────
function AppInner() {
  const { school, mounted } = useSchool()
  const { user } = useAuth()

  // ── Navigation state ──────────────────────────────────────────────────────
  // 'feed' | 'favorites' | 'detail' | 'profile'
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

  const openPost = () => requireAuth(() => setPostModalOpen(true))

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
      />

      <div className="flex w-full">
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="hidden lg:block w-64 shrink-0">
          <Sidebar
            activeFilter={activeFilter}
            onFilter={setActiveFilter}
            onPostOpen={openPost}
          />
        </aside>

        {/* Main content area */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-8">
          {(currentView === 'feed' || currentView === 'favorites') && (
            <ListingFeed
              favoritesOnly={currentView === 'favorites'}
              activeFilter={activeFilter}
              onFilter={setActiveFilter}
              sortBy={sortBy}
              onSort={setSortBy}
              searchQuery={searchQuery}
              onOpenListing={openListing}
              onRequireAuth={requireAuth}
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
            />
          )}
        </main>
      </div>

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
