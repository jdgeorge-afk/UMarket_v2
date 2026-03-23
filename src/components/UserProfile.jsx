import { useState, useEffect, useRef } from 'react'

// ── Legal & Disclaimers modal ─────────────────────────────────────────────────
function LegalModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg">Legal & Disclaimers</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-5 text-sm text-gray-600 leading-relaxed">
          <section>
            <h3 className="font-bold text-gray-900 mb-1">No University Affiliation</h3>
            <p>UMarket is an independent platform and is not affiliated with, endorsed by, sponsored by, or officially connected to any university, college, or educational institution referenced on this site. All university names, colors, and identifiers are used solely to help students identify their campus community. UMarket makes no claim of association with any academic institution, and use of any university name does not imply any relationship or endorsement.</p>
          </section>
          <section>
            <h3 className="font-bold text-gray-900 mb-1">Independent Platform</h3>
            <p>UMarket is a student-to-student marketplace operated independently. All transactions are between individual users. UMarket is not a party to any transaction and does not guarantee the accuracy of listings, the conduct of users, or the outcome of any transaction.</p>
          </section>
          <section>
            <h3 className="font-bold text-gray-900 mb-1">No Safety Guarantee</h3>
            <p>UMarket does not vet, verify, or background-check users. Always meet in safe, public places and use your best judgment. UMarket is not responsible for any harm, loss, or dispute arising from use of this platform.</p>
          </section>
          <section>
            <h3 className="font-bold text-gray-900 mb-1">Use at Your Own Risk</h3>
            <p>This platform is provided as-is. UMarket disclaims all warranties, express or implied. Use of this platform is at your own risk.</p>
          </section>
          <section>
            <h3 className="font-bold text-gray-900 mb-1">Contact</h3>
            <p>Questions or concerns? Email us at <a href="mailto:umarket.jr@gmail.com" className="text-school-primary font-semibold">umarket.jr@gmail.com</a>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { GRADES } from '../constants/categories'
import ListingCard from './ListingCard'
import EditListingModal from './EditListingModal'
import BoostModal from './BoostModal'

