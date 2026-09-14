import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSchool } from '../context/SchoolContext'
import Modal from './Modal'
import { checkRateLimit, rateLimitMessage } from '../lib/rateLimit'
import { validate, sanitizeEmail, signInSchema, signUpSchema } from '../lib/validation'
import { SUPPORT_EMAIL } from '../constants/config'
import { SCHOOLS } from '../constants/schools'

const LIVE_SCHOOLS = SCHOOLS.filter((s) => s.live)

const PRIVACY_SECTIONS = [
  { title: '1. Who We Are', body: 'UMarket operates an online marketplace and housing platform for college students. This Privacy Policy explains what information we collect when you use UMarket, how we use it, and when we share it with others.' },
  { title: '2. Information We Collect', body: 'We collect information you provide directly (name, email, profile info, listing content, payment details processed by our payment provider) and information collected automatically (browsing and search behavior, categories viewed, listings clicked, price range preferences, device type, browser, IP address, approximate location, and feature usage patterns). If you verify with a .edu email, we use it solely to confirm student status and do not sell or share it.' },
  { title: '3. How We Use Your Information', body: 'We use your information to operate and improve the platform, personalize your experience, send transactional emails (password resets, verification, listing alerts), process payments, detect fraud, generate anonymized insights, and serve advertising.' },
  { title: '4. Information We Share and Sell', body: 'We may share or sell behavioral and interest data, non-institutional email addresses, demographic inferences, and aggregated usage statistics with advertising partners and third-party data buyers. We do not sell .edu email addresses, phone numbers, government IDs, payment card details, or private messages.' },
  { title: '5. Cookies and Tracking', body: 'We use cookies to keep you logged in, remember preferences, and analyze platform use. Third-party analytics tools may set their own cookies. You can control cookies in your browser settings.' },
  { title: '6. Your Rights', body: 'Depending on your state, you may have the right to access, delete, or correct your data, and to opt out of data sales. Contact privacy@u-market.app to exercise these rights. We respond within 45 days.' },
  { title: '7. Data Retention', body: 'We retain data while your account is active. Deleting your account results in removal or anonymization of personal data within 90 days, except where law requires retention.' },
  { title: '8. Changes', body: 'We may update this policy with at least 14 days notice before material changes take effect.' },
]

const TERMS_SECTIONS = [
  { title: '1. Acceptance', body: 'By creating an account or using UMarket, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the platform.' },
  { title: '2. Eligibility', body: 'You must be at least 18 years old. By registering you confirm this is true. Verified accounts (confirmed .edu email) receive reduced ad rates and discounted subscription pricing.' },
  { title: '3. Your Account', body: 'You are responsible for all activity under your account. Do not create multiple accounts, impersonate others, or transfer your account.' },
  { title: '4. Listings and Content', body: 'You may post listings for items or housing you have the right to list. UMarket is not a party to any transaction — all deals are directly between users. You may not post illegal items, counterfeit goods, fraudulent content, or content that violates others\' rights.' },
  { title: '5. Paid Services', body: 'Advertisers may purchase ad placements at rates set by UMarket. Verified student accounts receive preferential rates. The Housing Application Subscription grants unlimited applications for a recurring monthly fee set by UMarket. Subscriptions renew automatically until cancelled; no refunds for the current period.' },
  { title: '6. Data and Privacy', body: 'By using UMarket you agree to the collection, use, and sharing of your data as described in the Privacy Policy above, including the sale of certain behavioral and contact data to third-party advertising partners. You may opt out at privacy@u-market.app.' },
  { title: '7. Prohibited Conduct', body: 'You agree not to use the platform for unlawful purposes, harass or defraud users, scrape data without permission, interfere with infrastructure, circumvent security, post spam, or manipulate listings. Violations may result in account termination without refund.' },
  { title: '8. Disclaimer', body: 'UMarket is provided "as is" without warranties of any kind. We do not endorse or verify any listing, user, or transaction.' },
  { title: '9. Limitation of Liability', body: 'UMarket is not liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the greater of $100 or fees you paid to UMarket in the prior 12 months.' },
  { title: '10. Governing Law', body: 'These Terms are governed by the laws of the State of Utah. Disputes shall be resolved in the courts of Salt Lake County, Utah.' },
]

