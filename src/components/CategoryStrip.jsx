// Mobile-only horizontal scroll strip of category chips (hidden on lg+)
import { CATEGORIES } from '../constants/categories'

export default function CategoryStrip({ activeCategory, onCategory }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pt-3 pb-1 lg:hidden">
      {CATEGORIES.map((cat) => {
        const active = activeCategory === cat.id
        return (
          <button
            key={cat.id}
            onClick={() => onCategory(cat.id)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap shrink-0 transition-colors border',
              active
                ? 'bg-school-primary text-white border-school-primary font-medium'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300',
            ].join(' ')}
          >
            <span className="text-base leading-none">{cat.icon}</span>
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}
