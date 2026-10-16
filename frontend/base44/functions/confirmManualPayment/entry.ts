import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isStaff, canOperateAuction } from '../../shared/access.ts';
import { notifyUser } from '../../shared/eventBookings.ts';
import { auditPayment, STATUS_LABEL, MANUAL_METHODS } from '../../shared/payments.ts';

// An authorised seller (admin) or the assigned auctioneer confirms that funds
// have ACTUALLY arrived for a manual (PayID / bank transfer) payment. This is
// the ONLY way a manual payment becomes Paid — an uploaded receipt or buyer
// message never marks it paid. Records who confirmed and when, audits it, and
// moves the transaction to 'paid' so collection can be booked.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isStaff(user)) return Response.json({ error: 'Only authorised sellers or staff may confirm receipt of funds.' }, { status: 403 });

    const body = await req.json();
    const { payment_id } = body || {};
    if (!payment_id) return Response.json({ error: 'payment_id is required.' }, { status: 400 });

    const payment = await base44.asServiceRole.entities.Payment.get(payment_id);
    if (!payment) return Response.json({ error: 'Payment record not found.' }, { status: 404 });
    if (!MANUAL_METHODS.includes(payment.payment_method)) return Response.json({ error: 'Use the provider flow to confirm online payments.' }, { status: 400 });
    if (payment.status === 'paid') return Response.json({ error: 'This payment is already confirmed.' }, { status: 400 });
    if (['refunded', 'partially_refunded'].includes(payment.status)) return Response.json({ error: 'This payment has been refunded.' }, { status: 400 });

    if (user.role === 'auctioneer') {
      const auction = await base44.asServiceRole.entities.Auction.get(payment.auction_id).catch(() => null);
      if (!canOperateAuction(user, auction)) return Response.json({ error: 'You are not the assigned auctioneer.' }, { status: 403 });
    }

    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(payment.transaction_id).catch(() => null);
    if (tx && tx.status === 'cancelled') return Response.json({ error: 'This transaction was cancelled.' }, { status: 400 });

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Payment.update(payment_id, { status: 'paid', paid_at: now, confirmed_by: user.id, confirmed_at: now });
    if (tx) await base44.asServiceRole.entities.CompletedTransaction.update(payment.transaction_id, { status: 'paid' });
    await auditPayment(base44.asServiceRole, { payment_id, action: 'manual_payment_confirmed', actor_id: user.id, actor_email: user.email || '', details: `Manual ${payment.payment_method} payment of $${payment.amount} confirmed received by ${user.email || user.id}.`, severity: 'warning' });

    if (tx) {
      await notifyUser(base44.asServiceRole, tx.buyer_id, { type: 'payment_confirmed', title: 'Payment confirmed', body: 'Your payment has been confirmed. You can now book a collection slot.', link: `/transactions/${tx.id}` });
      if (tx.seller_id) await notifyUser(base44.asServiceRole, tx.seller_id, { type: 'payment_confirmed', title: 'Payment confirmed', body: 'You confirmed receipt of payment for your sale.', link: `/transactions/${tx.id}` });
    }
    return Response.json({ success: true, status: 'paid', status_label: STATUS_LABEL['paid'] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}