import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'
import { scoreListings, hasSignal } from '../lib/personalization'

/**
 * Fetches listings for the current school with optional filters.
 *
 * @param {object} opts
 * @param {string}   opts.category      - exact category eq filter (null = no filter)
 * @param {string[]} opts.categoryIn    - filter by multiple categories (OR)
 * @param {boolean}  opts.noHousing     - exclude is_housing listings (Marketplace section)
 * @param {boolean}  opts.noLooking     - exclude is_looking listings (Marketplace section)
 * @param {string}   opts.sortBy        - 'newest' | 'price_asc' | 'price_desc' |
 *                                       'popular' | 'viewed' |
 *                                       'avail_asc' | 'beds_asc' | 'beds_desc' |
 *                                       'condition_best'
 * @param {string}   opts.searchQuery   - ilike filter on title
 * @param {boolean}  opts.favoritesOnly - only show listings saved by `userId`
 * @param {string}   opts.userId        - current user's id (needed for favoritesOnly)
 * @param {string}   opts.sellerId      - only show listings from this seller (UserProfile)
 */
export function useListings({
  category = null,
  categoryIn = null,
  noHousing = false,
  noLooking = false,
  sortBy = 'newest',
  searchQuery = '',
  favoritesOnly = false,
  userId = null,
  sellerId = null,
  minPrice = null,
  maxPrice = null,
  conditions = null,
  clothingSizes = null,
  genders = null,
  userType = null, // 'student' | 'landlord' | null (no filter)
} = {}) {
  const { school } = useSchool()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Debounce search — avoid firing a query on every keystroke
  const searchTimer = useRef(null)

  useEffect(() => {
    if (!school) return

    const delay = searchQuery ? 300 : 0
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetchListings()
    }, delay)

    return () => clearTimeout(searchTimer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school?.id, category, categoryIn?.join(','), noHousing, noLooking, sortBy, searchQuery, favoritesOnly, userId, sellerId, minPrice, maxPrice, conditions?.join(','), clothingSizes?.join(','), genders?.join(','), userType])

  const fetchListings = async () => {
    setLoading(true)
    setError(null)
    try {
      // ── If favoritesOnly, first get the list of saved listing IDs ─────────
      let favoriteIds = null
      if (favoritesOnly && userId) {
        const { data: favData, error: favErr } = await supabase
          .from('favorites')
          .select('listing_id')
          .eq('user_id', userId)
        if (favErr) throw favErr
        favoriteIds = (favData ?? []).map((f) => f.listing_id)
        if (favoriteIds.length === 0) {
          setListings([])
          setLoading(false)
          return
        }
      }

      // ── Build main query ──────────────────────────────────────────────────
      let query = supabase
        .from('listings')
        .select('*, profiles!seller_id(name, score, verified, grade, contact, contact_type, sold_count, avatar_url, user_type)')
        .eq('school_id', school.id)
        .eq('sold', false)

      // Category filters — categoryIn takes precedence over single category
      if (categoryIn && categoryIn.length > 0) {
        query = query.in('category', categoryIn)
      } else if (category) {
        query = query.eq('category', category)
      }

      // Section-level exclusions (Marketplace must not include housing or looking_for)
      if (noHousing) query = query.eq('is_housing', false)
      if (noLooking) query = query.eq('is_looking', false)

      if (searchQuery.trim()) {
        query = query.ilike('title', `%${searchQuery.trim()}%`)
      }

      if (minPrice !== null && minPrice !== '') query = query.gte('price', minPrice)
      if (maxPrice !== null && maxPrice !== '') query = query.lte('price', maxPrice)
      if (conditions && conditions.length > 0) query = query.in('condition', conditions)
      if (clothingSizes && clothingSizes.length > 0) query = query.in('size', clothingSizes)
      if (genders && genders.length > 0) query = query.in('gender', genders)

      if (favoriteIds) {
        query = query.in('id', favoriteIds)
      }

      if (sellerId) {
        query = query.eq('seller_id', sellerId)
      }

      // Server-side sort — avail_asc and condition_best are handled client-side
      // after the fetch because they use free-text / categorical fields.
      if (sortBy === 'price_asc') {
        query = query.order('price', { ascending: true, nullsFirst: false })
      } else if (sortBy === 'price_desc') {
        query = query.order('price', { ascending: false, nullsFirst: false })
      } else if (sortBy === 'popular') {
        query = query.order('save_count', { ascending: false, nullsFirst: false })
                     .order('created_at', { ascending: false })
      } else if (sortBy === 'viewed') {
        query = query.order('view_count', { ascending: false, nullsFirst: false })
                     .order('created_at', { ascending: false })
      } else if (sortBy === 'beds_asc') {
        query = query.order('beds', { ascending: true, nullsFirst: false })
                     .order('created_at', { ascending: false })
      } else if (sortBy === 'beds_desc') {
        query = query.order('beds', { ascending: false, nullsFirst: true })
                     .order('created_at', { ascending: false })
      } else {
        // 'newest', 'avail_asc', 'condition_best' — fetch newest first,
        // client-side reorder applied below for the latter two.
        query = query.order('created_at', { ascending: false })
      }

      const { data: rawData, error: qErr } = await query
      if (qErr) throw qErr

      // Client-side user_type filter (Supabase JS can't filter by joined columns)
      const data = userType
        ? (rawData ?? []).filter((l) => l.profiles?.user_type === userType)
        : rawData

      // ── Boost algorithm (Facebook Marketplace-style) ──────────────────────
      // When the user explicitly picks "Newest", ignore boost and show true
      // chronological order across all posts. For every other sort, active
      // boosted posts are shuffled to the top for equal visibility.
      const now = Date.now()
      const activeBoosted = (data ?? []).filter(
        (l) => l.boosted && (!l.boost_expires_at || new Date(l.boost_expires_at).getTime() > now)
      )
      const rest = (data ?? []).filter(
        (l) => !l.boosted || (l.boost_expires_at && new Date(l.boost_expires_at).getTime() <= now)
      )

      const CONDITION_RANK = { New: 1, 'Like New': 2, Good: 3, Fair: 4, Poor: 5, 'Parts Only': 6 }

      if (sortBy === 'newest') {
        // Strict chronological — merge boosted back in and sort purely by date.
        // No personalization here so "Newest" always means newest.
        const all = [...activeBoosted, ...rest].sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )
        setListings(all)
      } else if (sortBy === 'avail_asc') {
        // Fisher-Yates shuffle boosted for equal visibility, then sort rest by avail
        for (let i = activeBoosted.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[activeBoosted[i], activeBoosted[j]] = [activeBoosted[j], activeBoosted[i]]
        }
        const sorted = [...rest].sort((a, b) => {
          if (!a.avail) return 1
          if (!b.avail) return -1
          const da = new Date(a.avail)
          const db = new Date(b.avail)
          if (isNaN(da) || isNaN(db)) return String(a.avail).localeCompare(String(b.avail))
          return da - db
        })
        setListings([...activeBoosted, ...sorted])
      } else if (sortBy === 'condition_best') {
        for (let i = activeBoosted.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[activeBoosted[i], activeBoosted[j]] = [activeBoosted[j], activeBoosted[i]]
        }
        const sorted = [...rest].sort(
          (a, b) => (CONDITION_RANK[a.condition] ?? 99) - (CONDITION_RANK[b.condition] ?? 99)
        )
        setListings([...activeBoosted, ...sorted])
      } else {
        // All other sorts (price, popular, viewed, beds) — shuffle boosted to top
        for (let i = activeBoosted.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[activeBoosted[i], activeBoosted[j]] = [activeBoosted[j], activeBoosted[i]]
        }
        setListings([...activeBoosted, ...rest])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { listings, loading, error, refetch: fetchListings }
}
