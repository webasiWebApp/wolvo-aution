import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { getConfig, generateReference, auditPayment, markStripePaid, evaluateStripePaymentGate, buyerOwnsOrder, payableAmount, SETTLED_STATUSES } from '../../shared/payments.ts';

// Creates a Stripe PaymentIntent for a winning bidder's order. The payable
// amount is ALWAYS read from the database (tx.total || tx.final_price) and
// never from the request, so the buyer cannot alter it. The caller must be the
// order's buyer (or an admin), the auction must be closed, and the order must
// be awaiting payment. An active intent for the same order is reused so repeat
// requests never create duplicate PaymentIntents. The Stripe secret key never
// leaves the server; only the client_secret (safe for the browser) plus the
// publishable key are returned.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to pay by card.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const txId = body && body.transaction_id;
    if (!txId) return Response.json({ error: 'transaction_id is required.' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(txId).catch(() => null);
    if (!tx) return Response.json({ error: 'Order not found.' }, { status: 404 });
    if (!buyerOwnsOrder(tx, user)) return Response.json({ error: 'You are not authorised to pay for this order.' }, { status: 403 });
    // Allow 'paid' through so an already-paid order (e.g. a page refresh after
    // success, or a 3D-Secure redirect that captured funds) surfaces the paid
    // state below instead of a generic "not awaiting payment" error.
    if (tx.status !== 'pending_payment' && tx.status !== 'paid') return Response.json({ error: 'This order is not awaiting payment.' }, { status: 400 });

    // The CompletedTransaction only exists once closeAuction ran (auction
    // closed + reserve met). Confirm the auction is closed all the same.
    const auction = await base44.asServiceRole.entities.Auction.get(tx.auction_id).catch(() => null);
    if (!auction || auction.status !== 'closed') return Response.json({ error: 'Auction has not closed.' }, { status: 400 });

    const config = await getConfig(base44.asServiceRole);
    const secretKey = secrets.get('STRIPE_SECRET_KEY');
    const publishableKey = secrets.get('STRIPE_PUBLISHABLE_KEY');
    // Single server-side gate: stripe_enabled, live_payments_enabled (live mode),
    // and credential/mode consistency (test keys for test mode, live keys for
    // live mode). No client-supplied setting can bypass it; secret material is
    // never returned. See shared/payments.ts → evaluateStripePaymentGate.
    const gate = evaluateStripePaymentGate(config, secretKey, publishableKey);
    if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.status });

    const amount = payableAmount(tx);
    if (!amount || amount <= 0) return Response.json({ error: 'No payable amount for this order.' }, { status: 400 });

    // One Payment record per transaction (getPaymentCheckout / selectPaymentMethod).
    const pPage = await base44.asServiceRole.entities.Payment.filter({ transaction_id: txId }, { sort: '-created_date', limit: 1 });
    let payment = (pPage.items || [])[0];

    // If the order is already paid (by card or confirmed manually), surface that
    // so the checkout shows success instead of re-rendering the card form (e.g.
    // after a refresh or a 3D-Secure redirect that already captured the funds).
    // Checking the transaction too means a manually confirmed order can never
    // be charged a second time by card.
    if (tx.status === 'paid' || (payment && payment.status === 'paid')) {
      return Response.json({
        already_paid: true, status: 'paid',
        amount, currency: 'aud', mode: gate.mode,
        reference: (payment && payment.payment_reference) || tx.payment_reference || '', publishable_key: publishableKey
      });
    }
    // An in-progress / refunded payment cannot accept a new card charge.
    if (payment && SETTLED_STATUSES.includes(payment.status)) {
      return Response.json({ error: 'Payment is already in progress or completed.' }, { status: 400 });
    }

    const ref = (payment && payment.payment_reference) || generateReference();
    const stripeHeaders = { Authorization: `Bearer ${secretKey}` };

    // Reuse an active intent already stored for this order (prevents duplicates).
    if (payment && payment.provider_reference && payment.client_secret) {
      const retrieved = await fetch(`https://api.stripe.com/v1/payment_intents/${payment.provider_reference}`, {
        headers: stripeHeaders, signal: AbortSignal.timeout(10000)
      });
      if (retrieved.ok) {
        const intent = await retrieved.json();
        if (intent.status === 'succeeded') {
          // The intent already captured funds (e.g. after a 3D-Secure redirect
          // or a delayed webhook). Reconcile the order paid instead of creating
          // a duplicate intent.
          await markStripePaid(base44.asServiceRole, payment, intent);
          return Response.json({
            already_paid: true, status: 'paid',
            amount, currency: 'aud', mode: gate.mode, reference: ref, publishable_key: publishableKey
          });
        }
        if (intent.status !== 'canceled') {
          await base44.asServiceRole.entities.Payment.update(payment.id, {
            payment_method: 'stripe', provider: 'stripe', provider_reference: intent.id,
            client_secret: intent.client_secret, status: 'awaiting_payment', failure_reason: ''
          });
          await base44.asServiceRole.entities.CompletedTransaction.update(txId, { payment_method: 'stripe' });
          return Response.json({
            client_secret: intent.client_secret, payment_intent_id: intent.id,
            amount, currency: 'aud', mode: gate.mode, status: intent.status, reference: ref, publishable_key: publishableKey
          });
        }
      }
    }

    // Create a new PaymentIntent. Stable idempotency key per order for the
    // first creation; a fresh key only when recreating after a canceled intent.
    const idempKey = payment && payment.provider_reference
      ? `wolvo_pi_${txId}_${Date.now()}`
      : `wolvo_pi_${txId}`;

    const form = new URLSearchParams();
    form.append('amount', String(Math.round(amount * 100)));
    form.append('currency', 'aud');
    form.append('description', `Wolvo order ${ref}`);
    form.append('metadata[payment_reference]', ref);
    form.append('metadata[transaction_id]', txId);
    form.append('metadata[buyer_id]', tx.buyer_id);
    form.append('automatic_payment_methods[enabled]', 'true');

    const created = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: { ...stripeHeaders, 'Idempotency-Key': idempKey },
      body: form,
      signal: AbortSignal.timeout(15000)
    });
    const intent = await created.json();
    if (!created.ok) {
      return Response.json({ error: (intent.error && intent.error.message) || 'Could not create a card payment.' }, { status: 502 });
    }

    // Persist the intent against the payment record.
    const deadline = tx.payment_deadline || new Date(Date.now() + (config.default_payment_deadline_days || 3) * 86400000).toISOString();
    if (!payment) {
      payment = await base44.asServiceRole.entities.Payment.create({
        auction_id: tx.auction_id, transaction_id: txId, user_id: tx.buyer_id,
        amount, currency: 'AUD', payment_method: 'stripe', status: 'awaiting_payment',
        payment_reference: ref, customer_reference: ref, deadline,
        provider: 'stripe', provider_reference: intent.id, client_secret: intent.client_secret,
        description: 'Stripe card payment intent created.'
      });
    } else {
      await base44.asServiceRole.entities.Payment.update(payment.id, {
        payment_method: 'stripe', provider: 'stripe', provider_reference: intent.id,
        client_secret: intent.client_secret, status: 'awaiting_payment', failure_reason: ''
      });
    }
    await base44.asServiceRole.entities.CompletedTransaction.update(txId, { payment_method: 'stripe', payment_reference: ref, payment_deadline: deadline });
    await auditPayment(base44.asServiceRole, {
      payment_id: payment.id, action: 'stripe_payment_intent_created',
      actor_id: user.id, actor_email: user.email || '',
      details: `Stripe PaymentIntent ${intent.id} created for $${amount} (order ${ref}).`,
      severity: 'info'
    });

    return Response.json({
      client_secret: intent.client_secret, payment_intent_id: intent.id,
      amount, currency: 'aud', mode: gate.mode, status: intent.status, reference: ref, publishable_key: publishableKey
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}