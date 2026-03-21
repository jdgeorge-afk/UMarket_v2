import { useSchool } from '../context/SchoolContext'
import { SCHOOLS } from '../constants/schools'

export default function SchoolPicker() {
  const { selectSchool } = useSchool()

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-extrabold text-white tracking-tight">UMarket</h1>
        <p className="text-gray-400 mt-2 text-lg">The college student marketplace</p>
      </div>

      {/* School cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-2xl">
        {SCHOOLS.map((school) => (
          <button
            key={school.id}
            onClick={() => school.live && selectSchool(school.id)}
            disabled={!school.live}
            className={[
              'relative p-6 rounded-2xl text-left transition-all duration-200',
              school.live
                ? 'cursor-pointer hover:scale-[1.03] hover:shadow-2xl hover:shadow-black/40 active:scale-[0.98]'
                : 'cursor-not-allowed opacity-40 grayscale',
            ].join(' ')}
            style={
              school.live
                ? { background: school.gradient }
                : { background: '#374151' }
            }
          >
            {/* Coming soon badge */}
            {!school.live && (
              <span className="absolute top-3 right-3 bg-black/30 text-white/80 text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide uppercase">
                Coming Soon
              </span>
            )}

            {/* School info */}
            <p className="text-white font-bold text-xl leading-tight">{school.shortName}</p>
            <p className="text-white/65 text-sm mt-0.5">{school.name}</p>

            {/* Live indicator */}
            {school.live && (
              <div className="flex items-center gap-1.5 mt-4">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/70 text-xs font-medium">Live</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <p className="text-gray-600 text-xs mt-10">
        More schools coming soon — request yours at umarket.co
      </p>
    </div>
  )
}
