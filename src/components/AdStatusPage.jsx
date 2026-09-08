export default function AdStatusPage({ status, onClose }) {
  const isReview    = status === 'review'
  const isCancelled = status === 'cancelled'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
        {isReview && (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h1>
            <p className="text-gray-500 mb-4 leading-relaxed">
              Your ad is being reviewed. We check every submission to make sure it's a great fit for our community.
            </p>
            <div className="bg-blue-50 rounded-2xl px-5 py-4 text-left mb-6 space-y-2">
              <p className="text-sm font-semibold text-blue-800">What happens next:</p>
              <p className="text-sm text-blue-700">1. Our system reviews your ad for content (usually takes seconds).</p>
              <p className="text-sm text-blue-700">2. If it looks great, your ad goes live immediately and billing starts.</p>
              <p className="text-sm text-blue-700">3. If we need to take a closer look, our team will reach out within 1–2 business days.</p>
              <p className="text-sm text-blue-700">4. <strong>Your card is not charged until your ad is approved.</strong></p>
            </div>
            <p className="text-xs text-gray-400 mb-6">You'll receive an email confirmation at the address you provided.</p>
          </>
        )}

        {isCancelled && (
          <>
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">👋</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout cancelled</h1>
            <p className="text-gray-500 mb-6 leading-relaxed">
              No worries — nothing was charged. You can start a new application anytime.
            </p>
          </>
        )}

        {!isReview && !isCancelled && (
          <>
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">📋</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Ad status</h1>
            <p className="text-gray-500 mb-6">Your ad application has been received.</p>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-2xl transition-colors"
        >
          Back to UMarket
        </button>
      </div>
    </div>
  )
}
