import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { notifyUser } from '../../shared/eventBookings.ts';

// The seller reports that the winning bidder has not paid by the published
// deadline. Records the report on the transaction and opens a non-payment
// dispute for admin review. No automatic penalty or charge is applied — the
// matter follows the published auction rules, resolved by resolveNonPayment.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { transaction_id, notes } = body || {};
    if (!transaction_id) return Response.json({ error: 'transaction_id is required.' }, { status: 400 });
    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(transaction_id);
    if (!tx) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    if (tx.seller_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Only the seller may report non-payment.' }, { status: 403 });
    if (tx.status !== 'pending_payment') return Response.json({ error: 'Non-payment can only be reported while the order is awaiting payment.' }, { status: 400 });
    if (user.role !== 'admin' && tx.payment_deadline && new Date(tx.payment_deadline).getTime() > Date.now()) {
      return Response.json({ error: 'The payment deadline has not passed yet.', payment_deadline: tx.payment_deadline }, { status: 400 });
    }
    if (tx.non_payment_reported) return Response.json({ error: 'Non-payment has already been reported for this transaction.' }, { status: 400 });

    await base44.asServiceRole.entities.CompletedTransaction.update(transaction_id, {
      non_payment_reported: true, non_payment_status: 'reported'
    });
    const dispute = await base44.asServiceRole.entities.Dispute.create({
      transaction_id, auction_id: tx.auction_id,
      filed_by: user.id, buyer_id: tx.buyer_id, seller_id: tx.seller_id,
      subject: 'Non-payment by winning bidder',
      description: notes || 'The winning bidder has not paid by the published deadline.',
      dispute_type: 'non_payment', status: 'open', evidence: []
    });

    await notifyUser(base44.asServiceRole, tx.buyer_id, {
      type: 'non_payment_reported', title: 'Payment overdue',
      body: `The seller has reported that payment has not been received for your purchase. Please complete payment or contact the seller. No automatic penalty has been applied.`,
      link: `/transactions/${transaction_id}`
    });
    return Response.json({ success: true, dispute_id: dispute.id, non_payment_status: 'reported' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}