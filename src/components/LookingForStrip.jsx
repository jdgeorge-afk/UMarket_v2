// Preview strip of "Looking For" posts shown in the feed above the main listing grid
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30)  return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function LookingForStrip({ onOpenListing, onCategory, onPostOpen }) {
  const { school } = useSchool()
  const [items, setItems] = useState([])

  useEffect(() => {
    if (!school) return
    supabase
      .from('listings')
      .select('*, profiles(name, verified)')
      .eq('school_id', school.id)
      .eq('category', 'looking_for')
      .eq('sold', false)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setItems(data ?? []))
  }, [school])

  if (!items.length) return null

  return (
    <div className="mx-4 mt-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <p className="font-semibold text-gray-900 flex items-center gap-1.5">
            🔍 Looking For
          </p>
          <p className="text-xs text-gray-400">Students searching now</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCategory('looking_for')}
            className="text-xs text-gray-500 border border-gray-200 px-2.5 py-1 rounded-full hover:bg-gray-50"
          >
            All
          </button>
          <button
            onClick={onPostOpen}
            className="text-xs bg-school-primary text-white px-2.5 py-1 rounded-full font-semibold hover:opacity-90"
          >
            + Post
          </button>
        </div>
      </div>

      {/* Items list */}
      <div className="divide-y divide-gray-50">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onOpenListing(item)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
          >
            <span className="text-xl shrink-0">🔍</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
              <p className="text-xs text-gray-400">
                {item.profiles?.name?.split(' ')[0] ?? 'Someone'} · {timeAgo(item.created_at)}
              </p>
            </div>
            {item.budget && (
              <span className="shrink-0 bg-gray-100 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                ${Number(item.budget).toLocaleString()}
              </span>
            )}
            <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  )
}
