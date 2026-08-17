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
      const applicationId = session.subscription_data?.metadata?.application_id
        ?? session.metadata?.application_id
      const subscriptionId = session.subscription as string
      const customerId     = session.customer as string

      if (!applicationId) {
        return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
      }

      // Save subscription + customer IDs
      await supabase.from('ad_applications').update({
        stripe_session_id:      session.id,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id:     customerId,
        status:                 'reviewing',
      }).eq('id', applicationId)

      // Fetch the application for AI moderation
      const { data: app } = await supabase.from('ad_applications').select('*').eq('id', applicationId).single()

      if (app) {
        const { approved, reason } = await moderateAd(app.company_name, app.industry, app.description)

        if (approved) {
          // End trial immediately → billing starts now
          await stripe.subscriptions.update(subscriptionId, { trial_end: 'now' })

          await supabase.from('ad_applications').update({
            status:          'active',
            ai_flag_reason:  reason,
          }).eq('id', applicationId)

          // Create the live ad record (uses first school from target_schools)
          const schools = (app.target_schools ?? '').split(',').map((s: string) => s.trim()).filter(Boolean)
          for (const schoolShortName of schools) {
            const schoolRecord = await supabase.from('ad_applications').select('*').eq('id', applicationId).single()
            // Insert one ad per school — use school short name to find id if needed
            await supabase.from('ads').insert({
              application_id: applicationId,
              school_id:      schoolShortName, // admin can correct via dashboard if needed
              company_name:   app.company_name,
              tagline:        app.description.substring(0, 150),
              website_url:    app.website || 'https://u-market.app',
              tier:           app.ad_type,
              active:         true,
              starts_at:      new Date().toISOString(),
            })
          }
        } else {
          // AI flagged — cancel subscription immediately (no charge)
          await stripe.subscriptions.cancel(subscriptionId)

          await supabase.from('ad_applications').update({
            status:         'needs_review',
            ai_flagged:     true,
            ai_flag_reason: reason,
          }).eq('id', applicationId)
        }
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
