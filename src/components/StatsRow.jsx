import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'

export default function StatsRow({ onFilter }) {
  const { school } = useSchool()
  const [stats, setStats] = useState({ housing: 0, looking: 0, marketplace: 0 })

  useEffect(() => {
    if (!school) return
    async function fetchStats() {
      const { data } = await supabase
        .from('listings')
        .select('category, is_looking')
        .eq('school_id', school.id)
        .eq('sold', false)
      if (!data) return
      const MARKETPLACE_CATS = ['textbooks','furniture','electronics','clothing','sports','misc']
      const housing    = data.filter((l) => l.category === 'housing' || l.category === 'sublease').length
      const looking    = data.filter((l) => l.category === 'looking_for').length
      const marketplace = data.filter((l) => MARKETPLACE_CATS.includes(l.category)).length
      setStats({ housing, looking, marketplace })
    }
    fetchStats()
  }, [school])

  const items = [
    { label: 'Housing',     count: stats.housing,     filter: 'housing' },
    { label: 'Looking For', count: stats.looking,     filter: 'looking_for' },
    { label: 'Marketplace', count: stats.marketplace, filter: 'marketplace' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 px-4 mt-3">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => onFilter(item.filter)}
          className="bg-white rounded-xl border border-gray-100 px-3 py-3 flex items-center gap-2 hover:border-school-primary/30 hover:bg-school-primary/5 transition-colors text-left shadow-sm"
        >
          <div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{item.count}</p>
            <p className="text-xs text-gray-400">{item.label}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
