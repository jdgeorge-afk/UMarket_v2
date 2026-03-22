export default function HeroBanner({ onBrowseHousing, onPostNeed }) {
  return (
    <div className="px-4 sm:px-8 pt-10 pb-6 text-center">
      <p className="text-xs font-semibold tracking-widest uppercase text-school-primary mb-3">
        Built for students
      </p>
      <h1 className="text-3xl sm:text-5xl font-extrabold text-gray-900 leading-tight max-w-2xl mx-auto">
        Find housing, roommates,{' '}
        <span className="text-school-primary">subleases,</span>
        <br />and student deals in one place.
      </h1>
      <p className="text-gray-400 text-base mt-4 max-w-lg mx-auto">
        The campus marketplace built by students, for students.
      </p>
      <div className="flex items-center justify-center gap-3 mt-6 flex-wrap">
        <button
          onClick={onBrowseHousing}
          className="inline-flex items-center gap-2 bg-school-primary text-white font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity shadow-sm"
        >
          Browse Housing →
        </button>
        <button
          onClick={onPostNeed}
          className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 font-semibold text-sm px-6 py-3 rounded-full hover:bg-gray-50 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-school-primary animate-pulse" />
          Post a Need
        </button>
      </div>
    </div>
  )
}