export default function AuthModal({ mode, onModeChange, onClose, termsOnly = false, onTermsAccepted }) {
  const { signIn, signInWithGoogle, signUp, resetPassword } = useAuth()
  const { school } = useSchool()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  // steps: 'type' | 'school' | 'form' | 'terms' | 'contact' | 'verify' | 'reset' | 'forgot'
  const [step, setStep]         = useState(termsOnly ? 'terms' : 'form')
  const [termsFromSignup, setTermsFromSignup] = useState(!termsOnly)
  const [termsChecked, setTermsChecked] = useState(false)
  const termsEndRef = useRef(null)

  // New signup state
  const [userType, setUserType]             = useState('') // 'student' | 'landlord' | 'business'
  const [selectedSchools, setSelectedSchools] = useState([]) // array of school IDs
  const [companyName, setCompanyName]       = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')

  const isEdu = email.toLowerCase().endsWith('.edu')

  const toggleSchool = (id) => {
    setSelectedSchools((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id)
      if (userType === 'student') return [id]
      if (prev.length >= 5) return prev
      return [...prev, id]
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'signup') {
      // Validate sign-up fields (name, email format, password ≥ 6 chars)
      if (!firstName.trim()) { setError('Please enter your first name.'); return }
      if (!lastName.trim())  { setError('Please enter your last name.'); return }
      const { valid, firstError } = validate(
        { name: `${firstName.trim()} ${lastName.trim()}`, email: sanitizeEmail(email), password },
        signUpSchema,
      )
      if (!valid) { setError(firstError); return }

      // Show Terms of Use before creating the account
      setTermsFromSignup(true)
      setTermsChecked(false)
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
    if (termsOnly) { onTermsAccepted?.(); return }
    // Rate limit sign-up attempts (3 per hour per device)
    const rl = checkRateLimit('sign_up')
    if (!rl.allowed) { setError(rateLimitMessage('sign_up', rl.retryAfterMs)); return }

    setLoading(true)
    setError('')
    try {
      const primarySchool = selectedSchools[0] ?? school?.id
      const { error: err } = await signUp({
        email: sanitizeEmail(email),
        password,
        name: `${firstName.trim()} ${lastName.trim()}`,
        schoolId: primarySchool,
        userType,
        schoolIds: selectedSchools,
        companyName: companyName.trim(),
        companyWebsite: companyWebsite.trim(),
      })
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
        title="Privacy Policy & Terms"
        fullHeight
        footer={
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={e => setTermsChecked(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-school-primary flex-shrink-0"
              />
              <span className="text-xs text-gray-500 leading-relaxed">
                I have read and agree to the <strong className="text-gray-700">Privacy Policy</strong> and <strong className="text-gray-700">Terms of Service</strong>.
              </span>
            </label>
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            {termsFromSignup && (
              <button
                onClick={handleAcceptTerms}
                disabled={loading || !termsChecked}
                className="w-full bg-school-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity text-base"
              >
                {loading ? 'Creating account…' : termsOnly ? 'I Agree — Continue' : 'I Agree — Create My Account'}
              </button>
            )}
            {!termsOnly && (
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={loading}
                className="w-full text-gray-400 text-sm py-1"
              >
                ← Go Back
              </button>
            )}
          </div>
        }
      >
        <div>
          {/* Skip to bottom */}
          <button
            type="button"
            onClick={() => termsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })}
            className="w-full mb-4 text-xs text-school-primary font-semibold border border-school-primary/30 rounded-lg py-2 hover:bg-school-primary/5 transition-colors"
          >
            Skip to bottom ↓
          </button>

          {/* Privacy Policy */}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Privacy Policy</p>
          <p className="text-xs text-gray-400 mb-4">Last updated: September 14, 2026</p>
          <div className="space-y-4 mb-8">
            {PRIVACY_SECTIONS.map((s) => (
              <div key={s.title}>
                <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t-2 border-dashed border-gray-200 my-6" />

          {/* Terms of Service */}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Terms of Service</p>
          <p className="text-xs text-gray-400 mb-4">Last updated: September 14, 2026</p>
          <div className="space-y-4">
            {TERMS_SECTIONS.map((s) => (
              <div key={s.title}>
                <h3 className="font-semibold text-gray-900 text-sm mb-0.5">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>

          <div ref={termsEndRef} className="mt-6 text-center text-xs text-gray-400">
            You've reached the end — check the box below to continue.
          </div>
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

  // ── Account type selection ────────────────────────────────────────────────
  if (step === 'type') {
    return (
      <Modal onClose={onClose} title="Create Account">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Create your account</h2>
        <p className="text-sm text-gray-400 mb-6">What best describes you?</p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            {
              id: 'student',
              icon: '🎒',
              label: 'Student',
              desc: 'Buy, sell & find housing at your campus.',
              next: 'school',
            },
            {
              id: 'landlord',
              icon: '🏠',
              label: 'Landlord',
              desc: 'Post housing near one or more campuses.',
              next: 'school',
            },
            {
              id: 'business',
              icon: '🏢',
              label: 'Business',
              desc: 'Advertise your brand to college students.',
              next: 'form',
            },
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => {
                setUserType(type.id)
                setSelectedSchools([])
                setStep(type.next)
              }}
              className={[
                'flex flex-col items-center text-center gap-2 border-2 border-gray-200 rounded-2xl px-4 py-5 hover:border-school-primary hover:bg-school-primary/5 transition-all',
                type.id === 'business' ? 'col-span-2' : '',
              ].join(' ')}
            >
              <span className="text-3xl">{type.icon}</span>
              <span className="font-bold text-gray-900 text-sm">{type.label}</span>
              <span className="text-xs text-gray-400 leading-snug">{type.desc}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { onModeChange('signin'); setStep('form') }}
          className="w-full text-center text-xs text-gray-400 mt-2"
        >
          Already have an account?{' '}
          <span className="text-school-primary font-semibold">Sign in</span>
        </button>
      </Modal>
    )
  }

  // ── School selection ──────────────────────────────────────────────────────
  if (step === 'school') {
    const isLandlord = userType === 'landlord'
    const max = isLandlord ? 5 : 1
    return (
      <Modal onClose={onClose} title="Select School">
        <button
          type="button"
          onClick={() => setStep('type')}
          className="text-sm text-gray-400 mb-4 flex items-center gap-1 hover:text-gray-600"
        >
          ← Back
        </button>
        <h2 className="text-xl font-bold text-gray-900 mb-1">
          {isLandlord ? 'Which campuses do you operate near?' : "What's your school?"}
        </h2>
        {isLandlord && (
          <p className="text-sm text-gray-400 mb-4">
            Select up to 5 schools.{' '}
            <span className="font-semibold text-gray-600">{selectedSchools.length} / {max} selected</span>
          </p>
        )}
        {!isLandlord && <p className="text-sm text-gray-400 mb-4">Select your campus.</p>}

        <div className="grid grid-cols-2 gap-2 mb-6 max-h-72 overflow-y-auto pr-1">
          {LIVE_SCHOOLS.map((s) => {
            const selected = selectedSchools.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSchool(s.id)}
                style={selected ? { borderColor: s.primary, backgroundColor: s.primary + '15' } : {}}
                className={[
                  'flex items-center gap-2 border-2 rounded-xl px-3 py-2.5 text-left transition-all text-sm',
                  selected ? 'border-current' : 'border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.primary }}
                />
                <span className={`font-medium leading-tight ${selected ? 'text-gray-900' : 'text-gray-600'}`}>
                  {s.shortName}
                </span>
                {selected && isLandlord && (
                  <span className="ml-auto text-xs" style={{ color: s.primary }}>✓</span>
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          disabled={selectedSchools.length === 0}
          onClick={() => setStep('form')}
          className="w-full bg-school-primary text-white font-bold py-3.5 rounded-xl disabled:opacity-40 hover:opacity-90 transition-opacity text-base"
        >
          Continue →
        </button>
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
            onClick={() => {
              onModeChange(m)
              setError('')
              setStep(m === 'signup' ? 'type' : 'form')
              setUserType('')
              setSelectedSchools([])
            }}
            className={[
              'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
              mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-400',
            ].join(' ')}
          >
            {m === 'signin' ? 'Sign In' : 'Sign Up'}
          </button>
        ))}
      </div>

      {mode === 'signup' && userType && (
        <button
          type="button"
          onClick={() => setStep(userType === 'business' ? 'type' : 'school')}
          className="text-sm text-gray-400 mb-2 flex items-center gap-1 hover:text-gray-600"
        >
          ← Back
        </button>
      )}

      {/* Google OAuth */}
      <button
        type="button"
        onClick={async () => { setError(''); await signInWithGoogle() }}
        className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors mb-4"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'signup' && (
          <>
            <div className="flex gap-2">
              <input
                value={firstName} onChange={(e) => setFirstName(e.target.value)} required
                placeholder="First name *"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
              />
              <input
                value={lastName} onChange={(e) => setLastName(e.target.value)} required
                placeholder="Last name *"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
              />
            </div>
            {userType === 'business' && (
              <>
                <input
                  value={companyName} onChange={(e) => setCompanyName(e.target.value)} required
                  placeholder="Company / Brand name *"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
                />
                <input
                  value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)}
                  placeholder="Website (https://yoursite.com)"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-school-primary"
                />
              </>
            )}
          </>
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
