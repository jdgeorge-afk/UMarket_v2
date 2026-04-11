import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

/**
 * Manages the current user's favorite listings.
 * Uses a Set for O(1) lookups when rendering many cards.
 */
export function useFavorites() {
  const { user } = useAuth()
  const [favorites, setFavorites] = useState(new Set())
  const [loadingFavs, setLoadingFavs] = useState(false)

  const fetchFavorites = useCallback(async () => {
    if (!user) return
    setLoadingFavs(true)
    const { data } = await supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id)
    setFavorites(new Set((data ?? []).map((f) => f.listing_id)))
    setLoadingFavs(false)
  }, [user])

  useEffect(() => {
    if (!user) {
      setFavorites(new Set())
      return
    }
    fetchFavorites()
  }, [user, fetchFavorites])

  const isFavorited = useCallback((listingId) => favorites.has(listingId), [favorites])

  const toggleFavorite = useCallback(
    async (listingId) => {
      if (!user) return false
      const alreadyFaved = favorites.has(listingId)

      // Optimistic update — UI responds immediately
      setFavorites((prev) => {
        const next = new Set(prev)
        alreadyFaved ? next.delete(listingId) : next.add(listingId)
        return next
      })

      if (alreadyFaved) {
        await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId)
      } else {
        await supabase
          .from('favorites')
          .insert({ user_id: user.id, listing_id: listingId })
        // Notify seller (fire-and-forget — never block the UI)
        supabase.functions.invoke('notify-saved', {
          body: { listing_id: listingId },
        }).catch(() => {})
      }

      return !alreadyFaved
    },
    [user, favorites]
  )

  return { favorites, isFavorited, toggleFavorite, loadingFavs }
}
