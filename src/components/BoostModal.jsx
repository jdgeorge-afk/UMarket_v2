import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Modal from './Modal'

const PRICE_PER_DAY = 3

const DAY_OPTIONS = [
  { days: 1,  label: '1 day',   badge: null },
  { days: 3,  label: '3 days',  badge: 'Popular' },
  { days: 7,  label: '7 days',  badge: 'Best Value' },
  { days: 14, label: '14 days', badge: null },
  { days: 30, label: '30 days', badge: null },
]

export default function BoostModal({ listing, onClose }) {
  const { user } = useAuth()
  const [selectedDays, setSelectedDays] = useState(3)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const totalPrice = selectedDays * PRICE_PER_DAY
  const shortId = listing.id.slice(0, 8).toUpperCase()

  const handleSubmit = async () => {
    if (!user) return
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address so we can send your invoice.')
      return
    }
    setSubmitting(true)
    setError('')
    const { error: err } = await supabase.from('boosts').insert({
      listing_id:  listing.id,
      seller_id:   user.id,
      days:        selectedDays,
      total_price: totalPrice,
      note:        `[Invoice email: ${email.trim()}]${note.trim() ? ' ' + note.trim() : ''}`,
      status:      'pending',
    })
    if (err) { setError(err.message); setSubmitting(false); return }
    setSubmitted(true)
    setSubmitting(false)
  }

  const footer = submitted ? (
    <button onClick={onClose} className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-base hover:opacity-90 transition-opacity">
      Done
    </button>
  ) : (
    <>
      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2 mb-3">{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-school-primary text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {submitting ? 'Submitting…' : `Request Boost — $${totalPrice}`}
      </button>
    </>
  )

  return (
    <Modal onClose={onClose} title="Boost Listing" footer={footer}>
      {submitted ? (
        <div className="text-center py-6">
          <div className="text-5xl mb-4">⚡</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Request Received!</h2>
          <p className="text-gray-500 text-sm leading-relaxed mb-4">
            We'll email you within 24 hours with payment options.
            Once payment is confirmed your listing will be boosted to the top of the feed.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 text-left space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Listing</span>
              <span className="font-semibold text-gray-900 truncate max-w-[180px]">{listing.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Post ID</span>
              <span className="font-mono text-gray-700">{shortId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Duration</span>
              <span className="font-semibold text-gray-900">{selectedDays} {selectedDays === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-1.5 mt-1.5">
              <span className="text-gray-500">Total due</span>
              <span className="font-bold text-school-primary text-base">${totalPrice}</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          <h2 className="hidden sm:block text-xl font-bold text-gray-900 mb-1">Boost Listing</h2>

          {/* Listing preview */}
          <div className="bg-gray-50 rounded-xl p-3 mb-5 flex items-center gap-3">
            {listing.images?.[0] && (
              <img src={listing.images[0]} className="w-14 h-14 rounded-lg object-cover shrink-0" alt="" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{listing.title}</p>
              <p className="text-xs text-gray-400 font-mono">ID: {shortId}</p>
            </div>
          </div>

          {/* What boosting does */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What you get</p>
            <div className="space-y-2">
              {[
                ['⚡', 'Pinned to the top of the feed', 'Your listing shows above all non-boosted posts'],
                ['🔄', 'Rotated with other boosted posts', 'Equal visibility — not just one seller dominating'],
                ['🏷️', 'Featured badge on your card', 'Stands out visually to every shopper'],
              ].map(([icon, title, desc]) => (
                <div key={title} className="flex items-start gap-2.5">
                  <span className="text-lg leading-none mt-0.5">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{title}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Duration picker */}
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Duration · ${PRICE_PER_DAY}/day
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {DAY_OPTIONS.map(({ days, label, badge }) => (
                <button
                  key={days}
                  onClick={() => setSelectedDays(days)}
                  className={[
                    'relative flex flex-col items-center py-3 rounded-xl border-2 transition-all text-sm font-bold',
                    selectedDays === days
                      ? 'border-school-primary bg-school-primary/5 text-school-primary'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300',
                  ].join(' ')}
                >
                  {badge && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-school-primary text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                      {badge}
                    </span>
                  )}
                  <span className="text-base font-extrabold">{days}</span>
                  <span className="text-[10px] text-gray-400 font-normal mt-0.5">{days === 1 ? 'day' : 'days'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Price summary */}
          <div className="bg-school-primary/5 rounded-xl p-4 mb-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{selectedDays} {selectedDays === 1 ? 'day' : 'days'} × ${PRICE_PER_DAY}</p>
              <p className="text-xs text-gray-400 mt-0.5">We'll invoice you via email</p>
            </div>
            <p className="text-3xl font-extrabold text-school-primary">${totalPrice}</p>
          </div>

          {/* Required email */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Invoice Email <span className="text-red-400">*</span>
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
            />
            <p className="text-[11px] text-gray-400 mt-1">We'll send your payment invoice here.</p>
          </div>

          {/* Optional note */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Note to us (optional)</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any questions or special requests…"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary resize-none"
            />
          </div>
        </>
      )}
    </Modal>
  )
}
