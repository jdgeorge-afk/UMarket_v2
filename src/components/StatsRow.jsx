import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'

export default function StatsRow({ onFilter }) {
  const { school } = useSchool()
  const [stats, setStats] = useState({ roommates: 0, housing: 0, subleases: 0 })

  useEffect(() => {
    if (!school) return
    async function fetchStats() {
      const { data } = await supabase
        .from('listings')
        .select('category, is_looking')
        .eq('school_id', school.id)
        .eq('sold', false)
      if (!data) return
      const roommates = data.filter((l) => l.category === 'looking_for').length
      const housing   = data.filter((l) => l.category === 'housing').length
      const subleases = data.filter((l) => l.category === 'sublease').length
      setStats({ roommates, housing, subleases })
    }
    fetchStats()
  }, [school])

  const items = [
    { label: 'Looking for Roommates', count: stats.roommates, filter: 'looking_for' },
    { label: 'Housing Listed',        count: stats.housing,   filter: 'housing'     },
    { label: 'Subleases',             count: stats.subleases, filter: 'housing:sublease' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 px-4 sm:px-8 mt-4">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => onFilter(item.filter)}
          className="bg-white rounded-2xl border border-gray-200 py-5 flex flex-col items-center hover:border-school-primary/40 hover:shadow-md transition-all text-center"
        >
          <p className="text-3xl sm:text-4xl font-bold text-school-primary leading-none">{item.count}</p>
          <p className="text-xs sm:text-sm text-gray-500 mt-1.5 px-2">{item.label}</p>
        </button>
      ))}
    </div>
  )
}
