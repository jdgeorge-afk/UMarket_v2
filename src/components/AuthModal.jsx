import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import Modal from './Modal'

export default function AuthModal({ mode, onModeChange, onClose }) {
  const { signIn, signUp, resetPassword } = useAuth()
  const { school } = useSchool()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [step, setStep]         = useState('form') // 'form' | 'verify' | 'reset'

  const isEdu = email.toLowerCase().endsWith('.edu')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      if (name.trim().length < 2) { setError('Please enter your name.'); setLoading(false); return }
      const { error: err } = await signUp({ email, password, name: name.trim(), schoolId: school?.id })
      if (err) setError(err.message)
      else setStep('verify')
    } else {
      const { error: err } = await signIn({ email, password })
      if (err) setError(err.message.includes('Invalid') ? 'Incorrect email or password.' : err.message)
      else onClose()
    }
    setLoading(false)
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await resetPassword(email)
    if (err) setError(err.message)
    else setStep('reset')
    setLoading(false)
  }

  // ── Verify email screen ────────────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <Modal onClose={onClose}>
        <div className="text-center py-2">
          <p className="text-5xl mb-4">📧</p>
          <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
          <p className="text-sm text-gray-400 mt-2 mb-1">
            We sent a confirmation link to
          </p>
          <p className="font-semibold text-gray-900 mb-4">{email}</p>
          {isEdu && (
            <div className="bg-blue-50 text-blue-600 text-sm rounded-xl px-4 py-3 mb-4">
              ✓ .edu email detected — you'll get a <strong>Verified</strong> badge automatically!
            </div>
          )}
          <p className="text-xs text-gray-400 leading-relaxed">
            Click the link in that email to activate your account, then come back here to sign in.
          </p>
          <button
            onClick={() => { onModeChange('signin'); setStep('form') }}
            className="mt-6 text-school-primary font-semibold"
          >
            Go to Sign In
          </button>
        </div>
      </Modal>
    )
  }

  // ── Password reset sent screen ─────────────────────────────────────────────
  if (step === 'reset') {
    return (
      <Modal onClose={onClose}>
        <div className="text-center py-2">
          <p className="text-5xl mb-4">🔐</p>
          <h2 className="text-xl font-bold text-gray-900">Reset link sent</h2>
          <p className="text-sm text-gray-400 mt-2">Check your email for a password reset link.</p>
          <button onClick={onClose} className="mt-6 text-school-primary font-semibold">Close</button>
        </div>
      </Modal>
    )
  }

  // ── Forgot password form ───────────────────────────────────────────────────
  if (step === 'forgot') {
    return (
      <Modal onClose={onClose}>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Reset Password</h2>
        <p className="text-sm text-gray-400 mb-5">Enter your email and we'll send a reset link.</p>
        <form onSubmit={handleReset} className="space-y-3">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            placeholder="your@email.com"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-school-primary text-white font-bold py-3 rounded-xl disabled:opacity-40">
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <button type="button" onClick={() => setStep('form')}
            className="w-full text-gray-400 text-sm py-1">
            ← Back to Sign In
          </button>
        </form>
      </Modal>
    )
  }

  // ── Main sign in / sign up form ────────────────────────────────────────────
  return (
    <Modal onClose={onClose}>
      {/* Tabs */}
      <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
        {(['signin', 'signup']).map((m) => (
          <button
            key={m}
            onClick={() => { onModeChange(m); setError('') }}
            className={[
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
              mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-400',
            ].join(' ')}
          >
            {m === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <input
            value={name} onChange={(e) => setName(e.target.value)} required
            placeholder="Your name"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
          />
        )}
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
          placeholder={mode === 'signup' ? 'Email (.edu gets verified badge)' : 'Email'}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
        />
        {mode === 'signup' && isEdu && (
          <p className="text-blue-500 text-xs flex items-center gap-1 -mt-1 px-1">
            ✓ .edu email — you'll get a Verified badge!
          </p>
        )}
        <input
          type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          required minLength={6}
          placeholder="Password (min 6 characters)"
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
        />

        {mode === 'signin' && (
          <div className="text-right">
            <button
              type="button"
              onClick={() => setStep('forgot')}
              className="text-xs text-gray-400 hover:text-school-primary"
            >
              Forgot password?
            </button>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full bg-school-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity text-base"
        >
          {loading
            ? 'Loading…'
            : mode === 'signup'
            ? 'Create Account'
            : 'Sign In'}
        </button>
      </form>

      {mode === 'signup' && (
        <p className="text-xs text-gray-400 text-center mt-4">
          By signing up you agree to our Terms of Service.
        </p>
      )}
    </Modal>
  )
}
