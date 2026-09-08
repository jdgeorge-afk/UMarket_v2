import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

async function moderateAd(company: string, industry: string, description: string): Promise<{ approved: boolean; reason: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return { approved: true, reason: 'No AI key configured — auto-approved' }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role:    'user',
          content: `You are a content moderator for a college student marketplace called UMarket. Review this advertisement and determine if it is appropriate.

Approve if: it is family-friendly, legal, honest, and suitable for a general college audience.
Reject if: it involves adult content, illegal products/services, gambling, scams, misleading claims, hate speech, or anything inappropriate for an 18+ college audience.

Company: ${company}
Industry: ${industry}
Ad description: ${description}

Respond with valid JSON only, no explanation outside the JSON:
{"approved": true/false, "reason": "brief reason"}`,
        }],
      }),
    })
    const data = await res.json()
    const text = data.content?.[0]?.text ?? '{}'
    const parsed = JSON.parse(text)
    return { approved: Boolean(parsed.approved), reason: String(parsed.reason ?? '') }
  } catch {
    return { approved: true, reason: 'AI moderation error — auto-approved for manual review' }
  }
}

const TIER_FULL: Record<string, number> = { base: 2000, pinned: 3500, premium: 5500 }

// End the trial immediately and set up a 2-phase schedule:
//   Phase 1 — founding 50%-off rate for 2 weeks
//   Phase 2 — full rate ongoing
async function approveAndSchedule(subscriptionId: string, tier: string, targetSchools: string) {
  const numSchools = targetSchools.split(',').filter((s: string) => s.trim()).length || 1
  const fullPriceCents = Math.round((TIER_FULL[tier] ?? 2000) * (1 + 0.5 * (numSchools - 1)))
  const twoWeeksFromNow = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60

  const sub = await stripe.subscriptions.update(subscriptionId, { trial_end: 'now' })
  const currentPriceId = sub.items.data[0]?.price?.id
  if (!currentPriceId) return

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
    console.error('Schedule creation failed:', err.message)
  }
}

async function activateAdRecords(supabase: any, app: any, applicationId: string) {
  const schools = (app.target_schools ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
  for (const schoolId of schools) {
    await supabase.from('ads').insert({
      application_id: applicationId,
      school_id:      schoolId,
      company_name:   app.company_name,
      tagline:        (app.description ?? '').substring(0, 150),
      website_url:    app.website || 'https://u-market.app',
      tier:           app.ad_type,
      active:         true,
      starts_at:      new Date().toISOString(),
    })
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')
  const body = await req.text()

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
    )
  } catch (err) {
    return new Response(`Webhook verification failed: ${err.message}`, { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── New subscription checkout completed (advertiser self-serve flow) ─────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Legacy one-time payment flow (admin-generated links)
    if (session.mode === 'payment') {
      const applicationId = session.metadata?.application_id
      if (applicationId) {
        await supabase.from('ad_applications').update({
          status:            'paid',
          paid_at:           new Date().toISOString(),
          stripe_session_id: session.id,
        }).eq('id', applicationId)
      }
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
    }

    // New subscription flow
    if (session.mode === 'subscription') {
      const subscriptionId = session.subscription as string
      const customerId     = session.customer as string

      // Fetch subscription to get metadata (stored there, not on session)
      const sub     = await stripe.subscriptions.retrieve(subscriptionId)
      const meta    = sub.metadata ?? {}
      const accountType = meta.account_type ?? 'other'

      // Create the application record now that payment method is confirmed
      const { data: app, error: insertErr } = await supabase.from('ad_applications').insert({
        contact_name:           meta.contact_name ?? '',
        company_name:           meta.company_name ?? '',
        email:                  meta.email ?? '',
        phone:                  meta.phone ?? '',
        website:                meta.website ?? '',
        industry:               meta.industry ?? '',
        ad_type:                meta.tier ?? '',
        description:            meta.description ?? '',
        budget_range:           meta.budget_range ?? '',
        target_schools:         meta.target_schools ?? '',
        notes:                  meta.notes ?? '',
        stripe_session_id:      session.id,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id:     customerId,
        status:                 'reviewing',
      }).select().single()

      if (insertErr || !app) {
        console.error('Failed to insert ad application:', insertErr?.message)
        return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
      }

      const applicationId = app.id

      // Update subscription metadata with the new application_id for future webhooks
      await stripe.subscriptions.update(subscriptionId, {
        metadata: { ...meta, application_id: applicationId },
      })

      if (accountType === 'business') {
        // Business account → AI moderation
        const { approved, reason } = await moderateAd(app.company_name, app.industry, app.description)

        if (approved) {
          await approveAndSchedule(subscriptionId, app.ad_type, app.target_schools ?? '')
          await supabase.from('ad_applications').update({
            status: 'active', ai_flag_reason: reason,
          }).eq('id', applicationId)
          await activateAdRecords(supabase, app, applicationId)
        } else {
          // AI flagged — leave subscription in trial, send to admin for review
          await supabase.from('ad_applications').update({
            status: 'needs_review', ai_flagged: true, ai_flag_reason: reason,
          }).eq('id', applicationId)
        }
      } else {
        // Non-business → manual admin review, leave subscription in trial
        await supabase.from('ad_applications').update({
          status: 'needs_review', ai_flag_reason: 'Manual review required — non-business account',
        }).eq('id', applicationId)
      }
    }
  }

  // ── Subscription cancelled (period ended after cancel_at_period_end) ─────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const applicationId = sub.metadata?.application_id

    if (applicationId) {
      await supabase.from('ad_applications').update({ status: 'cancelled' }).eq('id', applicationId)
      await supabase.from('ads').update({ active: false }).eq('application_id', applicationId)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
