import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isStaff, canOperateAuction } from '../../shared/access.ts';
import { notifyUser } from '../../shared/eventBookings.ts';
import { auditPayment, MANUAL_METHODS, SETTLED_STATUSES } from '../../shared/payments.ts';

// Manually records a payment for a completed-auction transaction. This is the
// provider-agnostic status update: NO card details are stored, no wallet holds
// funds, and no automatic charge is made. Only manual methods can be recorded
// here — card/PayPal payments are confirmed by their provider. The order's
// existing Payment record is reused so a transaction never ends up with two
// payment records. The transaction moves to 'paid' so collection can be booked.
// Admins or the assigned auctioneer may record.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isStaff(user)) return Response.json({ error: 'Only authorised sellers or staff may record payment.' }, { status: 403 });

    const body = await req.json();
    const { transaction_id, reference } = body || {};
    const method = (body && body.method) || 'manual';
    if (!transaction_id) return Response.json({ error: 'transaction_id is required.' }, { status: 400 });
    if (!MANUAL_METHODS.includes(method)) return Response.json({ error: 'Only manual payments (PayID, bank transfer, manual) can be recorded here.' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(transaction_id);
    if (!tx) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    if (user.role === 'auctioneer') {
      const auction = await base44.asServiceRole.entities.Auction.get(tx.auction_id).catch(() => null);
      if (!canOperateAuction(user, auction)) return Response.json({ error: 'You are not the assigned auctioneer.' }, { status: 403 });
    }
    if (tx.status === 'completed') return Response.json({ error: 'This transaction is already completed.' }, { status: 400 });
    if (tx.status === 'cancelled') return Response.json({ error: 'This transaction was cancelled.' }, { status: 400 });
    if (['paid', 'ready_for_collection'].includes(tx.status)) return Response.json({ error: 'Payment has already been recorded for this transaction.' }, { status: 400 });

    const pPage = await base44.asServiceRole.entities.Payment.filter({ transaction_id }, { sort: '-created_date', limit: 1 });
    const existing = (pPage.items || [])[0];
    if (existing && SETTLED_STATUSES.includes(existing.status)) {
      return Response.json({ error: 'A payment is already in progress or completed for this transaction.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const paymentReference = (existing && existing.payment_reference) || reference || ('WOLVO-' + transaction_id.slice(-6).toUpperCase());
    const paidFields = {
      payment_method: method, status: 'paid', provider: 'manual',
      provider_reference: reference || method,
      paid_at: now, confirmed_by: user.id, confirmed_at: now, failure_reason: ''
    };
    let payment;
    if (existing) {
      payment = existing;
      await base44.asServiceRole.entities.Payment.update(existing.id, paidFields);
    } else {
      payment = await base44.asServiceRole.entities.Payment.create({
        auction_id: tx.auction_id, transaction_id,
        user_id: tx.buyer_id, amount: tx.total || tx.final_price || 0,
        currency: 'AUD', payment_reference: paymentReference, customer_reference: paymentReference,
        description: 'Manually recorded payment (no card details stored).',
        ...paidFields
      });
    }
    await base44.asServiceRole.entities.CompletedTransaction.update(transaction_id, {
      status: 'paid', payment_method: method, payment_reference: paymentReference
    });
    await auditPayment(base44.asServiceRole, {
      payment_id: payment.id, action: 'manual_payment_recorded',
      actor_id: user.id, actor_email: user.email || '',
      details: `Manual ${method} payment recorded by ${user.email || user.id}.`, severity: 'warning'
    });

    await notifyUser(base44.asServiceRole, tx.buyer_id, {
      type: 'payment_recorded', title: 'Payment recorded',
      body: `Payment for your purchase has been recorded. You can now book a collection slot.`,
      link: `/transactions/${transaction_id}`
    });
    if (tx.seller_id) await notifyUser(base44.asServiceRole, tx.seller_id, {
      type: 'payment_recorded', title: 'Payment recorded',
      body: `Payment has been recorded for your sale. The buyer can now book collection.`,
      link: `/transactions/${transaction_id}`
    });
    return Response.json({ success: true, status: 'paid' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
