import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { CATEGORIES, CONDITIONS, GRADES } from '../constants/categories'
import Modal from './Modal'

const MAX_IMAGES = 6

export default function PostListingModal({ onClose }) {
  const { user } = useAuth()
  const { school } = useSchool()

  // Base fields
  const [title, setTitle]           = useState('')
  const [category, setCategory]     = useState('')
  const [price, setPrice]           = useState('')
  const [condition, setCondition]   = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation]     = useState('')
  // Housing-specific
  const [beds, setBeds]             = useState('')
  const [size, setSize]             = useState('')
  const [avail, setAvail]           = useState('')
  // Looking-for
  const [budget, setBudget]         = useState('')
  // Images
  const [files, setFiles]           = useState([])
  const [previews, setPreviews]     = useState([])
  // UI
  const [uploading, setUploading]   = useState(false)
  const [error, setError]           = useState('')

  const isHousing       = category === 'housing' || category === 'sublease'
  const isLooking       = category === 'looking_for'
  const isLookingHousing = category === 'looking_housing'

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files)
    const combined = [...files, ...selected].slice(0, MAX_IMAGES)
    setFiles(combined)
    setPreviews(combined.map((f) => URL.createObjectURL(f)))
    e.target.value = '' // allow re-selecting same file
  }

  const removeImage = (i) => {
    URL.revokeObjectURL(previews[i])
    const newFiles = files.filter((_, idx) => idx !== i)
    setFiles(newFiles)
    setPreviews(newFiles.map((f) => URL.createObjectURL(f)))
  }

  const uploadImages = async () => {
    const urls = []
    for (const file of files) {
      const ext  = file.name.split('.').pop()
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('listing-images')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage
        .from('listing-images')
        .getPublicUrl(path)
      urls.push(publicUrl)
    }
    return urls
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!category) { setError('Please select a category.'); return }
    if (!title.trim()) { setError('Please add a title.'); return }
    setUploading(true)
    setError('')
    try {
      const imageUrls = files.length ? await uploadImages() : []
      const { error: insertErr } = await supabase.from('listings').insert({
        title:       title.trim(),
        category,
        description: description.trim(),
        location:    location.trim(),
        images:      imageUrls,
        seller_id:   user.id,
        school_id:   school.id,
        is_housing:  isHousing,
        is_looking:  isLooking || isLookingHousing,
        price:       (isLooking || isLookingHousing) ? null : (Number(price) || 0),
        condition:   (isLooking || isLookingHousing || isHousing) ? null : condition,
        budget:      (isLooking || isLookingHousing) ? (Number(budget) || null) : null,
        beds:        (isHousing || isLookingHousing) ? (Number(beds) || null) : null,
        size:        isHousing ? size.trim() : null,
        avail:       (isHousing || isLookingHousing) ? avail.trim() : null,
      })
      if (insertErr) throw insertErr
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal onClose={onClose} fullHeight wide>
      <form onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold text-gray-900 mb-5">Post a Listing</h2>

        {/* ── Image upload ─────────────────────────────────────────────────── */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Photos (up to {MAX_IMAGES})
          </p>
          <div className="flex flex-wrap gap-2">
            {previews.map((url, i) => (
              <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                <img src={url} className="w-full h-full object-cover" alt="" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold leading-none hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            {files.length < MAX_IMAGES && (
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-school-primary flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:text-school-primary transition-colors">
                <span className="text-2xl leading-none">+</span>
                <span className="text-[10px] mt-0.5">Photo</span>
                <input
                  type="file" accept="image/*" multiple className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            )}
          </div>
        </div>

        {/* ── Category ─────────────────────────────────────────────────────── */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category *</p>
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={[
                  'flex items-center gap-1.5 px-2 py-2 rounded-xl border text-xs font-medium transition-colors',
                  category === c.id
                    ? 'border-school-primary bg-school-primary/5 text-school-primary'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                ].join(' ')}
              >
                <span>{c.icon}</span> {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100}
          placeholder="Title *"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary"
        />

        {/* ── Price or Budget ───────────────────────────────────────────────── */}
        {(isLooking || isLookingHousing) ? (
          <input
            type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
            placeholder={isLookingHousing ? 'Max Monthly Rent ($)' : 'Max Budget ($)'} min={0}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
        ) : (
          <input
            type="number" value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder="Price ($) — leave 0 for Free" min={0}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
        )}

        {/* ── Housing fields ────────────────────────────────────────────────── */}
        {(isHousing || isLookingHousing) && (
          <div className={`grid gap-2 mb-3 ${isHousing ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <input
              type="number" value={beds} onChange={(e) => setBeds(e.target.value)}
              placeholder="# Beds" min={0}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
            />
            {isHousing && (
              <input
                value={size} onChange={(e) => setSize(e.target.value)}
                placeholder="Size (e.g. 1BR/1BA)"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
              />
            )}
            <input
              value={avail} onChange={(e) => setAvail(e.target.value)}
              placeholder={isLookingHousing ? 'Move-in Date' : 'Available (Aug 2025)'}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
            />
          </div>
        )}

        {/* ── Condition ─────────────────────────────────────────────────────── */}
        {!isLooking && !isLookingHousing && !isHousing && (
          <select
            value={condition} onChange={(e) => setCondition(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary bg-white"
          >
            <option value="">Condition (optional)</option>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}

        {/* ── Description ───────────────────────────────────────────────────── */}
        <textarea
          value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Description — the more detail, the better" rows={3} maxLength={2000}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 resize-none focus:outline-none focus:ring-1 focus:ring-school-primary"
        />

        {/* ── Location ──────────────────────────────────────────────────────── */}
        <input
          value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (e.g. near Rice-Eccles Stadium)" maxLength={100}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-school-primary"
        />

        {error && (
          <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>
        )}

        <button
          type="submit" disabled={uploading}
          className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {uploading ? 'Uploading & Posting…' : '🚀 Post Listing'}
        </button>
      </form>
    </Modal>
  )
}
