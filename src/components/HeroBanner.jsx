import { useSchool } from '../context/SchoolContext'

export default function HeroBanner({ onBrowseHousing, onPostNeed }) {
  const { school } = useSchool()

  return (
    <div
      className="relative mx-4 mt-4 rounded-2xl overflow-hidden text-white p-7"
      style={{ background: school?.gradient ?? 'var(--school-gradient)' }}
    >
      {/* Decorative circles */}
      <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10" />
      <div className="absolute -right-4 top-12 w-24 h-24 rounded-full bg-white/5" />

      <p className="relative text-2xl sm:text-3xl font-extrabold leading-tight max-w-xs">
        Find your place near campus.
      </p>
      <p className="relative text-white/70 text-sm mt-1 mb-5">
        Built by students, for students.
      </p>

      <div className="relative flex flex-wrap gap-3">
        <button
          onClick={onBrowseHousing}
          className="flex items-center gap-1.5 bg-white text-school-primary font-bold text-sm px-4 py-2 rounded-xl hover:bg-white/90 transition-colors shadow-md"
        >
          Browse Housing →
        </button>
        <button
          onClick={onPostNeed}
          className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white font-semibold text-sm px-4 py-2 rounded-xl border border-white/30 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-blue-300 animate-pulse" />
          Post a Need
        </button>
      </div>
    </div>
  )
}
