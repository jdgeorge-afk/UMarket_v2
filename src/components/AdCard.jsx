import { useState } from 'react'

export default function AdCard({ ad }) {
  if (!ad) return null
  const [logoErr, setLogoErr] = useState(false)

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
      <div className="flex flex-col items-center justify-between h-full px-4 py-5 gap-3 text-center">

        {/* Sponsored label */}
        <p className="self-start text-[9px] font-bold text-white/40 uppercase tracking-widest">
          Sponsored
        </p>

        {/* Logo */}
        <div className="flex-1 flex items-center justify-center w-full">
          {ad.logo_url && !logoErr ? (
            <img
              src={ad.logo_url}
              alt={ad.company_name}
              onError={() => setLogoErr(true)}
              className="max-h-14 max-w-[80%] object-contain drop-shadow-lg"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          ) : (
            <p className="text-2xl font-black text-white tracking-tight leading-tight">
              {ad.company_name}
            </p>
          )}
        </div>

        {/* Company name + tagline */}
        <div className="w-full space-y-1">
          <p className="text-xs font-extrabold text-white uppercase tracking-wide">
            {ad.company_name}
          </p>
          <p className="text-[11px] text-white/70 leading-snug">
            {ad.tagline}
          </p>
        </div>

        {/* CTA */}
        <div className="w-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors">
          {cta} →
        </div>
      </div>
    </a>
  )
}
