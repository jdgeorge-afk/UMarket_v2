import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'
import SectionTabs from './SectionTabs'
import StatsRow from './StatsRow'

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function guessEmoji(title = '') {
  const t = title.toLowerCase()
  if (t.includes('text') || t.includes('book')) return '📚'
  if (t.includes('furn') || t.includes('couch') || t.includes('desk') || t.includes('chair')) return '🛋️'
  if (t.includes('laptop') || t.includes('computer') || t.includes('electron')) return '💻'
  if (t.includes('cloth') || t.includes('shirt') || t.includes('jacket') || t.includes('shoes')) return '👕'
  if (t.includes('sport') || t.includes('bike') || t.includes('gym') || t.includes('soccer')) return '⚽'
  if (t.includes('hous') || t.includes('room') || t.includes('sublease') || t.includes('apt') || t.includes('bed')) return '🏠'
  if (t.includes('guitar') || t.includes('music') || t.includes('drum') || t.includes('piano')) return '🎸'
  if (t.includes('car') || t.includes('truck') || t.includes('vehicle')) return '🚗'
  return '🔍'
}

// Static fallbacks shown before data loads (or if db is empty)
const FALLBACK_HOUSING = {
  title: '2BR Near Campus — May',
  price: 850, beds: 2, avail: 'May', category: 'sublease',
  profiles: { name: 'Jordan S.' },
  created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
}
const FALLBACK_MARKET = {
  title: 'Fender Stratocaster', price: 280, category: 'misc',
  created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
}
const FALLBACK_LOOKING = [
  { title: 'Organic Chem textbook (any edition)', budget: 40, profiles: { name: 'Maya K.' }, created_at: new Date().toISOString() },
  { title: 'Desk + chair for studio apt',         budget: 80, profiles: { name: 'Tyler B.' }, created_at: new Date().toISOString() },
  { title: 'Single room sublease May–Aug',         budget: 700, profiles: { name: 'Priya R.' }, created_at: new Date().toISOString() },
  { title: 'Used acoustic guitar',                 budget: 120, profiles: { name: 'Sam W.' }, created_at: new Date().toISOString() },
]

const MARKETPLACE_CATS = ['textbooks', 'furniture', 'electronics', 'clothing', 'sports', 'misc']

