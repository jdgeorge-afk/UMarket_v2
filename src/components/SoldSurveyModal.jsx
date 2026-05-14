import Modal from './Modal'

export default function SoldSurveyModal({ action, onAnswer }) {
  const isSold = action === 'sold'

  return (
    <Modal onClose={() => onAnswer(null)}>
      <div className="text-center mb-6">
        <span className="text-4xl">{isSold ? '🎉' : '🗑️'}</span>
        <h2 className="text-xl font-bold text-gray-900 mt-3">
          {isSold ? 'Nice, it sold!' : 'One quick question'}
        </h2>
        <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
          Did this sell through UMarket?
        </p>
      </div>

      <div className="space-y-2.5">
        <button
          onClick={() => onAnswer(true)}
          className="w-full flex items-center gap-3 p-4 bg-green-50 border-2 border-green-200 rounded-2xl hover:bg-green-100 transition-colors text-left"
        >
          <span className="text-xl">✅</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Yes, through UMarket!</p>
            <p className="text-xs text-gray-500">The buyer found me here</p>
          </div>
        </button>

        <button
          onClick={() => onAnswer(false)}
          className="w-full flex items-center gap-3 p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl hover:bg-gray-100 transition-colors text-left"
        >
          <span className="text-xl">👋</span>
          <div>
            <p className="font-semibold text-gray-900 text-sm">No, sold elsewhere</p>
            <p className="text-xs text-gray-500">Or removing for another reason</p>
          </div>
        </button>
      </div>

      <button
        onClick={() => onAnswer(null)}
        className="w-full mt-4 text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
      >
        Skip
      </button>
    </Modal>
  )
}
