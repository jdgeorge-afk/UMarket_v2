import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

const CONTACT_TYPES = [
  { value: 'email',     label: 'Email' },
  { value: 'phone',     label: 'Phone' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'snapchat',  label: 'Snapchat' },
]

function getSellerContact(listing, seller) {
  const type  = listing?.contact_type  || seller?.contact_type
  const value = listing?.contact_value || seller?.contact
  if (!type || !value) return null
  switch (type) {
    case 'phone':
      return { label: 'Phone / Text', display: value, href: `tel:${value}` }
    case 'email':
      return { label: 'Email', display: value, href: `mailto:${value}` }
    case 'instagram':
      return { label: 'Instagram', display: `@${value}`, href: `https://instagram.com/${value}` }
    case 'snapchat':
      return { label: 'Snapchat', display: `@${value}`, href: `https://snapchat.com/add/${value}` }
    default:
      return null
  }
}

// ── Step 2: Seller contact revealed ──────────────────────────────────────────
function ContactRevealed({ listing, seller, onClose }) {
  const contact = getSellerContact(listing, seller)
  return (
    <Modal onClose={onClose}>
      <div className="text-center mb-5">
        <span className="text-3xl">🎉</span>
        <h2 className="text-xl font-bold text-gray-900 mt-2">You're all set!</h2>
        <p className="text-sm text-gray-400 mt-1">The seller has been notified. Here's how to reach them:</p>
      </div>

      {contact ? (
        <a
          href={contact.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-4 bg-school-primary/5 border border-school-primary/20 rounded-xl hover:bg-school-primary/10 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-400 mb-0.5">{contact.label}</p>
            <p className="font-semibold text-gray-900 truncate text-lg">{contact.display}</p>
          </div>
          <svg className="w-5 h-5 text-school-primary group-hover:translate-x-0.5 transition-transform shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </a>
      ) : (
        <div className="text-center py-6 text-gray-400">
          <p className="text-sm">This seller hasn't added contact info yet.</p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center mt-5 leading-relaxed">
        Always meet in a public place on campus.<br />Never send payment before seeing the item.
      </p>
    </Modal>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ContactModal({ listing, seller, onClose }) {
  const { user, profile } = useAuth()

  const [step, setStep] = useState('form') // 'form' | 'revealed'
  const [buyerName,         setBuyerName]         = useState(profile?.name ?? '')
  const [buyerContactType,  setBuyerContactType]  = useState(profile?.contact_type ?? 'email')
  const [buyerContactValue, setBuyerContactValue] = useState(profile?.contact ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  if (step === 'revealed') {
    return <ContactRevealed listing={listing} seller={seller} onClose={onClose} />
  }

  const handleSubmit = async () => {
    if (!buyerName.trim())         { setError('Please enter your name.'); return }
    if (!buyerContactValue.trim()) { setError('Please enter your contact info.'); return }

    setSubmitting(true)
    setError('')

    const name  = buyerName.trim()
    const value = buyerContactValue.trim()

    // 1. Record in contact_requests so it appears in buyer's "Contacted" tab
    await supabase.from('contact_requests').upsert(
      { listing_id: listing.id, buyer_id: user.id, seller_id: listing.seller_id },
      { onConflict: 'listing_id,buyer_id', ignoreDuplicates: true },
    )

    // 2. Insert seller notification directly — works without edge functions deployed.
    // Delete any prior notification for this buyer+listing first so the fresh metadata
    // (with contact info) is always stored, regardless of whether a unique constraint exists.
    await supabase.from('notifications')
      .delete()
      .eq('listing_id', listing.id)
      .eq('buyer_id', user.id)

    await supabase.from('notifications').insert({
      user_id:    listing.seller_id,
      type:       'interest',
      listing_id: listing.id,
      buyer_id:   user.id,
      message:    `${name} is interested in your listing`,
      metadata:   { buyer_name: name, buyer_contact_type: buyerContactType, buyer_contact_value: value },
      read:       false,
    })

    // 3. Fire edge function for the email — non-blocking, fails silently if not deployed
    supabase.functions.invoke('notify-interest', {
      body: { listing_id: listing.id, buyer_name: name, buyer_contact_type: buyerContactType, buyer_contact_value: value },
    }).catch(() => {})

    setSubmitting(false)
    setStep('revealed')
  }

  const placeholder = buyerContactType === 'phone' ? '(555) 000-0000'
    : buyerContactType === 'email' ? 'you@email.com'
    : 'username (no @)'

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-bold text-gray-900 mb-1">I'm Interested!</h2>
      <p className="text-sm text-gray-400 mb-5 leading-relaxed">
        Share your contact info and we'll let the seller know — then reveal their contact details instantly.
      </p>

      <div className="space-y-3">
        <input
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
          placeholder="Your name *"
          maxLength={80}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
        />

        <div className="flex gap-2">
          <select
            value={buyerContactType}
            onChange={(e) => setBuyerContactType(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-3 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-school-primary shrink-0"
          >
            {CONTACT_TYPES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            value={buyerContactValue}
            onChange={(e) => setBuyerContactValue(e.target.value)}
            placeholder={placeholder}
            maxLength={120}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-opacity disabled:opacity-40 shadow-md"
        >
          {submitting ? 'Sending…' : 'Get Contact Info →'}
        </button>

        <p className="text-xs text-gray-400 text-center leading-relaxed">
          Your info will be shared with the seller. They'll be notified that you're interested.
        </p>
      </div>
    </Modal>
  )
}
