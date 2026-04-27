import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import Modal from './Modal'
import { checkRateLimit, rateLimitMessage } from '../lib/rateLimit'
import { validate, sanitizeEmail, signInSchema, signUpSchema } from '../lib/validation'
import { SUPPORT_EMAIL } from '../constants/config'

const TERMS_SECTIONS = [
  {
    title: '1. About UMarket',
    body: 'UMarket is an independent, student-to-student online marketplace platform. UMarket is not affiliated with, endorsed by, sponsored by, or officially connected to any university, college, or educational institution referenced on this Platform, including but not limited to the University of Utah and Texas Christian University. All university names are used solely to help students identify their campus community.',
  },
  {
    title: '2. Eligibility',
    body: 'You must be at least 13 years of age to use this Platform. By creating an account, you confirm that you meet this requirement. Users under 18 must have parental or guardian consent.',
  },
  {
    title: '3. No Involvement in Transactions',
    body: 'UMarket is not a party to any transaction between users. All purchases, sales, rentals, subleases, and exchanges are solely between the individual users involved. UMarket does not verify the accuracy, legality, quality, or safety of any listing. You transact entirely at your own risk.',
  },
  {
    title: '4. Your Responsibilities',
    body: 'You agree that all listings you post are accurate, lawful, and your own to sell or transfer. You agree not to post fraudulent, misleading, stolen, illegal, prohibited, or dangerous items or services. You are solely responsible for any listing you create and any transaction you enter into through this Platform.',
  },
  {
    title: '5. Prohibited Content',
    body: 'You may not post listings involving: illegal goods or substances, weapons or firearms, counterfeit items, stolen property, adult content, personal information of others, or any content that violates applicable law. UMarket reserves the right to remove any listing and suspend or terminate any account at its sole discretion, with or without notice, for any reason.',
  },
  {
    title: '6. No Safety Guarantee',
    body: 'UMarket does not screen, verify, or background-check any user. We do not guarantee the identity, trustworthiness, or conduct of any person you meet through this Platform. Always meet in public places. Never send payment before receiving an item. UMarket is not responsible for any harm, loss, injury, fraud, or dispute arising from interactions between users.',
  },
  {
    title: '7. Limitation of Liability',
    body: 'To the fullest extent permitted by law, UMarket, its founders, employees, and affiliates shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising out of or related to your use of this Platform, including but not limited to losses from fraudulent listings, failed transactions, personal injury, or property damage. Your sole remedy for dissatisfaction with this Platform is to stop using it.',
  },
  {
    title: '8. Intellectual Property',
    body: "All UMarket branding, logos, and original Platform content are the property of UMarket. You retain ownership of content you post but grant UMarket a non-exclusive, royalty-free license to display that content on the Platform. You may not use UMarket's name, logo, or branding without written permission.",
  },
  {
    title: '9. Privacy',
    body: 'By creating an account, you consent to the collection and use of your information as described in our Privacy Policy. We do not sell your personal data to third parties.',
  },
  {
    title: '10. Dispute Resolution',
    body: 'Any dispute arising from your use of this Platform shall be resolved through binding individual arbitration under the rules of the American Arbitration Association, governed by the laws of the State of Utah. You waive your right to participate in any class action lawsuit against UMarket.',
  },
  {
    title: '11. Changes to These Terms',
    body: 'UMarket may update these Terms at any time. Continued use of the Platform after changes are posted constitutes your acceptance of the updated Terms.',
  },
  {
    title: '12. Contact',
    body: 'For questions about these Terms, contact us through the Platform.',
  },
]

