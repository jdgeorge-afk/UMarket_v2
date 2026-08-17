import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useSchool } from '../context/SchoolContext'

export function useAds() {
  const { school } = useSchool()
  const [baseAds, setBaseAds]     = useState([])
  const [pinnedAd, setPinnedAd]   = useState(null)
  const [premiumAd, setPremiumAd] = useState(null)

  useEffect(() => {
    if (!school?.id) return
    const now = new Date().toISOString()
    supabase
      .from('ads')
      .select('*')
      .eq('school_id', school.id)
      .eq('active', true)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .then(({ data }) => {
        const ads = data ?? []
        setBaseAds(ads.filter((a) => a.tier === 'base'))
        setPinnedAd(ads.find((a) => a.tier === 'pinned') ?? null)
        setPremiumAd(ads.find((a) => a.tier === 'premium') ?? null)
      })
  }, [school?.id])

  return { baseAds, pinnedAd, premiumAd }
}
