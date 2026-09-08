export default function PremiumAdBlock({ ad }) {
  if (!ad) return null
  return (
    <a
      href={ad.website_url}
      target="_blank"
      rel="noopener noreferrer"
      className="col-span-full block rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow no-underline"
    >
      <div className="relative flex items-center gap-4 px-5 py-5 bg-gradient-to-r from-gray-900 to-gray-800">
        <span className="absolute top-2 right-3 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
          Sponsored
        </span>

        {/* Logo */}
        {ad.logo_url ? (
          <img
            src={ad.logo_url}
            alt={ad.company_name}
            className="w-16 h-16 object-contain rounded-xl bg-white/10 p-1 shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-2xl font-bold text-white shrink-0">
            {ad.company_name?.[0]?.toUpperCase()}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/50 mb-0.5">{ad.company_name}</p>
          <p className="font-bold text-white text-base leading-snug">{ad.tagline}</p>
        </div>

        {/* CTA */}
        <div className="shrink-0">
          <span className="block bg-white text-gray-900 text-sm font-bold px-5 py-2.5 rounded-xl whitespace-nowrap">
            Visit Site →
          </span>
        </div>
      </div>
    </a>
  )
}
