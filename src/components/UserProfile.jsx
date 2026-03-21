import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { GRADES } from '../constants/categories'
import ListingCard from './ListingCard'

export default function UserProfile({ userId, onBack, onOpenListing, onRequireAuth }) {
  const { user, profile: myProfile, updateProfile } = useAuth()
  const { school } = useSchool()
  const [profile, setProfile]   = useState(null)
  const [listings, setListings] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)

  // Edit form state
  const [editName, setEditName]               = useState('')
  const [editGrade, setEditGrade]             = useState('')
  const [editContact, setEditContact]         = useState('')
  const [editContactType, setEditContactType] = useState('phone')
  const [saving, setSaving]                   = useState(false)
  const [saveError, setSaveError]             = useState('')

  const isOwn = user?.id === userId

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

  const startEdit = () => {
    setEditName(profile?.name ?? '')
    setEditGrade(profile?.grade ?? '')
    setEditContact(profile?.contact ?? '')
    setEditContactType(profile?.contact_type ?? 'phone')
    setSaveError('')
    setEditing(true)
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
        <p className="text-5xl mb-3">🤷</p>
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
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white font-extrabold text-3xl shrink-0"
            style={{ background: school?.gradient ?? 'var(--school-gradient)' }}
          >
            {profile.name?.[0]?.toUpperCase() ?? '?'}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
              {profile.name}
              {profile.verified && (
                <span className="flex items-center gap-1 text-blue-500 text-sm font-semibold">
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Verified
                </span>
              )}
            </h1>
            {profile.grade && (
              <p className="text-sm text-gray-400">{profile.grade}</p>
            )}
            {/* Stats */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`font-bold text-sm ${scoreColor}`}>⭐ {profile.score} score</span>
              <span className="text-gray-400 text-sm">{profile.sold_count ?? 0} sold</span>
              <span className="text-gray-400 text-sm">{profile.transactions ?? 0} transactions</span>
            </div>
          </div>

          {/* Edit button (own profile) */}
          {isOwn && !editing && (
            <button
              onClick={startEdit}
              className="shrink-0 text-xs text-school-primary border border-school-primary/30 px-3 py-1.5 rounded-lg hover:bg-school-primary/5"
            >
              Edit Profile
            </button>
          )}
        </div>

        {/* Edit form */}
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
                <option value="phone">📱 Phone</option>
                <option value="email">✉️ Email</option>
                <option value="instagram">📸 Instagram</option>
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
              <button
                onClick={saveEdit} disabled={saving}
                className="flex-1 bg-school-primary text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Active listings */}
      <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
        Active Listings
        <span className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full">{activeListings.length}</span>
      </h2>
      {activeListings.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {activeListings.map((l) => (
            <ListingCard key={l.id} listing={l} onOpen={onOpenListing} onRequireAuth={onRequireAuth ?? ((cb) => cb())} />
          ))}
        </div>
      ) : (
        <p className="text-gray-400 text-sm mb-6">No active listings.</p>
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
              <ListingCard key={l.id} listing={l} onOpen={onOpenListing} onRequireAuth={onRequireAuth ?? ((cb) => cb())} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
