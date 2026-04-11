import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { REPORT_REASONS } from '../constants/categories'
import Modal from './Modal'
import { checkRateLimit, rateLimitMessage } from '../lib/rateLimit'
import { validate, sanitizeText, reportSchema } from '../lib/validation'

export default function ReportModal({ listingId, onClose }) {
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!reason) return

    // Rate limit: prevent report spam (5 per hour per device)
    const rl = checkRateLimit('report_listing')
    if (!rl.allowed) { setError(rateLimitMessage('report_listing', rl.retryAfterMs)); return }

    // Validate reason is a known value and note is within length limits
    const { valid, firstError } = validate({ reason, note }, reportSchema)
    if (!valid) { setError(firstError); return }

    setLoading(true)
    setError('')
    const sanitizedNote = sanitizeText(note) || null
    const { error: err } = await supabase.from('reports').insert({
      listing_id:  listingId,
      reporter_id: user.id,
      reason,
      note:        sanitizedNote,
    })
    if (err) { setError(err.message) }
    else {
      setDone(true)
      // Notify the listing owner (fire-and-forget — neutral, no reporter info disclosed)
      supabase.functions.invoke('notify-report', {
        body: { listing_id: listingId },
      }).catch(() => {})
    }
    setLoading(false)
  }

  return (
    <Modal onClose={onClose}>
      {done ? (
        <div className="text-center py-4">
          <p className="text-5xl mb-3"></p>
          <p className="text-lg font-bold text-gray-900">Report Submitted</p>
          <p className="text-sm text-gray-400 mt-1">We'll review this listing shortly. Thank you.</p>
          <button onClick={onClose} className="mt-6 text-school-primary font-semibold">Close</button>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Report Listing</h2>
          <p className="text-sm text-gray-400 mb-4">What's wrong with this listing?</p>

          <div className="space-y-2 mb-4">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={[
                  'w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors',
                  reason === r
                    ? 'border-school-primary bg-school-primary/5 text-school-primary font-medium'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50',
                ].join(' ')}
              >
                {r}
              </button>
            ))}
          </div>

          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Additional details (optional)"
            className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-20 mb-4 focus:outline-none focus:ring-1 focus:ring-school-primary"
          />

          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={!reason || loading}
            className="w-full bg-school-primary text-white font-bold py-3 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {loading ? 'Submitting…' : 'Submit Report'}
          </button>
        </>
      )}
    </Modal>
  )
}
