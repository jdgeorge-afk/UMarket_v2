import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Modal from './Modal'
import { sanitizeText } from '../lib/validation'

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
  'Under $500/mo',
  '$500 – $1,000/mo',
  '$1,000 – $2,500/mo',
  '$2,500 – $5,000/mo',
  '$5,000+/mo',
]

const AD_TYPES = [
  'Banner ad in the feed',
  'Sponsored listing (pinned to top)',
  'Email blast to students',
  'Multiple placements',
  'Not sure yet',
]

export default function AdApplicationModal({ onClose }) {
  const [step, setStep] = useState(1) // 1 = form, 2 = success

  const [contactName, setContactName]   = useState('')
  const [companyName, setCompanyName]   = useState('')
  const [email, setEmail]               = useState('')
  const [phone, setPhone]               = useState('')
  const [website, setWebsite]           = useState('')
  const [industry, setIndustry]         = useState('')
  const [adType, setAdType]             = useState('')
  const [description, setDescription]   = useState('')
  const [budget, setBudget]             = useState('')
  const [targetSchools, setTargetSchools] = useState('')
  const [notes, setNotes]               = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!contactName.trim() || !companyName.trim() || !email.trim() || !industry || !description.trim()) {
      setError('Please fill in all required fields.')
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
        ad_type:        adType,
        description:    sanitizeText(description),
        budget_range:   budget,
        target_schools: sanitizeText(targetSchools),
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
          <button
            onClick={onClose}
            className="bg-red-500 text-white font-bold px-8 py-3 rounded-2xl hover:bg-red-600 transition-colors"
          >
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
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Ad Type</label>
            <select value={adType} onChange={(e) => setAdType(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white">
              <option value="">Select type</option>
              {AD_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">What do you want to promote? *</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000}
            placeholder="Describe your product, service, or event and what you'd like students to do (visit your store, use a promo code, sign up, etc.)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-red-400" />
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Monthly Budget</label>
            <select value={budget} onChange={(e) => setBudget(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white">
              <option value="">Select range</option>
              {BUDGETS.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Target Schools</label>
            <input value={targetSchools} onChange={(e) => setTargetSchools(e.target.value)}
              placeholder="e.g. U of U, Cal Poly, UCLA" maxLength={200}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400" />
          </div>
        </div>

        <div className="mb-5">
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Anything else?</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500}
            placeholder="Timeline, creative assets you have, questions, etc."
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
