import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/email.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

const TIER_PRICES: Record<string, number> = { base: 1000, pinned: 1750, premium: 2750 }
const TIER_LABELS: Record<string, string> = { base: 'Base Rotating', pinned: 'Pinned Top', premium: 'Premium Full-Width' }

function calcPrice(tier: string, numSchools: number): number {
  const base = TIER_PRICES[tier] ?? 1000
  return Math.round(base * (1 + 0.5 * (numSchools - 1)))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const {
      contact_name, company_name, email, phone, website,
      industry, tier, description, target_schools, notes, account_type,
    } = body

    if (!tier || !description || !target_schools?.length || !email || !company_name) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const numSchools  = target_schools.length
    const weeklyPrice = calcPrice(tier, numSchools)
    const schoolStr   = Array.isArray(target_schools) ? target_schools.join(', ') : String(target_schools)

    // All form data stored in Stripe metadata — the DB record is created in the
    // webhook only after checkout.session.completed fires, so failed/declined
    // cards never create an application record.
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      line_items: [{
        price_data: {
          currency:    'usd',
          unit_amount: weeklyPrice,
          recurring:   { interval: 'week' },
          product_data: {
            name:        `UMarket ${TIER_LABELS[tier] ?? tier} Ad`,
            description: `${numSchools} school${numSchools > 1 ? 's' : ''} · Founding advertiser rate`,
          },
        },
        quantity: 1,
      }],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          contact_name:   (contact_name ?? '').substring(0, 200),
          company_name:   (company_name ?? '').substring(0, 200),
          email:          (email        ?? '').substring(0, 200),
          phone:          (phone        ?? '').substring(0, 50),
          website:        (website      ?? '').substring(0, 300),
          industry:       (industry     ?? '').substring(0, 100),
          tier,
          target_schools: schoolStr.substring(0, 400),
          description:    (description  ?? '').substring(0, 450),
          notes:          (notes        ?? '').substring(0, 300),
          budget_range:   `$${(weeklyPrice / 100).toFixed(2)}/week`,
          account_type:   account_type ?? 'other',
        },
      },
      success_url: 'https://u-market.app/?ad_status=review',
      cancel_url:  'https://u-market.app/?ad_status=cancelled',
    })

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
