export default function AdCard({ ad }) {
  if (!ad) return null
  return (
    <a
      href={ad.website_url}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-2xl overflow-hidden flex flex-col text-white no-underline hover:opacity-90 transition-opacity"
      style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', minHeight: '200px' }}
    >
      <div className="flex flex-col h-full p-4">
        <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-1">
          Sponsored
        </p>
        <div className="flex items-center gap-2 mb-2">
          {ad.logo_url ? (
            <img src={ad.logo_url} alt={ad.company_name} className="w-8 h-8 object-contain rounded-lg bg-white/20" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm font-bold">
              {ad.company_name?.[0]?.toUpperCase()}
            </div>
          )}
          <p className="text-sm font-bold leading-tight">{ad.company_name}</p>
        </div>
        <p className="text-xs text-white/80 leading-relaxed flex-1">{ad.tagline}</p>
        <div className="mt-3 block text-center bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors">
          Learn More →
        </div>
      </div>
    </a>
  )
}
