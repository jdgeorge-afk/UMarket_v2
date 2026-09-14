export default function BannerAd({ ad }) {
  if (!ad) return null

  return (
    <a
      href={ad.website_url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="col-span-full rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 no-underline flex"
      style={{ minHeight: 220 }}
    >
      {/* Left — visual panel */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{ width: '42%', background: ad.gradient ?? 'linear-gradient(145deg,#1e1e2e,#2d2d44)' }}
      >
        {/* Decorative icon / illustration */}
        {ad.illustrationSvg && (
          <div
            className="absolute inset-0 flex items-center justify-center opacity-20 pointer-events-none"
            style={{ padding: '20%' }}
            dangerouslySetInnerHTML={{ __html: ad.illustrationSvg }}
          />
        )}
        {/* Logo chip */}
        <div className="relative bg-white rounded-xl px-4 py-3 mx-6 flex items-center justify-center w-full" style={{ maxHeight: 80 }}>
          {ad.logoSvg ? (
            <div
              className="w-full flex items-center justify-center"
              style={{ maxHeight: 56 }}
              dangerouslySetInnerHTML={{ __html: ad.logoSvg }}
            />
          ) : (
            <p className="text-base font-black text-gray-900 text-center leading-tight truncate">
              {ad.company_name}
            </p>
          )}
        </div>
      </div>

      {/* Right — copy + CTA */}
      <div className="flex-1 bg-white flex flex-col justify-between px-5 py-4 min-w-0">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Sponsored
          </p>
          <svg className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7"/>
            <path d="M8 1h3v3M6.5 5.5L11 1"/>
          </svg>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] font-semibold text-gray-400 leading-snug">
            {ad.company_name}
          </p>
          <p className="font-bold text-gray-900 text-base leading-snug">
            {ad.headline}
          </p>
          <p className="text-xs text-gray-500 leading-snug">
            {ad.tagline}
          </p>
        </div>

        {/* CTA */}
        <div
          className="self-start mt-1 text-white text-xs font-bold px-4 py-2.5 rounded-xl whitespace-nowrap"
          style={{ background: ad.ctaColor ?? '#111827' }}
        >
          {ad.cta ?? 'Learn More'} →
        </div>
      </div>
    </a>
  )
}
