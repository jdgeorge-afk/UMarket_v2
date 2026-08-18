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
      <div className="flex flex-col h-full px-4 py-4 gap-2">

        {/* Top row: Sponsored + brand name */}
        <div>
          <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest mb-1">
            Sponsored
          </p>
          <p className="text-xs font-extrabold text-white uppercase tracking-wide leading-tight">
            {ad.company_name}
          </p>
        </div>

        {/* Logo — centered, white rounded background */}
        <div className="flex-1 flex items-center justify-center">
          {ad.logo_url && !logoErr ? (
            <div className="bg-white rounded-2xl p-3 shadow-lg flex items-center justify-center" style={{ width: 100, height: 100 }}>
              <img
                src={ad.logo_url}
                alt={ad.company_name}
                onError={() => setLogoErr(true)}
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <p className="text-3xl font-black text-white tracking-tight text-center leading-tight px-2">
              {ad.company_name}
            </p>
          )}
        </div>

        {/* Tagline */}
        <p className="text-[11px] text-white/75 leading-snug text-center">
          {ad.tagline}
        </p>

        {/* CTA */}
        <div className="w-full bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors text-center">
          {cta} →
        </div>
      </div>
    </a>
  )
}
