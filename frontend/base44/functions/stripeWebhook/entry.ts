import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { auditPayment, markStripePaid } from '../../shared/payments.ts';

// Stripe webhook receiver for Wolvo.
// Verifies the Stripe-Signature header with the STRIPE_WEBHOOK_SECRET, then
// reconciles the event against the corresponding Payment / CompletedTransaction
// records using the service role (webhooks carry no user auth).
//
// Contract with the Stripe PaymentIntent creator: our internal
// payment_reference (WOLVO-XXXX) is attached as metadata.payment_reference on
// every PaymentIntent, and the PaymentIntent id (pi_...) is stored on the
// Payment as provider_reference. The webhook resolves the record by either.

const TOLERANCE_SECONDS = 300;

async function verifyStripeSignature(payload, sigHeader, secret) {
  if (!secret) throw new Error('Webhook signing secret is not configured (STRIPE_WEBHOOK_SECRET).');
  if (!sigHeader) throw new Error('Missing Stripe-Signature header.');
  const parts = sigHeader.split(',').map((s) => s.trim());
  let timestamp = null;
  const signatures = [];
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx < 0) continue;
    const k = p.slice(0, idx);
    const v = p.slice(idx + 1);
    if (k === 't') timestamp = v;
    else if (k === 'v1') signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) throw new Error('Malformed signature header.');
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > TOLERANCE_SECONDS) throw new Error('Timestamp outside tolerance.');

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  let valid = false;
  for (const s of signatures) {
    if (s.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff === 0) { valid = true; break; }
  }
  if (!valid) throw new Error('Signature verification failed.');
}

async function findPayment(base44, reference, providerRef) {
  if (reference) {
    const p1 = await base44.asServiceRole.entities.Payment.filter({ payment_reference: reference }, { limit: 1 });
    if ((p1.items || [])[0]) return p1.items[0];
  }
  if (providerRef) {
    const p2 = await base44.asServiceRole.entities.Payment.filter({ provider_reference: providerRef }, { limit: 1 });
    if ((p2.items || [])[0]) return p2.items[0];
  }
  return null;
}

// markPaid / notifyParties moved to shared/payments.ts (markStripePaid) so the
// checkout poll can finalise an order from the authoritative PaymentIntent
// status without depending on webhook delivery.

async function markFailed(base44, payment, pi) {
  if (!payment) return 'no_payment';
  if (['paid', 'refunded', 'partially_refunded'].includes(payment.status)) return 'already_paid';
  const reason = (pi.last_payment_error && pi.last_payment_error.message) || 'Payment failed.';
  await base44.asServiceRole.entities.Payment.update(payment.id, {
    status: 'failed',
    failure_reason: reason,
    provider: 'stripe',
    provider_reference: pi.id
  });
  await auditPayment(base44.asServiceRole, {
    payment_id: payment.id,
    action: 'stripe_payment_failed',
    details: `Stripe PaymentIntent ${pi.id} failed: ${reason}`,
    severity: 'warning'
  });
  return 'marked_failed';
}

async function applyRefund(base44, payment, charge) {
  if (!payment) return 'no_payment';
  const refundedCents = charge.amount_refunded || 0;
  // Durable idempotency: a duplicate charge.refunded delivery carries the same
  // cumulative amount_refunded. If we have already recorded that amount (or
  // more) on the payment, skip the write and the audit entry entirely so a
  // duplicate can never apply a refund twice.
  const alreadyRecordedCents = Math.round((payment.refunded_amount || 0) * 100);
  if (
    refundedCents > 0 &&
    refundedCents <= alreadyRecordedCents &&
    payment.refund_status &&
    payment.refund_status !== 'none'
  ) {
    return 'already_refunded';
  }
  const totalCents = charge.amount || Math.round(payment.amount * 100);
  const full = refundedCents >= totalCents;
  const newStatus = full ? 'refunded' : 'partially_refunded';
  const refundStatus = full ? 'refunded' : 'partial';
  await base44.asServiceRole.entities.Payment.update(payment.id, {
    status: newStatus,
    refund_status: refundStatus,
    refunded_amount: refundedCents / 100
  });
  await auditPayment(base44.asServiceRole, {
    payment_id: payment.id,
    action: 'stripe_refund_processed',
    details: `${full ? 'Full' : 'Partial'} refund of $${refundedCents / 100} processed via Stripe.`,
    severity: 'warning'
  });
  return 'refund_applied';
}

