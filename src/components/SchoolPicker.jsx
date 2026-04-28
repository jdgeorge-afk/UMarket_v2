import { useState } from 'react'
import { useSchool } from '../context/SchoolContext'
import { SCHOOLS } from '../constants/schools'
import { SUPPORT_EMAIL } from '../constants/config'

export default function SchoolPicker() {
  const { selectSchool } = useSchool()
  const [search, setSearch] = useState('')

  const filtered = SCHOOLS.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.shortName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-extrabold text-white tracking-tight">UMarket — The College Student Marketplace</h1>
        <p className="text-gray-400 mt-2 text-lg">Buy, sell, find housing, and sublease near your campus.</p>
        <p className="text-gray-600 text-xs mt-2">UMarket is not affiliated with or endorsed by any university.</p>
      </div>

      {/* Search bar */}
      <div className="relative w-full max-w-sm mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your school..."
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-gray-800 text-white placeholder:text-gray-500 text-sm outline-none focus:ring-2 focus:ring-white/20"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-lg"
          >
            ×
          </button>
        )}
      </div>

      {/* School cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-2xl">
        {filtered.map((school) => (
          <div key={school.id} className="relative">
            <button
              onClick={() => school.live && selectSchool(school.id)}
              disabled={!school.live}
              className={[
                'w-full p-6 rounded-2xl text-left transition-all duration-200',
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

            {/* Coming soon badge — outside the grayscale button so red shows */}
            {!school.live && (
              <span className="absolute top-3 right-3 bg-gray-700 text-red-400 text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide uppercase pointer-events-none">
                Coming Soon
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="text-gray-600 text-xs mt-10">
        More schools coming soon — request yours at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline hover:text-gray-800">{SUPPORT_EMAIL}</a>
      </p>
    </div>
  )
}
