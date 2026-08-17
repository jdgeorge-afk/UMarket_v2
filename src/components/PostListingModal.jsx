import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import { CATEGORIES, CONDITIONS } from '../constants/categories'
import { checkRateLimit, rateLimitMessage } from '../lib/rateLimit'
import { validate, validateImageFile, sanitizeText, listingSchema } from '../lib/validation'
import { compressImage } from '../lib/compressImage'
import MapPreview from './MapPreview'
import { clearListingsCache } from '../hooks/useListings'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY

async function geocode(address, locationHint = '') {
  if (!address?.trim() || !MAPS_KEY) return null
  try {
    const full = locationHint ? `${address.trim()}, ${locationHint}` : address.trim()
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(full)}&key=${MAPS_KEY}`
    )
    if (res.ok) {
      const data = await res.json()
      const loc = data?.results?.[0]?.geometry?.location
      if (loc) return { lat: loc.lat, lng: loc.lng }
    }
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

// Shared input style — gray pill, no border, placeholder-only
const I = 'w-full bg-gray-100 rounded-2xl px-4 py-4 text-[15px] text-gray-900 placeholder-gray-400 border-0 outline-none focus:ring-2 focus:ring-school-primary/30 transition-shadow'
const S = I + ' appearance-none'

export default function PostListingModal({ onClose, onPosted }) {
  const { user } = useAuth()
  const { school } = useSchool()
  const formRef = useRef(null)

  const [title, setTitle]           = useState('')
  const [category, setCategory]     = useState('')
  const [price, setPrice]           = useState('')
  const [condition, setCondition]   = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation]     = useState('')
  const [beds, setBeds]             = useState('')
  const [baths, setBaths]           = useState('')
  const [avail, setAvail]           = useState('')
  const [spotsAvailable, setSpotsAvailable] = useState('')
  const [clothingSize, setClothingSize] = useState('')
  const [gender, setGender]         = useState('')
  const [budget, setBudget]         = useState('')
  const [contactType, setContactType] = useState('phone')
  const [contactValue, setContactValue] = useState('')
  const [files, setFiles]           = useState([])
  const [previews, setPreviews]     = useState([])
  const [mapCoords, setMapCoords]   = useState(null)
  const [geocoding, setGeocoding]   = useState(false)
  const [geocodeError, setGeocodeError] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [error, setError]           = useState('')

  const isHousing        = category === 'housing' || category === 'sublease'
  const isSublease       = category === 'sublease'
  const isLooking        = category === 'looking_for'
  const isLookingHousing = category === 'looking_housing' || category === 'looking_roommate'
  const isRoommate       = category === 'looking_roommate'
  const isClothing       = category === 'clothing'
  const isEvents         = category === 'events'

  useEffect(() => {
    if (!isHousing || !location.trim()) {
      setMapCoords(null)
      setGeocodeError(false)
      return
    }
    setGeocoding(true)
    setGeocodeError(false)
    const timer = setTimeout(async () => {
      const coords = await geocode(location, school?.location ?? '')
      setMapCoords(coords)
      setGeocodeError(!coords)
      setGeocoding(false)
    }, 800)
    return () => clearTimeout(timer)
  }, [location, isHousing]) // eslint-disable-line

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files)
    for (const file of selected) {
      const fileErr = validateImageFile(file)
      if (fileErr) { setError(fileErr); e.target.value = ''; return }
    }
    const combined = [...files, ...selected].slice(0, MAX_IMAGES)
    setFiles(combined)
    setPreviews(combined.map((f) => URL.createObjectURL(f)))
    e.target.value = ''
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
      const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path)
      urls.push(publicUrl)
    }
    return urls
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()

    const rl = checkRateLimit('post_listing')
    if (!rl.allowed) { setError(rateLimitMessage('post_listing', rl.retryAfterMs)); return }

    const { valid, firstError } = validate(
      {
        title:         sanitizeText(title),
        category,
        description:   sanitizeText(description),
        location:      sanitizeText(location),
        price:         (isLooking || isLookingHousing) ? null : price,
        budget:        (isLooking || isLookingHousing) ? budget : null,
        beds:          (isHousing || isLookingHousing) ? beds : null,
        avail:         sanitizeText(avail),
        contact_value: sanitizeText(contactValue),
        contact_type:  contactType,
        condition:     (isLooking || isLookingHousing || isHousing) ? null : condition,
      },
      listingSchema,
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

    setUploading(true)
    setError('')
    try {
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr || !session) throw new Error('Your session has expired. Please sign out and sign back in.')

      await supabase.from('profiles').upsert({ id: user.id }, { onConflict: 'id', ignoreDuplicates: true })

      const imageUrls = files.length ? await uploadImages() : []
      const { data: newListing, error: insertErr } = await supabase.from('listings').insert({
        title:           sanitizeText(title),
        category,
        description:     sanitizeText(description),
        location:        sanitizeText(location),
        images:          imageUrls,
        seller_id:       user.id,
        school_id:       school.id,
        sold:            false,
        is_housing:      isHousing,
        is_looking:      isLooking || isLookingHousing,
        price:           (isLooking || isLookingHousing) ? null : (Number(price) || 0),
        condition:       (isLooking || isLookingHousing || isHousing) ? null : condition,
        budget:          (isLooking || isLookingHousing) ? (Number(budget) || null) : null,
        beds:            (isHousing || isLookingHousing) ? (Number(beds) || null) : null,
        size:            isHousing ? baths.trim() : isClothing ? clothingSize : null,
        gender:          isClothing ? gender : (isRoommate ? gender : null),
        avail:           (isHousing || isLookingHousing || isEvents) ? sanitizeText(avail) : null,
        spots_available: isSublease ? (Number(spotsAvailable) || null) : null,
        contact_type:    contactType,
        contact_value:   sanitizeText(contactValue),
        lat:             mapCoords?.lat ?? null,
        lng:             mapCoords?.lng ?? null,
      }).select().single()

      if (insertErr) throw new Error(insertErr.message + (insertErr.hint ? ` — ${insertErr.hint}` : ''))
      clearListingsCache()
      if (onPosted && newListing) onPosted(newListing)
      else onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  const listCats = CATEGORIES.filter((c) => c.id !== 'all')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ height: '100dvh' }}>

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="font-bold text-gray-900 text-base">New Listing</span>
        <div className="w-9" />
      </div>

      {/* ── Scrollable body ────────────────────────────────────── */}
      <div
        ref={formRef}
        className="flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >

        {/* ── Photos ───────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-2">
          <h2 className="text-xl font-bold text-gray-900">Photos</h2>
          <p className="text-sm text-gray-500 mt-0.5">Add up to {MAX_IMAGES} photos. First photo is the cover.</p>
        </div>
        <div className="px-4 pb-5">
          {/* Big add zone when no photos yet */}
          {previews.length === 0 && (
            <label className="flex flex-col items-center justify-center w-full h-44 bg-gray-100 rounded-2xl cursor-pointer hover:bg-gray-200 transition-colors mb-3">
              <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-sm font-semibold text-gray-500">Add photos / video</span>
              <span className="text-xs text-gray-400 mt-1">Tap to upload</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
            </label>
          )}
          {/* Thumbnail strip once photos are added */}
          {previews.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {previews.map((url, i) => (
                <div key={i} className="relative w-24 h-24 rounded-2xl overflow-hidden bg-gray-100">
                  <img src={url} className="w-full h-full object-cover" alt="" />
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">Cover</span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-xs flex items-center justify-center font-bold leading-none"
                  >×</button>
                </div>
              ))}
              {files.length < MAX_IMAGES && (
                <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer text-gray-400 hover:border-school-primary hover:text-school-primary transition-colors">
                  <span className="text-2xl leading-none">+</span>
                  <span className="text-[10px] mt-0.5 font-semibold">Add</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
                </label>
              )}
            </div>
          )}
          <p className="text-xs text-gray-400">Photos: {files.length}/{MAX_IMAGES}</p>
        </div>

        {/* ── Required ─────────────────────────────────────────── */}
        <div className="border-t border-gray-100 px-4 pt-5 pb-2">
          <h2 className="text-xl font-bold text-gray-900">Required</h2>
          <p className="text-sm text-gray-500 mt-0.5">Let buyers know exactly what you are listing.</p>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Category chips */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Category</p>
            <div className="flex flex-wrap gap-2">
              {listCats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                    category === c.id
                      ? 'border-school-primary bg-school-primary/5 text-school-primary'
                      : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <input
            className={I}
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
          />

          {/* Price / Budget */}
          {(isLooking || isLookingHousing) ? (
            <input
              className={I}
              type="text"
              inputMode="numeric"
              placeholder={isLookingHousing ? 'Max monthly rent ($)' : 'Max budget ($)'}
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          ) : (
            <input
              className={I}
              type="text"
              inputMode="numeric"
              placeholder="Price ($) — leave 0 for Free"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          )}

          {/* Address — required for housing/sublease listings only */}
          {isHousing && (
            <>
              <input
                className={I}
                placeholder="Full address (e.g. 123 Main St, Salt Lake City, UT)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
              />
              {geocoding && (
                <p className="text-xs text-gray-400 px-1">Finding location on map…</p>
              )}
              {geocodeError && !geocoding && (
                <p className="text-xs text-red-400 px-1">Address not found — try adding city and state (e.g. 123 Main St, Salt Lake City, UT)</p>
              )}
              {mapCoords && !geocoding && (
                <MapPreview lat={mapCoords.lat} lng={mapCoords.lng} />
              )}
            </>
          )}
        </div>

        {/* ── Category-specific fields ─────────────────────────── */}
        {(isHousing || isLookingHousing || isEvents || isSublease || isRoommate || isClothing) && (
          <>
            <div className="border-t border-gray-100 px-4 pt-5 pb-2">
              <h2 className="text-xl font-bold text-gray-900">More details</h2>
              <p className="text-sm text-gray-500 mt-0.5">Additional information about your listing.</p>
            </div>
            <div className="px-4 pb-4 space-y-3">

              {/* Housing / Looking housing: beds, baths, availability */}
              {(isHousing || isLookingHousing) && (
                <div className={`grid gap-3 ${isHousing ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <input
                    className={I}
                    type="number"
                    placeholder="Beds"
                    value={beds}
                    onChange={(e) => setBeds(e.target.value)}
                    min={0}
                  />
                  {isHousing && (
                    <input
                      className={I}
                      type="number"
                      placeholder="Baths"
                      value={baths}
                      onChange={(e) => setBaths(e.target.value)}
                      min={0}
                      step={0.5}
                    />
                  )}
                  <input
                    className={I}
                    placeholder={isLookingHousing ? 'Move-in date' : 'Available (e.g. Aug 2025)'}
                    value={avail}
                    onChange={(e) => setAvail(e.target.value)}
                  />
                </div>
              )}

              {/* Sublease: spots */}
              {isSublease && (
                <input
                  className={I}
                  type="number"
                  placeholder="Spots available (# of subleasers needed)"
                  value={spotsAvailable}
                  onChange={(e) => setSpotsAvailable(e.target.value)}
                  min={1}
                />
              )}

              {/* Roommate: gender preference */}
              {isRoommate && (
                <select className={S} value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">Gender preference (optional)</option>
                  <option>Male preferred</option>
                  <option>Female preferred</option>
                  <option>Non-binary preferred</option>
                  <option>No preference</option>
                </select>
              )}

              {/* Events: date/time */}
              {isEvents && (
                <input
                  className={I}
                  placeholder="Date & time (e.g. Sat Mar 15, 7 PM)"
                  value={avail}
                  onChange={(e) => setAvail(e.target.value)}
                />
              )}

              {/* Clothing: size + gender */}
              {isClothing && (
                <div className="grid grid-cols-2 gap-3">
                  <select className={S} value={clothingSize} onChange={(e) => setClothingSize(e.target.value)}>
                    <option value="">Size (optional)</option>
                    {['XS','S','M','L','XL','XXL','XXXL'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <select className={S} value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Gender (optional)</option>
                    <option>Men's</option>
                    <option>Women's</option>
                    <option>Unisex</option>
                  </select>
                </div>
              )}

            </div>
          </>
        )}

        {/* ── Condition (non-housing, non-looking) ─────────────── */}
        {!isLooking && !isLookingHousing && !isHousing && category && (
          <div className="px-4 pb-4">
            <select className={S} value={condition} onChange={(e) => setCondition(e.target.value)}>
              <option value="">Condition (optional)</option>
              {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
        )}

        {/* ── Description ──────────────────────────────────────── */}
        <div className="border-t border-gray-100 px-4 pt-5 pb-2">
          <h2 className="text-xl font-bold text-gray-900">Description</h2>
          <p className="text-sm text-gray-500 mt-0.5">The more detail, the faster it sells.</p>
        </div>
        <div className="px-4 pb-4">
          <textarea
            className={I + ' resize-none min-h-[110px]'}
            placeholder="Describe what you're listing — condition, extras, reason for selling…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={2000}
          />
        </div>

        {/* ── Location (non-housing only — optional general area) ── */}
        {!isHousing && (
          <>
            <div className="border-t border-gray-100 px-4 pt-5 pb-2">
              <h2 className="text-xl font-bold text-gray-900">Location</h2>
              <p className="text-sm text-gray-500 mt-0.5">Optional — general area, landmark, or neighborhood.</p>
            </div>
            <div className="px-4 pb-4">
              <input
                className={I}
                placeholder="Location (e.g. near campus, downtown)"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
              />
            </div>
          </>
        )}

        {/* ── Contact ──────────────────────────────────────────── */}
        <div className="border-t border-gray-100 px-4 pt-5 pb-2">
          <h2 className="text-xl font-bold text-gray-900">Contact</h2>
          <p className="text-sm text-gray-500 mt-0.5">Only shown when someone taps "I'm Interested".</p>
        </div>
        <div className="px-4 pb-8 space-y-3">
          {/* Contact type chips */}
          <div className="flex gap-2 flex-wrap">
            {[
              { value: 'phone',     label: 'Phone' },
              { value: 'email',     label: 'Email' },
              { value: 'instagram', label: 'Instagram' },
              { value: 'snapchat',  label: 'Snapchat' },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setContactType(t.value)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                  contactType === t.value
                    ? 'border-school-primary bg-school-primary/5 text-school-primary'
                    : 'border-transparent bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            className={I}
            type={contactType === 'email' ? 'email' : 'text'}
            inputMode={contactType === 'phone' ? 'numeric' : 'text'}
            placeholder={
              contactType === 'phone'     ? '(555) 000-0000'
              : contactType === 'email'   ? 'you@example.com'
              : 'username (no @)'
            }
            value={contactValue}
            onChange={(e) => {
              if (contactType === 'phone') setContactValue(formatPhone(e.target.value))
              else setContactValue(e.target.value)
            }}
          />
        </div>

      </div>{/* end scroll body */}

      {/* ── Sticky footer ─────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 pt-3 pb-5 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {error && (
          <p className="text-red-500 text-sm mb-3 text-center">{error}</p>
        )}
        <button
          type="button"
          disabled={uploading}
          onClick={handleSubmit}
          className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {uploading ? 'Uploading & Posting…' : 'Post Listing'}
        </button>
      </div>

    </div>
  )
}
