import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/email.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const TIER_FULL: Record<string, number> = { base: 2000, pinned: 3500, premium: 5500 }

// End the trial immediately and create a Stripe Subscription Schedule that
// automatically transitions from the founding 50%-off rate to full price
// after exactly 2 billing weeks.
async function approveAndSchedule(subscriptionId: string, tier: string, targetSchools: string) {
  const numSchools = targetSchools.split(',').filter((s: string) => s.trim()).length || 1
  const fullPriceCents = Math.round((TIER_FULL[tier] ?? 2000) * (1 + 0.5 * (numSchools - 1)))
  const twoWeeksFromNow = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60

  // End the free-review trial — this creates the first invoice immediately
  const sub = await stripe.subscriptions.update(subscriptionId, { trial_end: 'now' })
  const currentPriceId = sub.items.data[0]?.price?.id
  if (!currentPriceId) return

  // Convert to a subscription schedule with two phases:
  //   Phase 1 — discounted founding rate for 2 weeks
  //   Phase 2 — full rate ongoing (schedule releases back to a normal subscription)
  try {
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscriptionId,
    })
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: 'release',
      phases: [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          end_date: twoWeeksFromNow,
        },
        {
          items: [{
            price_data: {
              currency:     'usd',
              unit_amount:  fullPriceCents,
              recurring:    { interval: 'week' },
              product_data: { name: 'UMarket Ad — Full Rate' },
            },
          }],
        },
      ],
    })
  } catch (err) {
    // Log but don't block approval — ad still goes live at the discounted rate
    console.error('Subscription schedule creation failed:', err.message)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(jwt ?? '')
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return new Response(JSON.stringify({ error: 'Admin only' }), { status: 403, headers: corsHeaders })

    const { application_id, action } = await req.json()

    const { data: app } = await supabase.from('ad_applications').select('*').eq('id', application_id).single()
    if (!app) return new Response(JSON.stringify({ error: 'Application not found' }), { status: 404, headers: corsHeaders })

    const subscriptionId = app.stripe_subscription_id

    if (action === 'approve') {
      if (subscriptionId) {
        await approveAndSchedule(subscriptionId, app.ad_type, app.target_schools ?? '')
      }
      await supabase.from('ad_applications').update({ status: 'active' }).eq('id', application_id)

      const schools = (app.target_schools ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
      for (const schoolId of schools) {
        await supabase.from('ads').insert({
          application_id,
          school_id:    schoolId,
          company_name: app.company_name,
          tagline:      (app.description ?? '').substring(0, 150),
          website_url:  app.website || 'https://u-market.app',
          tier:         app.ad_type,
          active:       true,
          starts_at:    new Date().toISOString(),
        })
      }
    } else if (action === 'reject') {
      if (subscriptionId) {
        await stripe.subscriptions.cancel(subscriptionId)
      }
      await supabase.from('ad_applications').update({ status: 'rejected' }).eq('id', application_id)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
