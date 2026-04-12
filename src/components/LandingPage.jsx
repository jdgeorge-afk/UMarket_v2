import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'
import { getRecentlyViewed } from '../lib/personalization'
import SectionTabs from './SectionTabs'
import StatsRow from './StatsRow'
import ListingCard from './ListingCard'

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// Static fallback shown before data loads (or if db is empty)
const FALLBACK_HOUSING = {
  title: '2BR Near Campus — May',
  price: 850, beds: 2, avail: 'May', category: 'sublease',
  profiles: { name: 'Jordan S.' },
  created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
}

const MARKETPLACE_CATS = ['textbooks', 'furniture', 'electronics', 'clothing', 'sports', 'misc']

// ── Housing listing card ───────────────────────────────────────────────────────
function HousingCard({ listing, onOpen }) {
  const l = listing ?? FALLBACK_HOUSING
  const sellerInitial = (l.profiles?.name ?? 'U')[0].toUpperCase()
  const categoryLabel = l.category === 'sublease' ? 'Sublease' : 'Housing'

  return (
    <div
      onClick={() => listing && onOpen?.(listing)}
      className={`bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden w-full max-w-xs mx-auto ${listing && onOpen ? 'cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-150' : ''}`}
    >
      <div className="h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
        {l.images?.[0]
          ? <img src={l.images[0]} alt={l.title} className="w-full h-full object-cover" />
          : null
        }
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

// ── Marketplace listing grid ──────────────────────────────────────────────────
function MarketplaceGrid({ listings, onOpen, onRequireAuth }) {
  const items = listings?.length ? listings : []
  if (!items.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
      {items.slice(0, 4).map((l) => (
        <ListingCard
          key={l.id}
          listing={l}
          onOpen={onOpen}
          onRequireAuth={onRequireAuth}
        />
      ))}
    </div>
  )
}

// ── Looking For listing grid ──────────────────────────────────────────────────
function LookingForGrid({ listings, onOpen, onRequireAuth }) {
  const items = listings?.length ? listings : []
  if (!items.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm mx-auto">
      {items.slice(0, 4).map((l) => (
        <ListingCard
          key={l.id}
          listing={l}
          onOpen={onOpen}
          onRequireAuth={onRequireAuth}
        />
      ))}
    </div>
  )
}

// ── Alternating feature section ───────────────────────────────────────────────
function FeatureSection({ flip = false, eyebrow, headline, accentWord, body, ctaLabel, onCta, visual, bg = 'white' }) {
  const headParts = accentWord ? headline.split(accentWord) : [headline]
  const isGray = bg === 'gray'

  const textBlock = (
    <div className="flex flex-col justify-center gap-6">
      <span className="self-start bg-school-primary/10 text-school-primary text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full">
        {eyebrow}
      </span>
      <h2 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-gray-900 leading-tight">
        {headParts.length > 1
          ? <>{headParts[0]}<span className="text-school-primary">{accentWord}</span>{headParts[1]}</>
          : headline}
      </h2>
      <p className="text-gray-500 text-xl leading-relaxed max-w-sm">{body}</p>
      <button
        onClick={onCta}
        className="self-start inline-flex items-center gap-2 bg-school-primary text-white font-bold text-sm px-7 py-3.5 rounded-full hover:opacity-90 transition-opacity shadow-md"
      >
        {ctaLabel}
      </button>
    </div>
  )

  const visualBlock = <div className="flex items-center justify-center">{visual}</div>

  return (
    <section className={`relative overflow-hidden min-h-screen flex items-center ${isGray ? 'bg-gray-50' : 'bg-white'}`}>
      {/* Decorative background blobs */}
      <div className={`pointer-events-none absolute -top-24 ${flip ? '-left-24' : '-right-24'} w-96 h-96 rounded-full blur-3xl opacity-30 bg-school-primary`} />
      <div className={`pointer-events-none absolute -bottom-24 ${flip ? '-right-24' : '-left-24'} w-64 h-64 rounded-full blur-3xl opacity-20 bg-school-primary`} />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-8 lg:px-16 py-20 sm:py-28 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          {flip ? <>{visualBlock}{textBlock}</> : <>{textBlock}{visualBlock}</>}
        </div>
      </div>
    </section>
  )
}

// ── Landing page ──────────────────────────────────────────────────────────────
export default function LandingPage({ onFilter, onPostOpen, onRequireAuth, onOpenListing }) {
  const { school } = useSchool()
  const [previews, setPreviews] = useState({ housing: null, marketplace: [], looking: [] })
  // Read once on mount — getRecentlyViewed() is synchronous (localStorage)
  const [recentlyViewed] = useState(() => getRecentlyViewed())

  useEffect(() => {
    if (!school) return
    async function fetchPreviews() {
      const [housingRes, marketRes, lookingRes] = await Promise.all([
        supabase
          .from('listings')
          .select('id, title, price, category, beds, avail, images, created_at, profiles!seller_id(name)')
          .eq('school_id', school.id).eq('sold', false)
          .in('category', ['housing', 'sublease'])
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('listings')
          .select('id, title, price, budget, category, condition, images, is_looking, is_housing, beds, avail, boosted, sold, created_at, profiles!seller_id(verified)')
          .eq('school_id', school.id).eq('sold', false)
          .in('category', MARKETPLACE_CATS)
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('listings')
          .select('id, title, price, budget, category, condition, images, is_looking, is_housing, beds, avail, boosted, sold, created_at, profiles!seller_id(verified)')
          .eq('school_id', school.id).eq('sold', false)
          .eq('category', 'looking_for')
          .order('created_at', { ascending: false })
          .limit(4),
      ])
      setPreviews({
        housing:     housingRes.data?.[0]  ?? null,
        marketplace: marketRes.data         ?? [],
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
      <section className="relative overflow-hidden bg-white min-h-screen flex flex-col items-center justify-center px-4 sm:px-8 text-center">
        {/* Background decoration */}
        <div className="pointer-events-none absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full blur-3xl opacity-25 bg-school-primary" />
        <div className="pointer-events-none absolute -bottom-32 -left-32 w-[400px] h-[400px] rounded-full blur-3xl opacity-20 bg-school-primary" />

        <div className="relative">
          <p className="text-sm font-bold tracking-widest uppercase text-school-primary mb-6">
            University Marketplace
          </p>
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold text-gray-900 leading-[1.0] max-w-5xl mx-auto">
            Your campus.<br />
            <span className="text-school-primary">Your marketplace.</span>
          </h1>
          <p className="text-gray-400 text-xl sm:text-2xl mt-8 max-w-2xl mx-auto leading-relaxed">
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

          {/* Stats inline in hero */}
          <div className="mt-14">
            <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4">
              We're live at your university now!
            </p>
            <div className="max-w-2xl mx-auto">
              <StatsRow onFilter={onFilter} />
            </div>
          </div>

          {/* Scroll nudge */}
          <div className="mt-12 flex flex-col items-center gap-1 text-gray-300">
            <span className="text-xs font-semibold tracking-widest uppercase">Explore</span>
            <svg className="w-5 h-5 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── Recently Viewed ─────────────────────────────────────────────── */}
      {recentlyViewed.length > 0 && (
        <section className="bg-white py-10 px-4 sm:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Recently Viewed</h2>
              <span className="text-xs font-semibold text-school-primary bg-school-primary/10 px-2.5 py-1 rounded-full">
                Picked for you
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory scrollbar-hide">
              {recentlyViewed.map((l) => (
                <div key={l.id} className="shrink-0 w-40 snap-start">
                  <ListingCard
                    listing={l}
                    onOpen={onOpenListing}
                    onRequireAuth={onRequireAuth ?? ((cb) => cb())}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Housing ─────────────────────────────────────────────────────── */}
      <FeatureSection
        flip={false}
        eyebrow="Housing"
        headline="Find roommates, subleases, and your next place."
        accentWord="subleases,"
        body={`Real listings posted by students and landlords at ${school?.shortName ?? 'your school'}. Filter by distance, price, and availability — then connect directly.`}
        ctaLabel="Browse Housing →"
        onCta={() => onFilter('housing')}
        visual={<HousingCard listing={previews.housing} onOpen={onOpenListing} />}
        bg="white"
      />

      {/* ── Marketplace ─────────────────────────────────────────────────── */}
      <FeatureSection
        flip={true}
        eyebrow="Marketplace"
        headline="Buy and sell everything student life."
        accentWord="everything"
        body="Textbooks, furniture, electronics, clothing, and more — all from students nearby. Local pickup, no fees, no hassle."
        ctaLabel="Browse Marketplace →"
        onCta={() => onFilter('marketplace')}
        visual={<MarketplaceGrid listings={previews.marketplace} onOpen={onOpenListing ?? (() => {})} onRequireAuth={onRequireAuth} />}
        bg="gray"
      />

      {/* ── Looking For ─────────────────────────────────────────────────── */}
      <FeatureSection
        flip={false}
        eyebrow="Looking For"
        headline="Post what you need. Let campus come to you."
        accentWord="campus"
        body="Tell your campus community what you're searching for — housing, textbooks, furniture, and more. Sellers will find you."
        ctaLabel="See Requests →"
        onCta={() => onFilter('looking_for')}
        visual={<LookingForGrid listings={previews.looking} onOpen={onOpenListing ?? (() => {})} onRequireAuth={onRequireAuth} />}
        bg="white"
      />

      {/* ── CTA banner ──────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden min-h-[60vh] flex items-center justify-center px-4 sm:px-8 py-20 text-center text-white"
        style={{ background: school?.gradient ?? 'var(--school-gradient)' }}
      >
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-white/20 blur-2xl" />
        <div className="relative">
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
        </div>
      </section>

      {/* ── Disclaimer ──────────────────────────────────────────────────── */}
      <div className="bg-white text-center py-4 border-t border-gray-100 space-y-1">
        <p className="text-gray-500 text-xs font-medium">© 2026 UMarket™</p>
        <p className="text-gray-400 text-xs">
          UMarket is not affiliated with or endorsed by any university.
        </p>
      </div>

    </div>
  )
}