async function markCanceled(base44, payment, pi) {
  if (!payment) return 'no_payment';
  // Never overwrite a completed payment or an existing refund.
  if (['paid', 'refunded', 'partially_refunded'].includes(payment.status)) return 'already_terminal';
  // Only the payment attempt is canceled. The order itself stays open: an
  // intent can be canceled for many reasons (abandoned checkout, a replaced
  // intent), and the buyer must still be able to retry before the deadline.
  // Cancelling the sale is an admin decision (resolveNonPayment).
  await base44.asServiceRole.entities.Payment.update(payment.id, {
    status: 'canceled',
    provider: 'stripe',
    provider_reference: pi.id,
    failure_reason: pi.cancellation_reason || 'Payment canceled.'
  });
  await auditPayment(base44.asServiceRole, {
    payment_id: payment.id,
    action: 'stripe_payment_canceled',
    details: `Stripe PaymentIntent ${pi.id} canceled. Reason: ${pi.cancellation_reason || 'unknown'}.`,
    severity: 'warning'
  });
  return 'marked_canceled';
}

async function recordDispute(base44, payment, dispute, phase) {
  const amount = (dispute.amount || 0) / 100;
  const status = dispute.status || 'unknown';
  const reason = dispute.reason || 'unknown';
  const action = phase === 'closed' ? 'stripe_dispute_closed' : 'stripe_dispute_updated';
  const detail = phase === 'closed'
    ? `Dispute ${dispute.id} closed. Outcome: ${dispute.outcome || status}. Reason: ${reason}. Amount: $${amount}.`
    : `Dispute ${dispute.id} updated. Status: ${status}. Reason: ${reason}. Amount: $${amount}.`;
  await auditPayment(base44.asServiceRole, {
    payment_id: payment ? payment.id : '',
    action,
    details: detail,
    severity: phase === 'closed' ? 'critical' : 'warning'
  });
  return phase === 'closed' ? 'dispute_closed' : 'dispute_updated';
}

async function processEvent(base44, type, obj) {
  if (!obj) return 'no_object';
  let reference = null;
  let providerRef = null;
  if (type.startsWith('payment_intent.')) {
    reference = (obj.metadata && obj.metadata.payment_reference) || null;
    providerRef = obj.id || null;
  } else if (type.startsWith('charge.')) {
    reference = (obj.metadata && obj.metadata.payment_reference) || null;
    providerRef = obj.payment_intent || null;
  }
  const payment = await findPayment(base44, reference, providerRef);

  switch (type) {
    case 'payment_intent.succeeded':
      return await markStripePaid(base44.asServiceRole, payment, obj);
    case 'payment_intent.payment_failed':
      return await markFailed(base44, payment, obj);
    case 'charge.refunded':
      return await applyRefund(base44, payment, obj);
    case 'payment_intent.canceled':
      return await markCanceled(base44, payment, obj);
    case 'charge.dispute.created':
      await auditPayment(base44.asServiceRole, {
        payment_id: payment ? payment.id : '',
        action: 'stripe_dispute_opened',
        details: `Dispute ${obj.id} opened for $${(obj.amount || 0) / 100}. Reason: ${obj.reason || 'unknown'}.`,
        severity: 'critical'
      });
      return 'dispute_logged';
    case 'charge.dispute.updated':
      return await recordDispute(base44, payment, obj, 'updated');
    case 'charge.dispute.closed':
      return await recordDispute(base44, payment, obj, 'closed');
    default:
      return 'ignored';
  }
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    if (req.method === 'GET') {
      return Response.json({ ok: true, service: 'stripe-webhook' });
    }
    const payload = await req.text();
    const sigHeader = req.headers.get('stripe-signature') || '';
    const secret = secrets.get('STRIPE_WEBHOOK_SECRET');
    let event;
    try {
      await verifyStripeSignature(payload, sigHeader, secret);
      event = JSON.parse(payload);
    } catch (e) {
      return Response.json({ error: 'Invalid signature: ' + e.message }, { status: 400 });
    }
    const type = event.type;
    const obj = event.data && event.data.object;
    const handled = await processEvent(base44, type, obj);
    return Response.json({ received: true, type, handled });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}