// ── Housing listing card ───────────────────────────────────────────────────────
function HousingCard({ listing }) {
  const l = listing ?? FALLBACK_HOUSING
  const sellerInitial = (l.profiles?.name ?? 'U')[0].toUpperCase()
  const categoryLabel = l.category === 'sublease' ? 'Sublease' : 'Housing'

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden w-full max-w-xs mx-auto">
      <div className="h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <span className="text-7xl">🏠</span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-bold text-gray-900 leading-snug line-clamp-2">{l.title}</p>
          {l.price && (
            <p className="shrink-0 font-extrabold text-school-primary whitespace-nowrap">
              ${Number(l.price).toLocaleString()}
              <span className="text-xs font-normal text-gray-400">/mo</span>
            </p>
          )}
        </div>
        {l.beds && (
          <p className="text-sm text-gray-400 mb-3">{l.beds} bed · {l.avail ?? 'Available'}</p>
        )}
        <div className="flex gap-2 flex-wrap">
          <span className="bg-school-primary/10 text-school-primary text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {categoryLabel}
          </span>
          <span className="bg-green-50 text-green-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            Available Now
          </span>
        </div>
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50">
          <div className="w-6 h-6 rounded-full bg-school-primary/20 flex items-center justify-center text-xs font-bold text-school-primary">
            {sellerInitial}
          </div>
          <p className="text-xs text-gray-400">
            {l.profiles?.name ?? 'Student'} · {timeAgo(l.created_at)}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Marketplace category grid + recent listing ────────────────────────────────
function MarketplaceCard({ recentListing }) {
  const l = recentListing ?? FALLBACK_MARKET
  const cats = [
    { icon: '📚', label: 'Textbooks' },
    { icon: '💻', label: 'Electronics' },
    { icon: '🛋️', label: 'Furniture' },
    { icon: '👕', label: 'Clothing' },
    { icon: '⚽', label: 'Sports' },
    { icon: '📦', label: 'Misc' },
  ]
  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="grid grid-cols-3 gap-3 mb-3">
        {cats.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center py-4 gap-1.5">
            <span className="text-3xl">{c.icon}</span>
            <p className="text-[11px] font-semibold text-gray-500">{c.label}</p>
          </div>
        ))}
      </div>
      {/* Most recent real listing */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
        <span className="text-2xl shrink-0">{guessEmoji(l.title)}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-gray-900 truncate">{l.title}</p>
          <p className="text-xs text-gray-400">{timeAgo(l.created_at)}</p>
        </div>
        <p className="font-extrabold text-school-primary text-sm shrink-0">
          ${Number(l.price).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

// ── Looking For request list ───────────────────────────────────────────────────
function LookingForList({ listings }) {
  const items = listings?.length ? listings : FALLBACK_LOOKING
  return (
    <div className="space-y-2.5 w-full max-w-xs mx-auto">
      {items.slice(0, 4).map((item, i) => (
        <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
          <span className="text-xl shrink-0">{guessEmoji(item.title)}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
            <p className="text-xs text-gray-400">{item.profiles?.name ?? 'Student'}</p>
          </div>
          {item.budget && (
            <span className="shrink-0 bg-school-primary/10 text-school-primary text-xs font-bold px-2.5 py-0.5 rounded-full">
              ${Number(item.budget).toLocaleString()}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Alternating feature section ───────────────────────────────────────────────
function FeatureSection({ flip = false, eyebrow, headline, accentWord, body, ctaLabel, onCta, visual, bg = 'white' }) {
  const headParts = accentWord ? headline.split(accentWord) : [headline]

  const textBlock = (
    <div className="flex flex-col justify-center gap-5">
      <p className="text-xs font-bold tracking-widest uppercase text-school-primary">{eyebrow}</p>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight">
        {headParts.length > 1
          ? <>{headParts[0]}<span className="text-school-primary">{accentWord}</span>{headParts[1]}</>
          : headline}
      </h2>
      <p className="text-gray-500 text-base leading-relaxed max-w-sm">{body}</p>
      <button
        onClick={onCta}
        className="self-start inline-flex items-center gap-2 bg-school-primary text-white font-bold text-sm px-6 py-3 rounded-full hover:opacity-90 transition-opacity shadow-sm"
      >
        {ctaLabel}
      </button>
    </div>
  )

  const visualBlock = <div className="flex items-center justify-center">{visual}</div>

  return (
    <section className={bg === 'gray' ? 'bg-gray-50' : 'bg-white'}>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 lg:px-16 py-16 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {flip ? <>{visualBlock}{textBlock}</> : <>{textBlock}{visualBlock}</>}
        </div>
      </div>
    </section>
  )
}

// ── Landing page ──────────────────────────────────────────────────────────────
export default function LandingPage({ onFilter, onPostOpen, onRequireAuth }) {
  const { school } = useSchool()
  const [previews, setPreviews] = useState({ housing: null, marketplace: null, looking: [] })

  useEffect(() => {
    if (!school) return
    async function fetchPreviews() {
      const [housingRes, marketRes, lookingRes] = await Promise.all([
        supabase
          .from('listings')
          .select('id, title, price, category, beds, avail, created_at, profiles!seller_id(name)')
          .eq('school_id', school.id).eq('sold', false)
          .in('category', ['housing', 'sublease'])
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('listings')
          .select('id, title, price, category, created_at')
          .eq('school_id', school.id).eq('sold', false)
          .in('category', MARKETPLACE_CATS)
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('listings')
          .select('id, title, budget, created_at, profiles!seller_id(name)')
          .eq('school_id', school.id).eq('sold', false)
          .eq('category', 'looking_for')
          .order('created_at', { ascending: false })
          .limit(4),
      ])
      setPreviews({
        housing:     housingRes.data?.[0]  ?? null,
        marketplace: marketRes.data?.[0]   ?? null,
        looking:     lookingRes.data       ?? [],
      })
    }
    fetchPreviews()
  }, [school?.id])

  return (
    <div className="min-h-screen">

      {/* ── Sticky section tabs ─────────────────────────────────────────── */}
      <div className="sticky top-14 z-30 bg-white border-b border-gray-100 shadow-sm">
        <SectionTabs activeFilter="all" onFilter={onFilter} />
      </div>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="bg-white px-4 sm:px-8 pt-16 pb-12 text-center">
        <p className="text-xs font-bold tracking-widest uppercase text-school-primary mb-4">
          University Marketplace
        </p>
        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-[1.05] max-w-3xl mx-auto">
          Your campus.<br />
          <span className="text-school-primary">Your marketplace.</span>
        </h1>
        <p className="text-gray-400 text-lg mt-5 max-w-lg mx-auto leading-relaxed">
          Housing, subleases, roommates, and student deals — all in one place.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
          <button
            onClick={() => onFilter('housing')}
            className="inline-flex items-center gap-2 bg-school-primary text-white font-bold text-sm sm:text-base px-7 py-3.5 rounded-full hover:opacity-90 transition-opacity shadow-md"
          >
            Browse Housing →
          </button>
          <button
            onClick={() => onFilter('marketplace')}
            className="inline-flex items-center gap-2 border-2 border-gray-200 text-gray-700 font-bold text-sm sm:text-base px-7 py-3.5 rounded-full hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Browse Marketplace
          </button>
        </div>
      </section>

      {/* ── Live stats ──────────────────────────────────────────────────── */}
      <section className="bg-white pb-12">
        <p className="text-center text-xs font-bold tracking-widest uppercase text-gray-400 mb-4 px-4">
          We're live at your university now!
        </p>
        <div className="max-w-2xl mx-auto">
          <StatsRow onFilter={onFilter} />
        </div>
      </section>

      <div className="h-px bg-gray-100" />

      {/* ── Housing ─────────────────────────────────────────────────────── */}
      <FeatureSection
        flip={false}
        eyebrow="Housing"
        headline="Find roommates, subleases, and your next place."
        accentWord="subleases,"
        body={`Real listings posted by students and landlords at ${school?.shortName ?? 'your school'}. Filter by distance, price, and availability — then connect directly.`}
        ctaLabel="🏠 Browse Housing →"
        onCta={() => onFilter('housing')}
        visual={<HousingCard listing={previews.housing} />}
        bg="white"
      />

      {/* ── Marketplace ─────────────────────────────────────────────────── */}
      <FeatureSection
        flip={true}
        eyebrow="Marketplace"
        headline="Buy and sell everything student life."
        accentWord="everything"
        body="Textbooks, furniture, electronics, clothing, and more — all from students nearby. Local pickup, no fees, no hassle."
        ctaLabel="🛍️ Browse Marketplace →"
        onCta={() => onFilter('marketplace')}
        visual={<MarketplaceCard recentListing={previews.marketplace} />}
        bg="gray"
      />

      {/* ── Looking For ─────────────────────────────────────────────────── */}
      <FeatureSection
        flip={false}
        eyebrow="Looking For"
        headline="Post what you need. Let campus come to you."
        accentWord="campus"
        body="Tell your campus community what you're searching for — housing, textbooks, furniture, and more. Sellers will find you."
        ctaLabel="🔍 See Requests →"
        onCta={() => onFilter('looking_for')}
        visual={<LookingForList listings={previews.looking} />}
        bg="white"
      />

      {/* ── CTA banner ──────────────────────────────────────────────────── */}
      <section
        className="px-4 sm:px-8 py-16 sm:py-20 text-center text-white"
        style={{ background: school?.gradient ?? 'var(--school-gradient)' }}
      >
        <h2 className="text-3xl sm:text-5xl font-extrabold mb-4 leading-tight">
          Ready to get started?
        </h2>
        <p className="text-white/75 text-base sm:text-lg mb-8 max-w-md mx-auto">
          Free to use. Built by students, for students at {school?.shortName ?? 'your school'}.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => onRequireAuth(() => onPostOpen?.())}
            className="inline-flex items-center gap-2 bg-white text-school-primary font-bold text-sm px-7 py-3.5 rounded-full hover:bg-white/90 transition-colors shadow-md"
          >
            + Post a Listing
          </button>
          <button
            onClick={() => onFilter('housing')}
            className="inline-flex items-center gap-2 border-2 border-white/40 text-white font-bold text-sm px-7 py-3.5 rounded-full hover:bg-white/10 transition-colors"
          >
            Browse Listings
          </button>
        </div>
      </section>

    </div>
  )
}
