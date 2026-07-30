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

const BUDGETS = [
  'Under $100/mo',
  '$100 – $250/mo',
  '$250 – $500/mo',
  '$500 – $1,000/mo',
  '$1,000+/mo',
]

const AD_TYPES = [
  'Banner ad in the feed',
  'Sponsored listing (pinned to top)',
  'Other',
]

// Ad types that require creative assets
const NEEDS_CREATIVE = ['Banner ad in the feed', 'Sponsored listing (pinned to top)']

export default function AdApplicationModal({ onClose }) {
  const [step, setStep] = useState(1)

  const [contactName, setContactName]   = useState('')
  const [companyName, setCompanyName]   = useState('')
  const [email, setEmail]               = useState('')
  const [phone, setPhone]               = useState('')
  const [website, setWebsite]           = useState('')
  const [industry, setIndustry]         = useState('')
  const [adType, setAdType]             = useState('')
  const [adTypeOther, setAdTypeOther]   = useState('')
  const [creativeUrl, setCreativeUrl]   = useState('')
  const [description, setDescription]   = useState('')
  const [budget, setBudget]             = useState('')
  const [targetSchools, setTargetSchools] = useState([])
  const [notes, setNotes]               = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const toggleSchool = (school) =>
    setTargetSchools((prev) =>
      prev.includes(school) ? prev.filter((s) => s !== school) : [...prev, school]
    )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!contactName.trim() || !companyName.trim() || !email.trim() || !industry || !adType || !description.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    if (adType === 'Other' && !adTypeOther.trim()) {
      setError('Please describe the type of advertising you have in mind.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const { error: insertErr } = await supabase.from('ad_applications').insert({
        contact_name:   sanitizeText(contactName),
        company_name:   sanitizeText(companyName),
        email:          email.trim().toLowerCase(),
        phone:          sanitizeText(phone),
        website:        sanitizeText(website),
        industry,
        ad_type:        adType === 'Other' ? `Other: ${sanitizeText(adTypeOther)}` : adType,
        creative_url:   sanitizeText(creativeUrl),
        description:    sanitizeText(description),
        budget_range:   budget,
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

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Industry *</label>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white">
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Ad Type *</label>
            <select value={adType} onChange={(e) => { setAdType(e.target.value); setAdTypeOther('') }} required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white">
              <option value="">Select type</option>
              {AD_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Other ad type text box */}
        {adType === 'Other' && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Describe your ad type *</label>
            <input value={adTypeOther} onChange={(e) => setAdTypeOther(e.target.value)} maxLength={200}
              placeholder="e.g. QR code flyers on campus, social media shoutout, etc."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
          </div>
        )}

        {/* Creative asset link — shown for banner/sponsored */}
        {NEEDS_CREATIVE.includes(adType) && (
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Link to your ad creative (image or video)</label>
            <input value={creativeUrl} onChange={(e) => setCreativeUrl(e.target.value)} maxLength={500}
              placeholder="Google Drive, Dropbox, or direct image URL"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
            <p className="text-[10px] text-gray-400 mt-1">Upload to Google Drive/Dropbox and paste the share link. We'll review before anything goes live.</p>
          </div>
        )}

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">What do you want to promote? *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000}
            placeholder="Describe your product, service, or event and what you'd like students to do (visit your store, use a promo code, sign up, etc.)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-400" />
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Monthly Budget</label>
          <select value={budget} onChange={(e) => setBudget(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white">
            <option value="">Select range</option>
            {BUDGETS.map((b) => <option key={b}>{b}</option>)}
          </select>
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