// ── Owner action bar shown below each of the user's own listings ─────────────
function OwnerActions({ listing, onEdit, onToggleSold, onDelete, onBoost }) {
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const isActiveBoosted = listing.boosted && listing.boost_expires_at && new Date(listing.boost_expires_at) > new Date()

  return (
    <div className="mt-1.5">
      <div className="flex gap-1.5">
        <button
          onClick={() => onEdit(listing)}
          className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Edit
        </button>
        <button
          disabled={toggling}
          onClick={async () => {
            setToggling(true)
            await onToggleSold(listing)
            setToggling(false)
          }}
          className={[
            'flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-colors disabled:opacity-40',
            listing.sold
              ? 'border-green-200 text-green-600 hover:bg-green-50'
              : 'border-orange-200 text-orange-600 hover:bg-orange-50',
          ].join(' ')}
        >
          {toggling ? '…' : listing.sold ? 'Unmark Sold' : 'Mark Sold'}
        </button>
        <button
          disabled={deleting}
          onClick={async () => {
            if (!window.confirm('Delete this listing? This cannot be undone.')) return
            setDeleting(true)
            await onDelete(listing.id)
          }}
          className="px-3 text-xs font-semibold py-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
        >
          Delete
        </button>
      </div>
      {/* Boost button — only for active (non-sold) listings */}
      {!listing.sold && (
        <button
          onClick={() => onBoost(listing)}
          className={[
            'w-full mt-1.5 text-xs font-semibold py-1.5 rounded-lg border transition-colors',
            isActiveBoosted
              ? 'border-yellow-300 text-yellow-600 bg-yellow-50'
              : 'border-school-primary/30 text-school-primary hover:bg-school-primary/5',
          ].join(' ')}
        >
          {isActiveBoosted ? `Boosted · expires ${new Date(listing.boost_expires_at).toLocaleDateString()}` : 'Boost this listing · $3/day'}
        </button>
      )}
      <p className="text-[10px] text-gray-300 font-mono mt-1 px-0.5 select-all">
        ID: {listing.id.slice(0, 8).toUpperCase()}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function UserProfile({ userId, onBack, onOpenListing, onRequireAuth, onPostOpen }) {
  const { user, profile: myProfile, updateProfile } = useAuth()
  const { school } = useSchool()

  const [profile, setProfile]       = useState(null)
  const [listings, setListings]     = useState([])
  const [savedListings, setSavedListings] = useState([])
  const [loading, setLoading]       = useState(true)
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [activeTab, setActiveTab]   = useState('listings') // 'listings' | 'saved' | 'contacted' | 'notifications'

  const [contactedListings, setContactedListings] = useState([])
  const [loadingContacted, setLoadingContacted]   = useState(false)
  const [notifItems, setNotifItems]               = useState([])
  const [loadingNotifs, setLoadingNotifs]         = useState(false)
  const [unreadCount, setUnreadCount]             = useState(0)

  const [editing, setEditing]       = useState(false)
  const [editName, setEditName]     = useState('')
  const [editGrade, setEditGrade]   = useState('')
  const [editContact, setEditContact]       = useState('')
  const [editContactType, setEditContactType] = useState('phone')
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')

  const [editingListing, setEditingListing] = useState(null)
  const [boostingListing, setBoostingListing] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [legalOpen, setLegalOpen] = useState(false)
  const avatarInputRef = useRef(null)

  const isOwn = user?.id === userId

  // Fetch profile + own listings
  useEffect(() => {
    if (!userId || !school) return
    setLoading(true)
    Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('listings').select('*').eq('seller_id', userId).eq('school_id', school.id).order('created_at', { ascending: false }),
    ]).then(([{ data: p }, { data: l }]) => {
      setProfile(p ?? null)
      setListings(l ?? [])
      setLoading(false)
    })
  }, [userId, school])

  // Fetch saved listings when own profile switches to saved tab
  useEffect(() => {
    if (!isOwn || activeTab !== 'saved' || !user) return
    setLoadingSaved(true)
    supabase
      .from('favorites')
      .select('listing_id, listings(*)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        setSavedListings((data ?? []).map((f) => f.listings).filter(Boolean))
        setLoadingSaved(false)
      })
  }, [isOwn, activeTab, user])

  // Fetch unread notification count when own profile loads
  useEffect(() => {
    if (!isOwn || !user) return
    supabase.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0))
  }, [isOwn, user])

  // Fetch contacted listings
  useEffect(() => {
    if (!isOwn || activeTab !== 'contacted' || !user) return
    setLoadingContacted(true)
    supabase.from('contact_requests')
      .select('listing_id, listings(*)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setContactedListings((data ?? []).map((r) => r.listings).filter(Boolean))
        setLoadingContacted(false)
      })
  }, [isOwn, activeTab, user])

  // Fetch notifications
  useEffect(() => {
    if (!isOwn || activeTab !== 'notifications' || !user) return
    setLoadingNotifs(true)
    supabase.from('notifications')
      .select('*, listing:listing_id(id, title, images), buyer:buyer_id(name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setNotifItems(data ?? [])
        setLoadingNotifs(false)
        setUnreadCount(0)
        if ((data ?? []).some((n) => !n.read)) {
          supabase.from('notifications').update({ read: true })
            .eq('user_id', user.id).eq('read', false)
        }
      })
  }, [isOwn, activeTab, user])

  const startEdit = () => {
    setEditName(profile?.name ?? '')
    setEditGrade(profile?.grade ?? '')
    setEditContact(profile?.contact ?? '')
    setEditContactType(profile?.contact_type ?? 'phone')
    setSaveError('')
    setEditing(true)
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarUploading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadErr) { setAvatarUploading(false); setSaveError('Photo upload failed'); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await updateProfile({ avatar_url: publicUrl })
    setProfile((p) => ({ ...p, avatar_url: publicUrl }))
    setAvatarUploading(false)
  }

  const saveEdit = async () => {
    setSaving(true)
    setSaveError('')
    const { error } = await updateProfile({
      name:         editName.trim(),
      grade:        editGrade,
      contact:      editContact.trim(),
      contact_type: editContactType,
    })
    if (error) { setSaveError(error.message); setSaving(false); return }
    setProfile((p) => ({ ...p, name: editName.trim(), grade: editGrade, contact: editContact.trim(), contact_type: editContactType }))
    setSaving(false)
    setEditing(false)
  }

  const handleToggleSold = async (listing) => {
    const { error } = await supabase
      .from('listings')
      .update({ sold: !listing.sold })
      .eq('id', listing.id)
      .eq('seller_id', user.id)
    if (!error) {
      setListings((prev) => prev.map((l) => l.id === listing.id ? { ...l, sold: !listing.sold } : l))
    }
  }

  const handleDelete = async (listingId) => {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', listingId)
      .eq('seller_id', user.id)
    if (!error) {
      setListings((prev) => prev.filter((l) => l.id !== listingId))
    }
  }

  const handleListingSaved = (updated) => {
    setListings((prev) => prev.map((l) => l.id === updated.id ? updated : l))
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-400">
        <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse mx-auto mb-4" />
        <div className="h-5 bg-gray-200 rounded w-40 mx-auto mb-2 animate-pulse" />
        <div className="h-3 bg-gray-200 rounded w-24 mx-auto animate-pulse" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-400">
        <p className="text-5xl mb-3"></p>
        <p className="font-semibold">User not found</p>
        <button onClick={onBack} className="mt-4 text-school-primary font-semibold">Go back</button>
      </div>
    )
  }

  const scoreColor =
    profile.score >= 4.5 ? 'text-green-500' :
    profile.score >= 3   ? 'text-yellow-500' :
    'text-red-500'

  const activeListings = listings.filter((l) => !l.sold)
  const soldListings   = listings.filter((l) => l.sold)

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-school-primary font-medium mb-4 hover:opacity-75">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-4">
          {/* Avatar — clickable to upload when in edit mode */}
          <div className="relative shrink-0 w-20 h-20">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden text-white font-extrabold text-3xl"
              style={{ background: profile.avatar_url ? '#e5e7eb' : (school?.gradient ?? 'var(--school-gradient)') }}
            >
              {profile.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt={profile.name} />
                : (profile.name?.[0]?.toUpperCase() ?? '?')
              }
            </div>
            {isOwn && editing && (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center hover:bg-black/55 transition-colors"
                aria-label="Upload profile photo"
              >
                {avatarUploading
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                }
              </button>
            )}
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
              {profile.name}
              {profile.verified && (
                <span className="flex items-center gap-1 text-blue-500 text-sm font-semibold">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  User has .edu email
                </span>
              )}
            </h1>
            {profile.grade && <p className="text-sm text-gray-400">{profile.grade}</p>}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`font-bold text-sm ${scoreColor}`}>{profile.score} score</span>
              <span className="text-gray-400 text-sm">{profile.sold_count ?? 0} sold</span>
              <span className="text-gray-400 text-sm">{profile.transactions ?? 0} transactions</span>
            </div>
          </div>

          {/* Edit profile button (own) */}
          {isOwn && !editing && (
            <button
              onClick={startEdit}
              className="shrink-0 text-xs text-school-primary border border-school-primary/30 px-3 py-1.5 rounded-lg hover:bg-school-primary/5"
            >
              Edit Profile
            </button>
          )}
        </div>

        {/* Edit profile form */}
        {editing && (
          <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
            <input
              value={editName} onChange={(e) => setEditName(e.target.value)}
              placeholder="Your name"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
            />
            <select
              value={editGrade} onChange={(e) => setEditGrade(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-school-primary"
            >
              <option value="">Grade / Year</option>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
            <div className="flex gap-2">
              <select
                value={editContactType} onChange={(e) => setEditContactType(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-school-primary"
              >
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="instagram">Instagram</option>
              </select>
              <input
                value={editContact} onChange={(e) => setEditContact(e.target.value)}
                placeholder={
                  editContactType === 'phone' ? '(555) 000-0000'
                  : editContactType === 'email' ? 'you@example.com'
                  : 'username (no @)'
                }
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
              />
            </div>
            {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 bg-school-primary text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs + Post button (own profile only) */}
      {isOwn ? (
        <div className="flex items-center gap-2 mb-4">
          <div className="flex bg-gray-100 rounded-xl p-1 flex-1">
            {[
              { id: 'listings', label: `My Listings (${listings.length})` },
              { id: 'saved',    label: 'Saved' },
              { id: 'contacted', label: 'Contacted' },
              { id: 'notifications', label: unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                  activeTab === tab.id ? 'bg-white shadow text-gray-900' : 'text-gray-400',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            onClick={onPostOpen}
            className="shrink-0 bg-school-primary text-white font-bold text-sm px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            + Post
          </button>
        </div>
      ) : null}

      {/* ── My Listings tab ─────────────────────────────────────────────────── */}
      {(!isOwn || activeTab === 'listings') && (
        <>
          {/* Active listings */}
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            {isOwn ? 'Active' : 'Active Listings'}
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{activeListings.length}</span>
          </h2>

          {activeListings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {activeListings.map((l) => (
                <div key={l.id}>
                  <ListingCard listing={l} onOpen={onOpenListing} onRequireAuth={onRequireAuth ?? ((cb) => cb())} />
                  {isOwn && (
                    <OwnerActions
                      listing={l}
                      onEdit={setEditingListing}
                      onToggleSold={handleToggleSold}
                      onDelete={handleDelete}
                      onBoost={setBoostingListing}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400 mb-6">
              <p className="text-3xl mb-2"></p>
              <p className="text-sm">{isOwn ? 'No active listings. Post something!' : 'No active listings.'}</p>
            </div>
          )}

          {/* Sold listings */}
          {soldListings.length > 0 && (
            <>
              <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                Sold
                <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{soldListings.length}</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {soldListings.map((l) => (
                  <div key={l.id}>
                    <ListingCard listing={l} onOpen={onOpenListing} onRequireAuth={onRequireAuth ?? ((cb) => cb())} />
                    {isOwn && (
                      <OwnerActions
                        listing={l}
                        onEdit={setEditingListing}
                        onToggleSold={handleToggleSold}
                        onDelete={handleDelete}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Saved tab ───────────────────────────────────────────────────────── */}
      {isOwn && activeTab === 'saved' && (
        <>
          <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            Saved Listings
            <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{savedListings.length}</span>
          </h2>
          {loadingSaved ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-200 rounded-2xl h-44 animate-pulse" />
              ))}
            </div>
          ) : savedListings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {savedListings.map((l) => (
                <ListingCard key={l.id} listing={l} onOpen={onOpenListing} onRequireAuth={onRequireAuth ?? ((cb) => cb())} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3"></p>
              <p className="font-semibold">No saved listings yet</p>
              <p className="text-sm mt-1">Tap the heart on any listing to save it.</p>
            </div>
          )}
        </>
      )}

      {/* ── Contacted tab ───────────────────────────────────────────────────── */}
      {isOwn && activeTab === 'contacted' && (
        <>
          <h2 className="font-bold text-gray-900 mb-3">Listings You've Contacted</h2>
          {loadingContacted ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="bg-gray-200 rounded-2xl h-44 animate-pulse" />)}
            </div>
          ) : contactedListings.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {contactedListings.map((l) => (
                <ListingCard key={l.id} listing={l} onOpen={onOpenListing} onRequireAuth={onRequireAuth ?? ((cb) => cb())} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3"></p>
              <p className="font-semibold">No contacted listings yet</p>
              <p className="text-sm mt-1">Listings you contact will appear here.</p>
            </div>
          )}
        </>
      )}

      {/* ── Notifications tab ───────────────────────────────────────────────── */}
      {isOwn && activeTab === 'notifications' && (
        <>
          <h2 className="font-bold text-gray-900 mb-3">Notifications</h2>
          {loadingNotifs ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="bg-gray-200 rounded-2xl h-16 animate-pulse" />)}
            </div>
          ) : notifItems.length > 0 ? (
            <div className="space-y-2">
              {notifItems.map((n) => (
                <div key={n.id} className={`flex items-center gap-3 p-3 rounded-2xl border ${n.read ? 'border-gray-100 bg-white' : 'border-school-primary/20 bg-school-primary/5'}`}>
                  <div className="w-10 h-10 rounded-full bg-school-primary flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
                    {n.buyer?.avatar_url
                      ? <img src={n.buyer.avatar_url} className="w-full h-full object-cover" alt="" />
                      : (n.buyer?.name?.[0]?.toUpperCase() ?? '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-semibold">{n.buyer?.name ?? 'Someone'}</span>
                      {' '}wants to buy{' '}
                      <span className="font-semibold">{n.listing?.title ?? 'your listing'}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(n.created_at).toLocaleDateString()}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-school-primary shrink-0" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-gray-400">
              <p className="text-4xl mb-3"></p>
              <p className="font-semibold">No notifications yet</p>
              <p className="text-sm mt-1">You'll be notified when someone contacts you.</p>
            </div>
          )}
        </>
      )}

      {/* ── Settings rows (own profile only) ──────────────────────────────── */}
      {isOwn && (
        <div className="mt-8 mb-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Account</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {[
              { icon: '', label: 'Verification', sub: profile.verified ? 'Verified .edu email' : 'Not verified', action: null },
              { icon: '', label: 'Safety', sub: 'Tips for safe transactions', action: null },
              { icon: '', label: 'Help', sub: 'umarket.jr@gmail.com', action: null },
              { icon: '', label: 'Legal & Disclaimers', sub: 'Affiliations, liability & terms', action: () => setLegalOpen(true) },
            ].map(({ icon, label, sub, action }) => (
              <button
                key={label}
                onClick={action ?? undefined}
                disabled={!action}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl',
                  action ? 'hover:bg-gray-50 active:bg-gray-100' : 'cursor-default',
                ].join(' ')}
              >
                <span className="text-xl w-6 text-center shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
                {action && (
                  <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit listing modal */}
      {editingListing && (
        <EditListingModal
          listing={editingListing}
          onClose={() => setEditingListing(null)}
          onSaved={handleListingSaved}
        />
      )}

      {/* Boost listing modal */}
      {boostingListing && (
        <BoostModal
          listing={boostingListing}
          onClose={() => setBoostingListing(null)}
        />
      )}

      {/* Legal modal */}
      {legalOpen && <LegalModal onClose={() => setLegalOpen(false)} />}
    </div>
  )
}
