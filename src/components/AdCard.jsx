export default function AdCard({ ad }) {
  if (!ad) return null

  const isFake = ad.id?.startsWith?.('fake-')
  const gradient = isFake ? ad.gradient : 'linear-gradient(135deg, #667eea, #764ba2)'
  const accent = isFake ? (ad.accent ?? '#fff') : '#fff'
  const cta = isFake ? ad.cta : 'Learn More →'

  return (
    <a
      href={ad.website_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-2xl overflow-hidden flex flex-col no-underline hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm"
      style={{ background: gradient, minHeight: 220 }}
    >
      <div className="flex flex-col h-full p-4 gap-3">
        {/* Sponsored label */}
        <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest">
          Sponsored
        </p>

        {/* Brand + emoji */}
        <div className="flex items-center gap-2">
          {isFake ? (
            <span className="text-2xl leading-none select-none" aria-hidden="true">{ad.emoji}</span>
          ) : ad.logo_url ? (
            <img src={ad.logo_url} alt={ad.company_name} className="w-8 h-8 object-contain rounded-lg bg-white/20" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm font-bold text-white">
              {ad.company_name?.[0]?.toUpperCase()}
            </div>
          )}
          <p className="text-sm font-extrabold text-white leading-tight">{ad.company_name}</p>
        </div>

        {/* Tagline */}
        <p className="text-xs text-white/80 leading-relaxed flex-1">{ad.tagline}</p>

        {/* CTA button */}
        <div
          className="text-center text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
          style={{ background: 'rgba(255,255,255,0.18)', color: accent }}
        >
          {cta}
        </div>
      </div>
    </a>
  )
}
