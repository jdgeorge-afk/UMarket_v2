import { useState, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { sanitizeText } from '../lib/validation'
import { SCHOOLS } from '../constants/schools'

const AD_SCHOOLS = SCHOOLS.filter((s) => s.id === 'utah')

const INDUSTRIES = [
  'Food & Drink',
  'Retail & Shopping',
  'Entertainment & Events',
  'Health & Fitness',
  'Real Estate',
  'Technology',
  'Finance & Banking',
  'Education & Tutoring',
  'Professional Services',
  'Travel & Transportation',
  'Beauty & Wellness',
  'Other',
]

const TIER_PRICES = { base: 1000, pinned: 1750, premium: 2750 }
const TIER_FULL   = { base: 2000, pinned: 3500, premium: 5500 }

const AD_TIERS = [
  { id: 'base',    label: 'Base',    sub: 'Rotates in the feed every 8 posts' },
  { id: 'pinned',  label: 'Pinned',  sub: 'Stays locked at the top of the feed' },
  { id: 'premium', label: 'Premium', sub: 'Full-width banner after the 6th listing' },
]

function calcPrice(tierId, numSchools) {
  const base = TIER_PRICES[tierId] ?? 0
  return Math.round(base * (1 + 0.5 * (numSchools - 1)))
}
function calcFull(tierId, numSchools) {
  return Math.round((TIER_FULL[tierId] ?? 0) * (1 + 0.5 * (numSchools - 1)))
}
function fmt(cents) {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`
}

// Shared input class — mirrors Facebook Marketplace's pill inputs
const INPUT = 'w-full bg-gray-100 rounded-xl px-4 py-3.5 text-[15px] text-gray-900 placeholder-gray-400 border-0 outline-none focus:ring-2 focus:ring-gray-300 transition-shadow'

export default function AdApplicationModal({ onClose }) {
  const { profile } = useAuth()

  const [contactName, setContactName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail]             = useState('')
  const [phone, setPhone]             = useState('')
  const [website, setWebsite]         = useState('')
  const [industry, setIndustry]       = useState('')
  const [adTier, setAdTier]           = useState('')
  const [description, setDescription] = useState('')
  const [targetSchools, setTargetSchools] = useState([])
  const [notes, setNotes]             = useState('')

  const [slogans, setSlogans]         = useState(['', '', ''])
  const [creatives, setCreatives]     = useState([null, null, null]) // File objects
  const [creativePreviews, setCreativePreviews] = useState([null, null, null]) // data URLs
  const fileInputRefs = [useRef(null), useRef(null), useRef(null)]

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const toggleSchool = (id) =>
    setTargetSchools((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )

  const numSchools  = Math.max(1, targetSchools.length)
  const weeklyPrice = useMemo(() => adTier ? calcPrice(adTier, numSchools) : 0, [adTier, numSchools])
  const fullPrice   = useMemo(() => adTier ? calcFull(adTier, numSchools)  : 0, [adTier, numSchools])

  const handleCreativeSelect = (idx, file) => {
    if (!file) return
    const updated = [...creatives]; updated[idx] = file; setCreatives(updated)
    const reader = new FileReader()
    reader.onload = (e) => {
      const prev = [...creativePreviews]; prev[idx] = e.target.result; setCreativePreviews(prev)
    }
    reader.readAsDataURL(file)
  }

  const removeCreative = (idx) => {
    const c = [...creatives]; c[idx] = null; setCreatives(c)
    const p = [...creativePreviews]; p[idx] = null; setCreativePreviews(p)
    if (fileInputRefs[idx].current) fileInputRefs[idx].current.value = ''
  }

  const uploadCreatives = async () => {
    const urls = []
    for (let i = 0; i < creatives.length; i++) {
      const file = creatives[i]
      if (!file) continue
      const ext  = file.name.split('.').pop() || 'jpg'
      const path = `ad-creatives/${Date.now()}-${i}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('listing-images')
        .upload(path, file, { cacheControl: '31536000', upsert: false })
      if (!upErr) {
        const { data: { publicUrl } } = supabase.storage.from('listing-images').getPublicUrl(path)
        urls.push({ url: publicUrl, slogan: slogans[i]?.trim() || '' })
      }
    }
    return urls
  }

  const handleCheckout = async (e) => {
    e.preventDefault()
    if (!companyName.trim() || !email.trim() || !industry) {
      setError('Please fill in your company name, email, and industry.')
      return
    }
    if (!adTier) { setError('Please select an ad placement.'); return }
    if (targetSchools.length === 0) { setError('Select at least one school.'); return }
    if (!description.trim()) { setError('Describe what you want to promote.'); return }

    setSaving(true)
    setError('')
    try {
      const creativeAssets = await uploadCreatives()
      const res = await supabase.functions.invoke('advertiser-checkout', {
        body: {
          contact_name:   sanitizeText(contactName),
          company_name:   sanitizeText(companyName),
          email:          email.trim().toLowerCase(),
          phone:          sanitizeText(phone),
          website:        sanitizeText(website),
          industry,
          tier:           adTier,
          description:    sanitizeText(description),
          target_schools: targetSchools,
          notes:          sanitizeText(notes),
          account_type:   profile?.account_type ?? 'other',
          creatives:      creativeAssets,
        },
      })
      if (res.error) throw new Error(res.error.message ?? 'Checkout failed')
      const { url } = res.data
      if (!url) throw new Error('No checkout URL returned')
      window.location.href = url
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setSaving(false)
    }
  }

  return (
    /* Full-screen overlay identical to Modal */
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      style={{ height: '100dvh' }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
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
        <span className="font-bold text-gray-900 text-base">Advertise with Us</span>
        <div className="w-9" /> {/* spacer */}
      </div>

      {/* ── Scrollable body ─────────────────────────────────────── */}
      <form
        onSubmit={handleCheckout}
        className="flex-1 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {/* Founding deal banner */}
        <div className="mx-4 mt-4 mb-2 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">🎉</span>
          <div>
            <p className="text-sm font-semibold text-yellow-800">50% off your first 2 weeks — founding advertiser rate</p>
            <p className="text-xs text-yellow-600">Limited time offer for early advertisers</p>
          </div>
        </div>

        {/* ── REQUIRED ─────────────────────────────────────────── */}
        <div className="px-4 pt-5 pb-2">
          <h2 className="text-xl font-bold text-gray-900">Required</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tell us about your business and what you're promoting.</p>
        </div>

        <div className="px-4 space-y-3 pb-4">
          <input
            className={INPUT}
            type="text"
            placeholder="Company or brand name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            maxLength={100}
            required
          />
          <input
            className={INPUT}
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            required
          />
          <select
            className={INPUT + ' appearance-none'}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            required
          >
            <option value="">Industry</option>
            {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
          </select>
          <textarea
            className={INPUT + ' resize-none min-h-[100px]'}
            placeholder="What do you want to promote? Tell students what makes you worth clicking."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={4}
          />
        </div>

        {/* ── AD PLACEMENT ─────────────────────────────────────── */}
        <div className="border-t border-gray-100 px-4 pt-5 pb-2">
          <h2 className="text-xl font-bold text-gray-900">Ad placement</h2>
          <p className="text-sm text-gray-500 mt-0.5">Choose where your ad appears in the feed.</p>
        </div>

        <div className="px-4 space-y-2 pb-4">
          {AD_TIERS.map((tier) => {
            const price = calcPrice(tier.id, numSchools)
            const full  = calcFull(tier.id, numSchools)
            const selected = adTier === tier.id
            return (
              <button
                type="button"
                key={tier.id}
                onClick={() => setAdTier(tier.id)}
                className={`w-full text-left rounded-xl px-4 py-3.5 border-2 transition-all ${
                  selected
                    ? 'border-school-primary bg-school-primary/5'
                    : 'border-transparent bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Radio indicator */}
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selected ? 'border-school-primary' : 'border-gray-300'
                    }`}>
                      {selected && <div className="w-2.5 h-2.5 rounded-full bg-school-primary" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{tier.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{tier.sub}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-bold text-gray-900 text-sm">{fmt(price)}<span className="text-xs font-normal text-gray-400">/wk</span></p>
                    <p className="text-xs text-gray-400 line-through">{fmt(full)}/wk</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* ── TARGET SCHOOLS ───────────────────────────────────── */}
        <div className="border-t border-gray-100 px-4 pt-5 pb-2">
          <h2 className="text-xl font-bold text-gray-900">Target schools</h2>
          <p className="text-sm text-gray-500 mt-0.5">Each additional school adds 50% to the weekly rate.</p>
        </div>

        <div className="px-4 pb-4 flex flex-wrap gap-2">
          {AD_SCHOOLS.map((school) => {
            const on = targetSchools.includes(school.id)
            return (
              <button
                type="button"
                key={school.id}
                onClick={() => toggleSchool(school.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                  on
                    ? 'bg-school-primary border-school-primary text-white'
                    : 'bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200'
                }`}
              >
                {school.shortName}
              </button>
            )
          })}
        </div>

        {/* Price summary when both tier + schools selected */}
        {adTier && targetSchools.length > 0 && (
          <div className="mx-4 mb-4 bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">{targetSchools.length} school{targetSchools.length > 1 ? 's' : ''} · weekly</p>
              <p className="font-bold text-gray-900">{fmt(weeklyPrice)}/wk</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 line-through">{fmt(fullPrice)}/wk regular</p>
              <span className="text-xs font-bold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">50% off first 2 wks</span>
            </div>
          </div>
        )}

        {/* ── MORE DETAILS ─────────────────────────────────────── */}
        <div className="border-t border-gray-100 px-4 pt-5 pb-2">
          <h2 className="text-xl font-bold text-gray-900">More details</h2>
          <p className="text-sm text-gray-500 mt-0.5">Optional — helps us set up your ad faster.</p>
        </div>

        <div className="px-4 space-y-3 pb-6">
          <input
            className={INPUT}
            type="text"
            placeholder="Your name"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            maxLength={100}
          />
          <input
            className={INPUT}
            type="tel"
            placeholder="Phone number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={20}
          />
          <input
            className={INPUT}
            type="url"
            placeholder="Website (https://)"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={200}
          />
          <textarea
            className={INPUT + ' resize-none'}
            placeholder="Anything else we should know? (timeline, questions, special requests)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
          />
        </div>

        {/* ── CREATIVE ASSETS ──────────────────────────────────── */}
        <div className="border-t border-gray-100 px-4 pt-5 pb-2">
          <h2 className="text-xl font-bold text-gray-900">Creative assets</h2>
          <p className="text-sm text-gray-500 mt-0.5">Upload up to 3 photos or flyers — we'll rotate them in your ad. Add a short slogan for each one.</p>
        </div>

        <div className="px-4 space-y-4 pb-8">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="bg-gray-50 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Creative {idx + 1}{idx === 0 ? ' (main)' : ' (optional)'}</p>

              {/* Image upload area */}
              {creativePreviews[idx] ? (
                <div className="relative rounded-xl overflow-hidden bg-gray-100" style={{ aspectRatio: '16/7' }}>
                  <img
                    src={creativePreviews[idx]}
                    alt={`Creative ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeCreative(idx)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRefs[idx].current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 py-7 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
                  style={{ minHeight: '100px' }}
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-sm font-medium">Add photo or flyer</span>
                  <span className="text-xs">JPG, PNG, PDF</span>
                </button>
              )}
              <input
                ref={fileInputRefs[idx]}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => handleCreativeSelect(idx, e.target.files?.[0])}
              />

              {/* Slogan input */}
              <input
                className={INPUT}
                type="text"
                placeholder={idx === 0 ? 'Slogan — e.g. "Best tacos near campus"' : 'Slogan (optional)'}
                value={slogans[idx]}
                onChange={(e) => {
                  const updated = [...slogans]; updated[idx] = e.target.value; setSlogans(updated)
                }}
                maxLength={80}
              />
              {slogans[idx] && (
                <p className="text-xs text-gray-400 text-right">{slogans[idx].length}/80</p>
              )}
            </div>
          ))}
        </div>
      </form>

      {/* ── Sticky footer ───────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 pt-3 pb-5 bg-white border-t border-gray-100"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {error && (
          <p className="text-red-500 text-sm mb-3 text-center">{error}</p>
        )}
        <p className="text-center text-xs text-gray-400 mb-2">
          Secured by Stripe · Card not charged until ad is approved
        </p>
        <button
          onClick={handleCheckout}
          disabled={saving}
          className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 transition-opacity hover:opacity-90"
        >
          {saving ? 'Redirecting to checkout…' : 'Checkout'}
        </button>
      </div>
    </div>
  )
}
