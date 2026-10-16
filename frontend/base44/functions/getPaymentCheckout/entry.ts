import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { getConfig, generateReference, methodEnabled, PAYMENT_METHODS, STATUS_LABEL, markStripePaid } from '../../shared/payments.ts';

// Winner checkout. Returns the authoritative order (exact winning amount +
// deadline), the available payment methods, and the instructions for the
// chosen manual method. Creates exactly ONE Payment record per transaction
// (prevents duplicate orders on repeated requests). The buyer cannot change
// the amount — it is always the auction's final price. The seller may view the
// order status (read-only); payment instructions are only shown to the buyer.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to view checkout.' }, { status: 401 });

    const body = await req.json();
    const txId = body && body.transaction_id;
    if (!txId) return Response.json({ error: 'transaction_id is required.' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(txId);
    if (!tx) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    const isBuyerOrAdmin = tx.buyer_id === user.id || user.role === 'admin';
    if (!isBuyerOrAdmin && tx.seller_id !== user.id) return Response.json({ error: 'Not authorised to view this checkout.' }, { status: 403 });
    if (tx.status === 'cancelled') return Response.json({ error: 'This transaction was cancelled.' }, { status: 400 });

    const config = await getConfig(base44.asServiceRole);
    const amount = tx.total || tx.final_price || 0;
    const deadline = tx.payment_deadline || new Date(Date.now() + (config.default_payment_deadline_days || 3) * 86400000).toISOString();

    // Reuse the existing payment record so repeated requests never duplicate the order.
    const pPage = await base44.asServiceRole.entities.Payment.filter({ transaction_id: txId }, { sort: '-created_date', limit: 1 });
    let payment = (pPage.items || [])[0];
    if (!payment) {
      const ref = generateReference();
      payment = await base44.asServiceRole.entities.Payment.create({
        auction_id: tx.auction_id, transaction_id: txId, user_id: tx.buyer_id,
        amount, currency: 'AUD', payment_method: 'manual', status: 'awaiting_payment',
        payment_reference: ref, customer_reference: ref, deadline,
        description: 'Order generated at auction close.'
      });
    }
    if (!tx.payment_reference) await base44.asServiceRole.entities.CompletedTransaction.update(txId, { payment_reference: payment.payment_reference, payment_deadline: deadline, order_locked: true });

    // Pull-reconcile pending Stripe payments against the authoritative Stripe
    // PaymentIntent, so an order finalises even when webhook delivery is
    // delayed or mis-routed (e.g. a wrong endpoint URL). Best-effort: a Stripe
    // API failure never blocks the checkout fetch. Only awaiting Stripe
    // payments with a stored intent are touched, so manual methods and
    // already-paid orders are unaffected.
    if (payment && payment.payment_method === 'stripe' && payment.provider_reference &&
        payment.status === 'awaiting_payment' && tx.status === 'pending_payment') {
      try {
        const secretKey = secrets.get('STRIPE_SECRET_KEY');
        if (secretKey) {
          const piRes = await fetch(`https://api.stripe.com/v1/payment_intents/${payment.provider_reference}`, {
            headers: { Authorization: `Bearer ${secretKey}` },
            signal: AbortSignal.timeout(8000)
          });
          if (piRes.ok) {
            const pi = await piRes.json();
            if (pi.status === 'succeeded') {
              await markStripePaid(base44.asServiceRole, payment, pi);
              const refreshed = await base44.asServiceRole.entities.Payment.get(payment.id).catch(() => null);
              if (refreshed) payment = refreshed;
            }
          }
        }
      } catch (_) { /* reconcile is best-effort; never block checkout */ }
    }

    const methods = PAYMENT_METHODS.map((m) => ({
      key: m.key, label: m.label, group: m.group,
      enabled: methodEnabled(config, m.key),
      online: m.group === 'online'
    }));

    let instructions = null;
    const pm = payment.payment_method;
    if (isBuyerOrAdmin && pm === 'payid' && config.payid_enabled) {
      instructions = { type: 'payid', alias: config.payid_alias, name: config.payid_name, reference: payment.customer_reference || payment.payment_reference, amount, notes: config.payid_instructions };
    } else if (isBuyerOrAdmin && pm === 'bank_transfer' && config.bank_transfer_enabled) {
      instructions = { type: 'bank_transfer', bank_name: config.bank_name, account_name: config.bank_account_name, bsb: config.bank_bsb, account_number: config.bank_account_number, reference: payment.customer_reference || payment.payment_reference, amount, notes: config.bank_instructions };
    }

    return Response.json({
      order: { transaction_id: txId, amount, deadline, reference: payment.payment_reference, method: payment.payment_method, status: payment.status, status_label: STATUS_LABEL[payment.status] || payment.status },
      methods,
      instructions,
      payment: { id: payment.id, status: payment.status, method: payment.payment_method, confirmed_by: payment.confirmed_by, confirmed_at: payment.confirmed_at, paid_at: payment.paid_at, refund_status: payment.refund_status, refunded_amount: payment.refunded_amount || 0 }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}