import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CONDITIONS } from '../constants/categories'
import Modal from './Modal'

const MAX_IMAGES = 6

export default function EditListingModal({ listing, onClose, onSaved }) {
  const { user } = useAuth()

  const isHousing = listing.category === 'housing' || listing.category === 'sublease'
  const isLooking = listing.category === 'looking_for'

  const [title, setTitle]           = useState(listing.title ?? '')
  const [price, setPrice]           = useState(listing.price ?? '')
  const [budget, setBudget]         = useState(listing.budget ?? '')
  const [condition, setCondition]   = useState(listing.condition ?? '')
  const [description, setDescription] = useState(listing.description ?? '')
  const [location, setLocation]     = useState(listing.location ?? '')
  const [beds, setBeds]             = useState(listing.beds ?? '')
  const [size, setSize]             = useState(listing.size ?? '')
  const [avail, setAvail]           = useState(listing.avail ?? '')

  const [existingImages, setExistingImages] = useState(listing.images ?? [])
  const [newFiles, setNewFiles]             = useState([])
  const [newPreviews, setNewPreviews]       = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const totalImages = existingImages.length + newFiles.length

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files)
    const combined = [...newFiles, ...selected].slice(0, MAX_IMAGES - existingImages.length)
    setNewFiles(combined)
    setNewPreviews(combined.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
  }

  const removeExisting = (i) => setExistingImages(existingImages.filter((_, idx) => idx !== i))

  const removeNew = (i) => {
    URL.revokeObjectURL(newPreviews[i])
    const nf = newFiles.filter((_, idx) => idx !== i)
    setNewFiles(nf)
    setNewPreviews(nf.map((f) => URL.createObjectURL(f)))
  }

  const uploadNewImages = async () => {
    const urls = []
    for (const file of newFiles) {
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
    if (!title.trim()) { setError('Please add a title.'); return }
    setSaving(true)
    setError('')
    try {
      const newUrls   = newFiles.length ? await uploadNewImages() : []
      const allImages = [...existingImages, ...newUrls]
      const updates = {
        title:       title.trim(),
        description: description.trim(),
        location:    location.trim(),
        images:      allImages,
        price:       isLooking ? null : (Number(price) || 0),
        budget:      isLooking ? (Number(budget) || null) : null,
        condition:   isLooking || isHousing ? null : condition,
        beds:        isHousing ? (Number(beds) || null) : null,
        size:        isHousing ? size.trim() : null,
        avail:       isHousing ? avail.trim() : null,
      }
      const { error: updateErr } = await supabase
        .from('listings')
        .update(updates)
        .eq('id', listing.id)
        .eq('seller_id', user.id)
      if (updateErr) throw updateErr
      onSaved({ ...listing, ...updates })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} fullHeight wide>
      <form onSubmit={handleSubmit}>
        <h2 className="text-xl font-bold text-gray-900 mb-5">Edit Listing</h2>

        {/* Photos */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Photos (up to {MAX_IMAGES})
          </p>
          <div className="flex flex-wrap gap-2">
            {existingImages.map((url, i) => (
              <div key={`ex-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                <img src={url} className="w-full h-full object-cover" alt="" />
                <button type="button" onClick={() => removeExisting(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                  ×
                </button>
              </div>
            ))}
            {newPreviews.map((url, i) => (
              <div key={`new-${i}`} className="relative w-20 h-20 rounded-xl overflow-hidden border border-gray-200">
                <img src={url} className="w-full h-full object-cover" alt="" />
                <button type="button" onClick={() => removeNew(i)}
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">
                  ×
                </button>
              </div>
            ))}
            {totalImages < MAX_IMAGES && (
              <label className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 hover:border-school-primary flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:text-school-primary transition-colors">
                <span className="text-2xl leading-none">+</span>
                <span className="text-[10px] mt-0.5">Photo</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
              </label>
            )}
          </div>
        </div>

        {/* Title */}
        <input
          value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100}
          placeholder="Title *"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary"
        />

        {/* Price / Budget */}
        {isLooking ? (
          <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
            placeholder="Max Budget ($)" min={0}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary" />
        ) : !isHousing && (
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
            placeholder="Price ($)" min={0}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary" />
        )}

        {/* Housing fields */}
        {isHousing && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            <input type="number" value={beds} onChange={(e) => setBeds(e.target.value)}
              placeholder="# Beds" min={0}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
            <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size (1BR/1BA)"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
            <input value={avail} onChange={(e) => setAvail(e.target.value)} placeholder="Available"
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
          </div>
        )}

        {/* Condition */}
        {!isLooking && !isHousing && (
          <select value={condition} onChange={(e) => setCondition(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary bg-white">
            <option value="">Condition (optional)</option>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}

        {/* Description */}
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Description" rows={3} maxLength={2000}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 resize-none focus:outline-none focus:ring-1 focus:ring-school-primary" />

        {/* Location */}
        <input value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder="Location" maxLength={100}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-school-primary" />

        {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 hover:opacity-90 transition-opacity">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </Modal>
  )
}
