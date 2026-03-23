const ADS = [
  {
    id: 'ad_lemonade',
    headline: 'Need Renters Insurance?',
    body: "Lemonade covers your stuff from $5/mo. Perfect for off-campus living.",
    cta: 'Get a Quote →',
    url: 'https://lemonade.com',
    bg: 'linear-gradient(135deg, #f953c6, #b91d73)',
    emoji: '',
  },
  {
    id: 'ad_chime',
    headline: 'Student Checking. No Fees.',
    body: "No monthly fees, no minimums. Just your money working for you.",
    cta: 'Open Account →',
    url: 'https://chime.com',
    bg: 'linear-gradient(135deg, #11998e, #38ef7d)',
    emoji: '',
  },
]

export default function AdCard({ index }) {
  const ad = ADS[index % ADS.length]
  return (
    <div
      className="rounded-2xl p-4 flex flex-col justify-between text-white overflow-hidden"
      style={{ background: ad.bg, minHeight: '200px' }}
    >
      <div>
        <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1">
          Sponsored
        </p>
        <p className="text-lg font-bold leading-tight">{ad.emoji} {ad.headline}</p>
        <p className="text-xs text-white/75 mt-1.5 leading-relaxed">{ad.body}</p>
      </div>
      <a
        href={ad.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="mt-4 block text-center bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
      >
        {ad.cta}
      </a>
    </div>
  )
}
