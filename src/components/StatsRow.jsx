import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'

export default function StatsRow({ onCategory }) {
  const { school } = useSchool()
  const [stats, setStats] = useState({ housing: 0, sublease: 0, looking: 0 })

  useEffect(() => {
    if (!school) return
    async function fetchStats() {
      const { data } = await supabase
        .from('listings')
        .select('category, is_looking')
        .eq('school_id', school.id)
        .eq('sold', false)
      if (!data) return
      const housing  = data.filter((l) => l.category === 'housing').length
      const sublease = data.filter((l) => l.category === 'sublease').length
      const looking  = data.filter((l) => l.category === 'looking_for').length
      setStats({ housing, sublease, looking })
    }
    fetchStats()
  }, [school])

  const items = [
    { icon: '🏠', label: 'Listings',  count: stats.housing,  cat: 'housing' },
    { icon: '🔑', label: 'Subleases', count: stats.sublease, cat: 'sublease' },
    { icon: '🔍', label: 'Looking',   count: stats.looking,  cat: 'looking_for' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 px-4 mt-3">
      {items.map((item) => (
        <button
          key={item.cat}
          onClick={() => onCategory(item.cat)}
          className="bg-white rounded-xl border border-gray-100 px-3 py-3 flex items-center gap-2 hover:border-school-primary/30 hover:bg-school-primary/5 transition-colors text-left shadow-sm"
        >
          <span className="text-xl">{item.icon}</span>
          <div>
            <p className="text-lg font-bold text-gray-900 leading-tight">{item.count}</p>
            <p className="text-xs text-gray-400">{item.label}</p>
          </div>
        </button>
      ))}
    </div>
  )
}
