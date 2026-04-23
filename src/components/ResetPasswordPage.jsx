// Standalone page rendered at /reset-password.
// Supabase sends the user here after they click the reset link in their email.
// The recovery token arrives in the URL hash; the Supabase client processes it
// automatically and fires the PASSWORD_RECOVERY auth event.
//
// Required Supabase dashboard setup:
//   Authentication → URL Configuration → Redirect URLs
//   Add: https://www.u-market.app/reset-password

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  // 'loading' → waiting for recovery token to be validated
  // 'form'    → token valid, show new-password form
  // 'success' → password updated, show confirmation
  // 'expired' → token missing / invalid / timed out
  const [step, setStep]         = useState('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPw, setShowPw]     = useState(false)

  useEffect(() => {
    // Guarantee a visible theme even on a fresh device (no school in localStorage).
    // SchoolProvider will override this if the user has a school saved.
    const root = document.documentElement
    if (!root.style.getPropertyValue('--school-primary')) {
      root.style.setProperty('--school-primary', '#CC0000')
      root.style.setProperty('--school-light',   '#fff5f5')
      root.style.setProperty('--school-dark',    '#990000')
    }

    // Supabase processes the #access_token hash and fires PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setStep('form')
      }
    })

    // Also handle the case where getSession() already reflects the recovery token
    // (e.g. user refreshed the page after the hash was processed).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStep('form')
    })

    // After 5 s with no valid session, treat the link as expired / invalid.
    const expiredTimer = setTimeout(
      () => setStep((s) => (s === 'loading' ? 'expired' : s)),
      5000,
    )

    return () => {
      subscription.unsubscribe()
      clearTimeout(expiredTimer)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm)  { setError('Passwords do not match.'); return }

    setSubmitting(true)
    const { error: err } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (err) {
      setError(err.message || 'Failed to update password. Please try again.')
    } else {
      await supabase.auth.signOut()
      setStep('success')
    }
  }

  // ── Shared card wrapper ────────────────────────────────────────────────────
  const Wrap = ({ children }) => (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="inline-block">
            <span className="text-3xl font-black text-school-primary tracking-tight">UMarket</span>
            <sup className="text-xs font-bold text-school-primary">™</sup>
          </a>
        </div>
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )

  // ── Loading ────────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <Wrap>
        <div className="flex flex-col items-center py-6 gap-4 text-gray-400">
          <svg className="w-8 h-8 animate-spin text-school-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
          <p className="text-sm">Verifying your reset link…</p>
        </div>
      </Wrap>
    )
  }

  // ── Expired / invalid link ─────────────────────────────────────────────────
  if (step === 'expired') {
    return (
      <Wrap>
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link expired</h1>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            This password reset link is invalid or has expired.<br />
            Reset links are single-use and expire after 1 hour.
          </p>
          <a
            href="/"
            className="block w-full text-center bg-school-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Back to UMarket
          </a>
        </div>
      </Wrap>
    )
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <Wrap>
        <div className="text-center py-2">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Password updated!</h1>
          <p className="text-sm text-gray-400 mb-6">
            Your new password is set. Sign in to continue.
          </p>
          <a
            href="/"
            className="block w-full text-center bg-school-primary text-white font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Go to UMarket
          </a>
        </div>
      </Wrap>
    )
  }

  // ── New password form ──────────────────────────────────────────────────────
  return (
    <Wrap>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Set a new password</h1>
      <p className="text-sm text-gray-400 mb-6">Choose a strong password for your account.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (min 6 characters)"
            required
            minLength={6}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>

        <input
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm new password"
          required
          minLength={6}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
        />

        {error && (
          <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-school-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity text-base"
        >
          {submitting ? 'Updating…' : 'Update Password'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <a href="/" className="text-xs text-gray-400 hover:text-gray-600">
          ← Back to UMarket
        </a>
      </div>
    </Wrap>
  )
}
