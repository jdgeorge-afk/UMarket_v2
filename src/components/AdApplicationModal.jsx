import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'
import { sanitizeText } from '../lib/validation'

const LIVE_SCHOOLS = [
  'University of Utah',
]

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

const AD_TIERS = [
  {
    id:            'base',
    label:         'Base',
    price:         '$20',
    discountPrice: '$10',
    tagline:       'Rotating card in the feed',
    description:   'Your ad appears as a sponsored card injected throughout the listing feed, rotating with other base ads.',
  },
  {
    id:            'pinned',
    label:         'Pinned',
    price:         '$35',
    discountPrice: '$17.50',
    tagline:       'Locked at the top of the feed',
    description:   'Your card stays permanently at the top of the feed — always the first thing students see when they browse.',
  },
  {
    id:            'premium',
    label:         'Premium',
    price:         '$55',
    discountPrice: '$27.50',
    tagline:       'Full-width block in the feed',
    description:   'A large banner that spans the entire listing grid after the 6th post — maximum visibility with your logo, message, and a link.',
  },
]

export default function AdApplicationModal({ onClose }) {
  const [step, setStep] = useState(1)

  const [contactName, setContactName]   = useState('')
  const [companyName, setCompanyName]   = useState('')
  const [email, setEmail]               = useState('')
  const [phone, setPhone]               = useState('')
  const [website, setWebsite]           = useState('')
  const [industry, setIndustry]           = useState('')
  const [adTier, setAdTier]               = useState('')
  const [description, setDescription]     = useState('')
  const [targetSchools, setTargetSchools] = useState([])
  const [notes, setNotes]                 = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const toggleSchool = (school) =>
    setTargetSchools((prev) =>
      prev.includes(school) ? prev.filter((s) => s !== school) : [...prev, school]
    )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!contactName.trim() || !companyName.trim() || !email.trim() || !industry || !adTier || !description.trim()) {
      setError('Please fill in all required fields.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const tier = AD_TIERS.find((t) => t.id === adTier)
      const { error: insertErr } = await supabase.from('ad_applications').insert({
        contact_name:   sanitizeText(contactName),
        company_name:   sanitizeText(companyName),
        email:          email.trim().toLowerCase(),
        phone:          sanitizeText(phone),
        website:        sanitizeText(website),
        industry,
        ad_type:        `${tier.label} — ${tier.tagline} (${tier.price}/wk)`,
        description:    sanitizeText(description),
        budget_range:   `${tier.price}/week`,
        target_schools: targetSchools.join(', '),
        notes:          sanitizeText(notes),
        status:         'pending',
      })
      if (insertErr) throw insertErr
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (step === 2) {
    return (
      <Modal onClose={onClose} wide title="Advertise with Us">
        <div className="flex flex-col items-center text-center py-10 px-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Application Received!</h2>
          <p className="text-gray-500 text-sm max-w-xs mb-6">
            We'll review your application and reach out to <strong>{email}</strong> within 1–2 business days.
          </p>
          <button onClick={onClose} className="bg-red-500 text-white font-bold px-8 py-3 rounded-2xl hover:bg-red-600 transition-colors">
            Done
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal onClose={onClose} fullHeight wide title="Advertise with Us">
      <form onSubmit={handleSubmit}>
        {/* Header blurb */}
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-5">
          <p className="text-sm text-red-700 font-medium">Reach thousands of college students on UMarket.</p>
          <p className="text-xs text-red-500 mt-0.5">Fill out the form below and our team will follow up within 1–2 business days.</p>
        </div>

        {/* Contact info */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Contact Info</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Your Name *</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Smith" required maxLength={100}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Company / Brand *</label>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Co." required maxLength={100}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Email *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.com" required maxLength={200}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(801) 555-0100" maxLength={20}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Website</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" maxLength={200}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
        </div>

        {/* Ad details */}
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 mt-1">Ad Details</p>

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Industry *</label>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)} required
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white">
            <option value="">Select industry</option>
            {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
          </select>
        </div>

        {/* Tier picker */}
        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 mb-2 block">Weekly Budget *</label>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 mb-2 flex items-center gap-2">
            <span className="text-yellow-600 text-sm">🎉</span>
            <p className="text-xs text-yellow-700 font-medium">Founding advertiser deal: first 2 weeks at 50% off all tiers.</p>
          </div>
          <div className="space-y-2">
            {AD_TIERS.map((tier) => (
              <button
                type="button"
                key={tier.id}
                onClick={() => setAdTier(tier.id)}
                className={[
                  'w-full text-left rounded-xl border-2 px-4 py-3 transition-colors',
                  adTier === tier.id
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-200 bg-white hover:border-gray-300',
                ].join(' ')}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-bold text-gray-900 text-sm">{tier.label}</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-gray-300 line-through text-xs font-medium">{tier.price}/wk</span>
                    <span className="font-bold text-red-500 text-sm">{tier.discountPrice}<span className="text-gray-400 font-normal text-xs">/wk</span></span>
                  </div>
                </div>
                <p className="text-xs font-semibold text-gray-500">{tier.tagline}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{tier.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">What do you want to promote? *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000}
            placeholder="Describe your product, service, or event and what you'd like students to do (visit your store, use a promo code, sign up, etc.)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-400" />
        </div>

        {/* Target schools — multi-select chips */}
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 mb-2 block">Target Schools <span className="font-normal text-gray-400">(select all that apply)</span></label>
          <div className="flex flex-wrap gap-2">
            {LIVE_SCHOOLS.map((school) => {
              const active = targetSchools.includes(school)
              return (
                <button
                  type="button"
                  key={school}
                  onClick={() => toggleSchool(school)}
                  className={[
                    'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                    active
                      ? 'bg-red-500 text-white border-red-500'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300',
                  ].join(' ')}
                >
                  {school}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Anything else?</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500}
            placeholder="Timeline, questions, anything we should know"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-400" />
        </div>

        {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}

        <button type="submit" disabled={saving}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 transition-colors">
          {saving ? 'Submitting…' : 'Submit Application →'}
        </button>
      </form>
    </Modal>
  )
}
