import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/email.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const TIER_PRICES: Record<string, number> = { base: 1000, pinned: 1750, premium: 2750 } // cents (50% off founding rate)
const TIER_LABELS: Record<string, string> = { base: 'Base Rotating', pinned: 'Pinned Top', premium: 'Premium Full-Width' }

function calcPrice(tier: string, numSchools: number): number {
  const base = TIER_PRICES[tier] ?? 1000
  return Math.round(base * (1 + 0.5 * (numSchools - 1)))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const body = await req.json()
    const {
      contact_name, company_name, email, phone, website,
      industry, tier, description, target_schools, notes,
    } = body

    if (!tier || !description || !target_schools?.length || !email || !company_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const numSchools = target_schools.length
    const weeklyPrice = calcPrice(tier, numSchools)
    const schoolStr = Array.isArray(target_schools) ? target_schools.join(', ') : target_schools

    // Insert ad application record
    const { data: app, error: insertError } = await supabase.from('ad_applications').insert({
      contact_name,
      company_name,
      email,
      phone:          phone ?? '',
      website:        website ?? '',
      industry,
      ad_type:        tier,
      description,
      budget_range:   `$${(weeklyPrice / 100).toFixed(2)}/week`,
      target_schools: schoolStr,
      notes:          notes ?? '',
      status:         'pending',
    }).select().single()

    if (insertError) throw new Error(insertError.message)

    // Create Stripe Checkout Session (subscription with 1-day trial for AI review)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: weeklyPrice,
          recurring: { interval: 'week' },
          product_data: {
            name: `UMarket ${TIER_LABELS[tier] ?? tier} Ad`,
            description: `${numSchools} school${numSchools > 1 ? 's' : ''} · Founding advertiser rate`,
          },
        },
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: 1,
        metadata: {
          application_id: app.id,
          tier,
          school_count:   String(numSchools),
          company_name,
        },
      },
      success_url: 'https://u-market.app/?ad_status=review',
      cancel_url:  'https://u-market.app/?ad_status=cancelled',
    })

    // Save stripe session id
    await supabase.from('ad_applications').update({
      stripe_session_id: session.id,
    }).eq('id', app.id)

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
