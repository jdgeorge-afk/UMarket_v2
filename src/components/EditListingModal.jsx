import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { CONDITIONS } from '../constants/categories'
import Modal from './Modal'
import { checkRateLimit, rateLimitMessage } from '../lib/rateLimit'
import { validate, validateImageFile, sanitizeText, editListingSchema } from '../lib/validation'
import { compressImage } from '../lib/compressImage'

const MAX_IMAGES = 6

export default function EditListingModal({ listing, onClose, onSaved }) {
  const { user } = useAuth()

  const isHousing        = listing.category === 'housing' || listing.category === 'sublease'
  const isSublease       = listing.category === 'sublease'
  const isLooking        = listing.category === 'looking_for'
  const isLookingHousing = listing.category === 'looking_housing' || listing.category === 'looking_roommate'
  const isEvents         = listing.category === 'events'

  const [title, setTitle]           = useState(listing.title ?? '')
  const [price, setPrice]           = useState(listing.price ?? '')
  const [budget, setBudget]         = useState(listing.budget ?? '')
  const [condition, setCondition]   = useState(listing.condition ?? '')
  const [description, setDescription] = useState(listing.description ?? '')
  const [location, setLocation]     = useState(listing.location ?? '')
  const [beds, setBeds]             = useState(listing.beds ?? '')
  const [size, setSize]             = useState(listing.size ?? '')
  const [avail, setAvail]           = useState(listing.avail ?? '')
  const [spotsAvailable, setSpotsAvailable] = useState(listing.spots_available ?? '')

  const [existingImages, setExistingImages] = useState(listing.images ?? [])
  const [newFiles, setNewFiles]             = useState([])
  const [newPreviews, setNewPreviews]       = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const totalImages = existingImages.length + newFiles.length

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files)
    // Validate each file for MIME type and size before accepting
    for (const file of selected) {
      const fileErr = validateImageFile(file)
      if (fileErr) { setError(fileErr); e.target.value = ''; return }
    }
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
      const compressed = await compressImage(file)
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const { error: upErr } = await supabase.storage
        .from('listing-images')
        .upload(path, compressed, { cacheControl: '3600', upsert: false, contentType: 'image/jpeg' })
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

    // Rate limit: prevent bulk edits (20 edits per hour per device)
    const rl = checkRateLimit('edit_listing')
    if (!rl.allowed) { setError(rateLimitMessage('edit_listing', rl.retryAfterMs)); return }

    // Schema-based input validation
    const { valid, firstError } = validate(
      {
        title:       sanitizeText(title),
        description: sanitizeText(description),
        location:    sanitizeText(location),
        price:       (isLooking || isLookingHousing) ? null : price,
        budget:      (isLooking || isLookingHousing) ? budget : null,
        beds:        (isHousing || isLookingHousing) ? beds   : null,
        avail:       sanitizeText(avail),
      },
      editListingSchema,
    )
    if (!valid) { setError(firstError); return }

    if (isHousing && !location.trim()) {
      setError('Please enter the full address so we can show it on the map.')
      return
    }

    if (isHousing && (!price || Number(price) < 1)) {
      setError('Please enter a monthly rent amount greater than $0.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const newUrls   = newFiles.length ? await uploadNewImages() : []
      const allImages = [...existingImages, ...newUrls]
      const newPrice = (isLooking || isLookingHousing) ? null : (Number(price) || 0)
      const oldPrice = Number(listing.price) || 0
      const now = new Date().toISOString()
      const priceDrop = newPrice !== null && newPrice < oldPrice ? now : (newPrice > oldPrice ? null : listing.price_dropped_at ?? null)
      const updates = {
        title:       sanitizeText(title),
        description: sanitizeText(description),
        location:    sanitizeText(location),
        images:      allImages,
        price:       newPrice,
        budget:      (isLooking || isLookingHousing) ? (Number(budget) || null) : null,
        condition:   (isLooking || isLookingHousing || isHousing) ? null : condition,
        beds:            (isHousing || isLookingHousing) ? (Number(beds) || null) : null,
        size:            isHousing ? sanitizeText(size) : null,
        avail:           (isHousing || isLookingHousing || isEvents) ? sanitizeText(avail) : null,
        spots_available: isSublease ? (Number(spotsAvailable) || null) : null,
        updated_at:      now,
        price_dropped_at: priceDrop,
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
    <Modal onClose={onClose} fullHeight wide title="Edit Listing">
      <form onSubmit={handleSubmit}>
        <h2 className="hidden sm:block text-xl font-bold text-gray-900 mb-5">Edit Listing</h2>

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
        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Title *</label>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={100}
            placeholder="Title"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
        </div>

        {/* Price / Budget */}
        {(isLooking || isLookingHousing) ? (
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              {isLookingHousing ? 'Max Monthly Rent ($)' : 'Max Budget ($)'}
            </label>
            <input type="text" inputMode="numeric" value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
          </div>
        ) : (
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              {isHousing ? 'Monthly Rent ($)' : 'Price ($)'}
            </label>
            <input type="text" inputMode="numeric" value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="0"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
          </div>
        )}

        {/* Housing fields */}
        {(isHousing || isLookingHousing) && (
          <div className={`grid gap-2 mb-3 ${isHousing ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Bedrooms</label>
              <input type="number" value={beds} onChange={(e) => setBeds(e.target.value)} min={0}
                placeholder="0"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
            </div>
            {isHousing && (
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Bathrooms</label>
                <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 1.5"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                {isLookingHousing ? 'Move-in Date' : 'Available'}
              </label>
              <input value={avail} onChange={(e) => setAvail(e.target.value)}
                placeholder={isLookingHousing ? 'e.g. Aug 2025' : 'e.g. Aug 2025'}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
            </div>
          </div>
        )}

        {/* Sublease — spots available */}
        {isSublease && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Spots Available</label>
            <input type="number" value={spotsAvailable} onChange={(e) => setSpotsAvailable(e.target.value)} min={1}
              placeholder="# of subleasers needed"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
          </div>
        )}

        {/* Events — date & time */}
        {isEvents && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Date & Time</label>
            <input value={avail} onChange={(e) => setAvail(e.target.value)}
              placeholder="e.g. Sat Mar 15, 7PM"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
          </div>
        )}

        {/* Condition */}
        {!isLooking && !isLookingHousing && !isHousing && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Condition</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary bg-white">
              <option value="">Select condition</option>
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* Description */}
        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your listing" rows={3} maxLength={2000}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-school-primary" />
        </div>

        {/* Location */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{isHousing ? 'Address *' : 'Location'}</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. near campus" maxLength={100}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary" />
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 hover:opacity-90 transition-opacity">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </Modal>
  )
}