export default function AuthModal({ mode, onModeChange, onClose }) {
  const { signIn, signUp, resetPassword } = useAuth()
  const { school } = useSchool()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [step, setStep]         = useState('form') // 'form' | 'terms' | 'contact' | 'verify' | 'reset' | 'forgot'
  const [termsFromSignup, setTermsFromSignup] = useState(false)

  const isEdu = email.toLowerCase().endsWith('.edu')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      // Validate sign-up fields (name, email format, password ≥ 8 chars)
      const { valid, firstError } = validate(
        { name: name.trim(), email: sanitizeEmail(email), password },
        signUpSchema,
      )
      if (!valid) { setError(firstError); return }

      // Show Terms of Use before creating the account
      setTermsFromSignup(true)
      setStep('terms')
    } else {
      // Rate limit sign-in attempts (5 per 15 minutes per device)
      const rl = checkRateLimit('sign_in')
      if (!rl.allowed) { setError(rateLimitMessage('sign_in', rl.retryAfterMs)); return }

      // Validate email format and non-empty password before hitting the network
      const { valid, firstError } = validate(
        { email: sanitizeEmail(email), password },
        signInSchema,
      )
      if (!valid) { setError(firstError); return }

      setLoading(true)
      try {
        const { error: err } = await signIn({ email: sanitizeEmail(email), password })
        if (err) {
          const msg = err?.message ?? ''
          setError(msg.includes('Invalid') || msg.includes('invalid') ? 'Incorrect email or password.' : (msg || 'Sign in failed. Please try again.'))
        } else {
          onClose()
        }
      } catch (e) {
        setError('Something went wrong. Please check your connection and try again.')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleAcceptTerms = async () => {
    // Rate limit sign-up attempts (3 per hour per device)
    const rl = checkRateLimit('sign_up')
    if (!rl.allowed) { setError(rateLimitMessage('sign_up', rl.retryAfterMs)); return }

    setLoading(true)
    setError('')
    try {
      const { error: err } = await signUp({ email: sanitizeEmail(email), password, name: name.trim(), schoolId: school?.id })
      if (err) {
        // err.message can be undefined, empty, or a raw JSON string like "{}"
        // for certain Supabase error types (email rate limit, CAPTCHA, network errors)
        const raw = typeof err?.message === 'string' ? err.message.trim() : ''
        const isGarbage = !raw || raw === '{}' || raw.startsWith('{')
        const msg = isGarbage
          ? 'Sign up failed. This email may already be registered, or too many attempts were made. Please try again later or contact support.'
          : raw
        setError(msg)
        setStep('form')
      } else {
        setStep('verify')
      }
    } catch (e) {
      setError('Something went wrong. Please check your connection and try again.')
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setError('')

    // Rate limit password reset requests (3 per hour per device)
    const rl = checkRateLimit('password_reset')
    if (!rl.allowed) { setError(rateLimitMessage('password_reset', rl.retryAfterMs)); return }

    setLoading(true)
    try {
      const { error: err } = await resetPassword(sanitizeEmail(email))
      if (err) setError(err?.message || 'Failed to send reset email. Please try again.')
      else setStep('reset')
    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Contact info screen ───────────────────────────────────────────────────
  if (step === 'contact') {
    return (
      <Modal onClose={onClose} title="Contact Us">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Us</h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Have a question, concern, or need to report an issue? We're here to help.
          </p>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Email</p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm font-medium text-gray-900 hover:underline">{SUPPORT_EMAIL}</a>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Response Time</p>
              <p className="text-sm text-gray-600">We typically respond within 1–2 business days.</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">For Legal Inquiries</p>
              <p className="text-sm text-gray-600">
                For questions about our Terms of Use, privacy practices, or legal matters, include "Legal" in your subject line.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStep('form')}
            className="mt-6 w-full text-gray-400 text-sm py-1"
          >
            ← Back
          </button>
        </div>
      </Modal>
    )
  }

  // ── Terms of Use screen ───────────────────────────────────────────────────
  if (step === 'terms') {
    return (
      <Modal
        onClose={onClose}
        title="Terms of Use"
        fullHeight
        footer={
          <div className="space-y-2">
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {termsFromSignup && (
              <button
                onClick={handleAcceptTerms}
                disabled={loading}
                className="w-full bg-school-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity text-base"
              >
                {loading ? 'Creating account…' : 'I Accept — Create My Account'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setStep('form')}
              disabled={loading}
              className="w-full text-gray-400 text-sm py-1"
            >
              ← Go Back
            </button>
          </div>
        }
      >
        <div>
          <p className="text-xs text-gray-400 mb-1">Last updated: March 2026</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Terms of Use</h2>
          <p className="text-sm text-gray-600 mb-5 leading-relaxed">
            By creating an account on UMarket ("Platform"), you agree to the following Terms of Use.
            Please read them carefully. If you do not agree, do not create an account.
          </p>

          <div className="space-y-5">
            {TERMS_SECTIONS.map((section) => (
              <div key={section.title}>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">{section.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{section.body}</p>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-6 text-center">
            Scroll up to review all terms before accepting.
          </p>
        </div>
      </Modal>
    )
  }

  // ── Verify email screen ────────────────────────────────────────────────────
  if (step === 'verify') {
    return (
      <Modal onClose={onClose}>
        <div className="text-center py-2">
          <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
          <p className="text-sm text-gray-400 mt-2 mb-1">
            We sent a confirmation link to
          </p>
          <p className="font-semibold text-gray-900 mb-4">{email}</p>
          {isEdu && (
            <div className="bg-blue-50 text-blue-600 text-sm rounded-xl px-4 py-3 mb-4">
              .edu email detected — you'll get a <strong>Verified</strong> badge automatically!
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
            .edu email — you'll get a Verified badge!
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
        <div className="mt-4 text-center space-y-2">
          <p className="text-xs text-gray-400">
            You will be asked to review and accept our Terms of Use before your account is created.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => { setTermsFromSignup(false); setStep('terms') }}
              className="text-xs text-school-primary font-medium underline underline-offset-2"
            >
              Terms of Use
            </button>
            <button
              type="button"
              onClick={() => setStep('contact')}
              className="text-xs text-school-primary font-medium underline underline-offset-2"
            >
              Contact Us
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
