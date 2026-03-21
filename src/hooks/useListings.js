import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'

/**
 * Fetches listings for the current school with optional filters.
 *
 * @param {object} opts
 * @param {string}  opts.category      - category filter ('all' means no filter)
 * @param {string}  opts.sortBy        - 'newest' | 'price_asc' | 'price_desc'
 * @param {string}  opts.searchQuery   - ilike filter on title
 * @param {boolean} opts.favoritesOnly - only show listings saved by `userId`
 * @param {string}  opts.userId        - current user's id (needed for favoritesOnly)
 * @param {string}  opts.sellerId      - only show listings from this seller (UserProfile)
 */
export function useListings({
  category = 'all',
  sortBy = 'newest',
  searchQuery = '',
  favoritesOnly = false,
  userId = null,
  sellerId = null,
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
  }, [school?.id, category, sortBy, searchQuery, favoritesOnly, userId, sellerId])

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
        .select('*, profiles!seller_id(name, score, verified, grade, contact, contact_type, sold_count)')
        .eq('school_id', school.id)
        .eq('sold', false)

      if (category && category !== 'all') {
        query = query.eq('category', category)
      }

      if (searchQuery.trim()) {
        query = query.ilike('title', `%${searchQuery.trim()}%`)
      }

      if (favoriteIds) {
        query = query.in('id', favoriteIds)
      }

      if (sellerId) {
        query = query.eq('seller_id', sellerId)
      }

      // Boosted listings always appear first, then sorted by user's choice
      query = query.order('boosted', { ascending: false })

      if (sortBy === 'price_asc') {
        query = query.order('price', { ascending: true, nullsFirst: false })
      } else if (sortBy === 'price_desc') {
        query = query.order('price', { ascending: false, nullsFirst: false })
      } else {
        // default: newest first
        query = query.order('created_at', { ascending: false })
      }

      const { data, error: qErr } = await query
      if (qErr) throw qErr
      setListings(data ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { listings, loading, error, refetch: fetchListings }
}
