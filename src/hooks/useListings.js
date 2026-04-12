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
 * @param {string}   opts.sortBy        - 'newest' | 'price_asc' | 'price_desc'
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
  }, [school?.id, category, categoryIn?.join(','), noHousing, noLooking, sortBy, searchQuery, favoritesOnly, userId, sellerId, minPrice, maxPrice, conditions?.join(','), clothingSizes?.join(','), genders?.join(',')])

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
        .select('*, profiles!seller_id(name, score, verified, grade, contact, contact_type, sold_count, avatar_url)')
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

      // Sort by user's choice (boosted posts get pulled out and shuffled client-side)
      if (sortBy === 'price_asc') {
        query = query.order('price', { ascending: true, nullsFirst: false })
      } else if (sortBy === 'price_desc') {
        query = query.order('price', { ascending: false, nullsFirst: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error: qErr } = await query
      if (qErr) throw qErr

      // ── Boost algorithm (Facebook Marketplace-style) ──────────────────────
      // Active boosted posts (not expired) are separated, randomly shuffled for
      // equal visibility across all boosted sellers, then placed at the top.
      // Regular posts keep their sort order below.
      const now = Date.now()
      const activeBoosted = (data ?? []).filter(
        (l) => l.boosted && (!l.boost_expires_at || new Date(l.boost_expires_at).getTime() > now)
      )
      const rest = (data ?? []).filter(
        (l) => !l.boosted || (l.boost_expires_at && new Date(l.boost_expires_at).getTime() <= now)
      )
      // Fisher-Yates shuffle so every boosted seller gets equal top-page time
      for (let i = activeBoosted.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[activeBoosted[i], activeBoosted[j]] = [activeBoosted[j], activeBoosted[i]]
      }
      // Personalize the non-boosted portion when on the default "newest" sort
      // and the user has opened enough listings to have a meaningful signal.
      // Manual sorts (price asc/desc) are left untouched.
      const rankedRest = (sortBy === 'newest' && hasSignal(school.id))
        ? scoreListings(rest, school.id)
        : rest
      setListings([...activeBoosted, ...rankedRest])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { listings, loading, error, refetch: fetchListings }
}
