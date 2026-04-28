import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { CATEGORIES, CONDITIONS, GRADES } from '../constants/categories'
import Modal from './Modal'
import { checkRateLimit, rateLimitMessage } from '../lib/rateLimit'
import { validate, validateImageFile, sanitizeText, listingSchema } from '../lib/validation'
import { compressImage } from '../lib/compressImage'
import MapPreview from './MapPreview'

async function geocode(address, locationHint = '') {
  if (!address?.trim()) return null
  // Append the school's city/state so vague addresses resolve to the right area
  // e.g. "123 Main St" → "123 Main St, Salt Lake City, UT"
  const query = locationHint ? `${address.trim()}, ${locationHint}` : address.trim()
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=us`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'UMarket/1.0 contact@u-market.app' } }
    )
    const data = await res.json()
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {}
  return null
}

const MAX_IMAGES = 6

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function PostListingModal({ onClose, onPosted }) {
  const { user } = useAuth()
  const { school } = useSchool()
  const formRef = useRef(null)

  // Base fields
  const [title, setTitle]           = useState('')
  const [category, setCategory]     = useState('')
  const [price, setPrice]           = useState('')
  const [condition, setCondition]   = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation]     = useState('')
  // Housing-specific
  const [beds, setBeds]             = useState('')
  const [baths, setBaths]           = useState('')
  const [avail, setAvail]           = useState('')
  const [spotsAvailable, setSpotsAvailable] = useState('')
  // Clothing-specific
  const [clothingSize, setClothingSize] = useState('')
  const [gender, setGender]         = useState('')
  // Looking-for
  const [budget, setBudget]         = useState('')
  // Contact
  const [contactType, setContactType] = useState('phone')
  const [contactValue, setContactValue] = useState('')
  // Images
  const [files, setFiles]           = useState([])
  const [previews, setPreviews]     = useState([])
  // Map
  const [mapCoords, setMapCoords]   = useState(null) // { lat, lng }
  const [geocoding, setGeocoding]   = useState(false)
  // UI
  const [uploading, setUploading]   = useState(false)
  const [error, setError]           = useState('')

  const isHousing        = category === 'housing' || category === 'sublease'
  const isSublease       = category === 'sublease'
  const isLooking        = category === 'looking_for'
  const isLookingHousing = category === 'looking_housing' || category === 'looking_roommate'
  const isClothing       = category === 'clothing'
  const isEvents         = category === 'events'

  // Auto-geocode 800ms after the user stops typing in the address field
  useEffect(() => {
    if (!isHousing || !location.trim()) { setMapCoords(null); return }
    setGeocoding(true)
    const timer = setTimeout(async () => {
      const coords = await geocode(location, school?.location ?? '')
      setMapCoords(coords)
      setGeocoding(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [location, isHousing]) // eslint-disable-line

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files)
    // Validate each file for MIME type and size before accepting
    for (const file of selected) {
      const fileErr = validateImageFile(file)
      if (fileErr) { setError(fileErr); e.target.value = ''; return }
    }
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
      const compressed = await compressImage(file)
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const { error: upErr } = await supabase.storage
        .from('listing-images')
        .upload(path, compressed, { cacheControl: '31536000', upsert: false, contentType: 'image/jpeg' })
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

    // Rate limit: prevent spam posting (10 listings per hour per device)
    const rl = checkRateLimit('post_listing')
    if (!rl.allowed) { setError(rateLimitMessage('post_listing', rl.retryAfterMs)); return }

    // Schema-based input validation — type checks, length limits, allowed values
    const { valid, firstError } = validate(
      {
        title:         sanitizeText(title),
        category,
        description:   sanitizeText(description),
        location:      sanitizeText(location),
        // Pass null for fields that don't apply to this category so the
        // validator skips them (non-required empty fields are always valid)
        price:         (isLooking || isLookingHousing) ? null : price,
        budget:        (isLooking || isLookingHousing) ? budget : null,
        beds:          (isHousing || isLookingHousing) ? beds   : null,
        avail:         sanitizeText(avail),
        contact_value: sanitizeText(contactValue),
        contact_type:  contactType,
        condition:     (isLooking || isLookingHousing || isHousing) ? null : condition,
      },
      listingSchema,
    )
    if (!valid) { setError(firstError); return }

    setUploading(true)
    setError('')
    try {
      // Ensure we have a valid session before inserting
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr || !session) {
        throw new Error('Your session has expired. Please sign out and sign back in.')
      }

      // Ensure a profile row exists (FK target for seller_id)
      await supabase
        .from('profiles')
        .upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })

      const imageUrls = files.length ? await uploadImages() : []
      const { data: newListing, error: insertErr } = await supabase.from('listings').insert({
        title:       sanitizeText(title),
        category,
        description: sanitizeText(description),
        location:    sanitizeText(location),
        images:      imageUrls,
        seller_id:   user.id,
        school_id:   school.id,
        sold:        false,
        is_housing:  isHousing,
        is_looking:  isLooking || isLookingHousing,
        price:       (isLooking || isLookingHousing) ? null : (Number(price) || 0),
        condition:   (isLooking || isLookingHousing || isHousing) ? null : condition,
        budget:      (isLooking || isLookingHousing) ? (Number(budget) || null) : null,
        beds:            (isHousing || isLookingHousing) ? (Number(beds) || null) : null,
        size:            isHousing ? baths.trim() : isClothing ? clothingSize : null,
        gender:          isClothing ? gender : null,
        avail:           (isHousing || isLookingHousing || isEvents) ? sanitizeText(avail) : null,
        spots_available: isSublease ? (Number(spotsAvailable) || null) : null,
        contact_type: contactType,
        contact_value: sanitizeText(contactValue),
        lat:  mapCoords?.lat ?? null,
        lng:  mapCoords?.lng ?? null,
      }).select().single()
      if (insertErr) {
        console.error('Listing insert error:', insertErr)
        throw new Error(insertErr.message + (insertErr.hint ? ` — ${insertErr.hint}` : '') + (insertErr.details ? ` (${insertErr.details})` : ''))
      }
      if (onPosted && newListing) onPosted(newListing)
      else onClose()
    } catch (err) {
      console.error('Post listing error:', err)
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const footer = (
    <>
      {error && (
        <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}
      <button
        type="button"
        disabled={uploading}
        onClick={() => formRef.current?.requestSubmit()}
        className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {uploading ? 'Uploading & Posting…' : 'Post Listing'}
      </button>
    </>
  )

  return (
    <Modal onClose={onClose} fullHeight wide title="Post a Listing" footer={footer}>
      <form id="post-listing-form" ref={formRef} onSubmit={handleSubmit}>
        <h2 className="hidden sm:block text-xl font-bold text-gray-900 mb-5">Post a Listing</h2>

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
            type="text" inputMode="numeric" value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder={isLookingHousing ? 'Max Monthly Rent ($)' : 'Max Budget ($)'}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
        ) : (
          <input
            type="text" inputMode="numeric" value={price}
            onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="Price ($) — leave 0 for Free"
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
                type="number" value={baths} onChange={(e) => setBaths(e.target.value)}
                placeholder="# Bathrooms" min={0} step={0.5}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
              />
            )}
            <input
              value={avail} onChange={(e) => setAvail(e.target.value)}
              placeholder={isLookingHousing ? 'Move-in Date' : 'Available (e.g. Aug 2025)'}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
            />
          </div>
        )}

        {/* ── Sublease — spots available ────────────────────────────────────── */}
        {isSublease && (
          <input
            type="number" value={spotsAvailable} onChange={(e) => setSpotsAvailable(e.target.value)}
            placeholder="Spots available (# of subleasers needed)" min={1}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
        )}

        {/* ── Events — date & time ──────────────────────────────────────────── */}
        {isEvents && (
          <input
            value={avail} onChange={(e) => setAvail(e.target.value)}
            placeholder="Date & Time (e.g. Sat Mar 15, 7PM)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
        )}

        {/* ── Clothing fields ───────────────────────────────────────────────── */}
        {isClothing && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            <select
              value={clothingSize} onChange={(e) => setClothingSize(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-school-primary"
            >
              <option value="">Size (optional)</option>
              {['XS','S','M','L','XL','XXL','XXXL'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <select
              value={gender} onChange={(e) => setGender(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-school-primary"
            >
              <option value="">Gender (optional)</option>
              <option>Men&apos;s</option>
              <option>Women&apos;s</option>
              <option>Unisex</option>
            </select>
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
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={isHousing ? 'Full address (e.g. 123 Main St, Salt Lake City, UT)' : 'Location (e.g. near Rice-Eccles Stadium)'}
          maxLength={100}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-school-primary"
        />
        {isHousing && geocoding && (
          <p className="text-xs text-gray-400 mb-2">Finding location…</p>
        )}
        {isHousing && mapCoords && (
          <div className="mb-3">
            <MapPreview lat={mapCoords.lat} lng={mapCoords.lng} />
          </div>
        )}
        {isHousing && !mapCoords && !geocoding && location.trim() && (
          <p className="text-xs text-gray-400 mb-2">Enter a full address to see it on the map.</p>
        )}
        {!isHousing && <div className="mb-2" />}

        {/* ── Contact Info ──────────────────────────────────────────────────── */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            How can buyers reach you? *
          </p>
          <p className="text-xs text-gray-400 mb-2">(only shown when someone clicks Contact Seller)</p>
          <div className="flex gap-2">
            <select
              value={contactType}
              onChange={(e) => setContactType(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-school-primary"
            >
              <option value="phone">Phone</option>
              <option value="email">Email</option>
              <option value="instagram">Instagram</option>
              <option value="snapchat">Snapchat</option>
            </select>
            <input
              value={contactValue}
              onChange={(e) => {
                if (contactType === 'phone') {
                  setContactValue(formatPhone(e.target.value))
                } else {
                  setContactValue(e.target.value)
                }
              }}
              inputMode={contactType === 'phone' ? 'numeric' : 'text'}
              placeholder={
                contactType === 'phone' ? '(555) 000-0000'
                : contactType === 'email' ? 'you@example.com'
                : 'username (no @)'
              }
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
            />
          </div>
        </div>

      </form>
    </Modal>
  )
}
