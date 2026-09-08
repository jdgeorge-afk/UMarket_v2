export default function AdCard({ ad }) {
  if (!ad) return null

  const gradient = ad.gradient ?? 'linear-gradient(145deg, #1e1e2e, #2d2d44)'
  const cta = ad.cta ?? 'Learn More'

  return (
    <a
      href={ad.website_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-2xl overflow-hidden flex flex-col no-underline hover:opacity-90 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150 shadow-md"
      style={{ background: gradient, minHeight: 220 }}
    >
      <div className="flex flex-col h-full px-4 py-4 gap-2">

        {/* Sponsored + brand name at top */}
        <div>
          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">
            Sponsored
          </p>
          <p className="text-xs font-extrabold text-white uppercase tracking-wide leading-tight">
            {ad.company_name}
          </p>
        </div>

        {/* Logo — white chip centered */}
        <div className="flex-1 flex items-center justify-center py-1">
          <div className="bg-white rounded-xl px-4 py-3 flex items-center justify-center w-full" style={{ maxHeight: 90 }}>
            {ad.logoSvg ? (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ maxHeight: 70 }}
                dangerouslySetInnerHTML={{ __html: ad.logoSvg }}
              />
            ) : (
              <p className="text-lg font-black text-gray-900 text-center leading-tight">
                {ad.company_name}
              </p>
            )}
          </div>
        </div>

        {/* Tagline */}
        <p className="text-[11px] text-white/75 leading-snug text-center">
          {ad.tagline}
        </p>

        {/* CTA */}
        <div className="w-full bg-white/15 text-white text-xs font-bold px-4 py-2.5 rounded-xl text-center">
          {cta} →
        </div>
      </div>
    </a>
  )
}
