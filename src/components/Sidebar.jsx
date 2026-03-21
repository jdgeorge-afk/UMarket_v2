import { useSchool } from '../context/SchoolContext'
import { CATEGORIES } from '../constants/categories'

// Split categories into two groups to match the screenshot layout
const HOUSING_CATS = ['all', 'housing', 'sublease', 'looking_for']
const MARKET_CATS  = ['textbooks', 'furniture', 'electronics', 'clothing', 'appliances', 'sports', 'misc']

const housing  = CATEGORIES.filter((c) => HOUSING_CATS.includes(c.id))
const market   = CATEGORIES.filter((c) => MARKET_CATS.includes(c.id))

function CatButton({ cat, active, onClick }) {
  return (
    <button
      onClick={() => onClick(cat.id)}
      className={[
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full text-left transition-colors',
        active
          ? 'bg-school-primary/10 text-school-primary font-semibold'
          : 'text-gray-600 hover:bg-gray-100',
      ].join(' ')}
    >
      <span className="text-base w-5 text-center">{cat.icon}</span>
      {cat.label}
      {active && (
        <span className="ml-auto w-2 h-2 rounded-full bg-school-primary" />
      )}
    </button>
  )
}

export default function Sidebar({ activeCategory, onCategory, onPostOpen }) {
  const { school } = useSchool()

  return (
    <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-4 px-3 flex flex-col gap-1">

      {/* Housing section */}
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-1">
        Housing
      </p>
      {housing.map((cat) => (
        <CatButton
          key={cat.id}
          cat={cat}
          active={activeCategory === cat.id}
          onClick={onCategory}
        />
      ))}

      {/* Marketplace section */}
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2 mt-3 mb-1">
        Marketplace
      </p>
      {market.map((cat) => (
        <CatButton
          key={cat.id}
          cat={cat}
          active={activeCategory === cat.id}
          onClick={onCategory}
        />
      ))}

      {/* Boost upsell card — pinned to bottom */}
      <div
        className="mt-auto rounded-2xl p-4 text-white"
        style={{ background: school?.gradient ?? 'var(--school-gradient)' }}
      >
        <p className="text-sm font-bold flex items-center gap-1">
          ⚡ Boost for $2
        </p>
        <p className="text-xs text-white/75 mt-0.5 mb-3">
          10x more views instantly.
        </p>
        <button
          onClick={onPostOpen}
          className="w-full bg-white text-school-primary font-bold text-xs py-2 rounded-lg hover:bg-white/90 transition-colors"
        >
          Post &amp; Boost →
        </button>
      </div>
    </div>
  )
}
