import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { notifyUser } from '../../shared/eventBookings.ts';

// A buyer or seller files a dispute on their transaction. Records the issue,
// the transaction, an optional dispute type, supporting evidence (file URIs),
// status and the parties. Only the two parties (and admins) can ever read it
// (Dispute RLS). The other party is notified.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { transaction_id, subject, description, dispute_type, evidence } = body || {};
    if (!transaction_id || !subject || !description) return Response.json({ error: 'transaction_id, subject and description are required.' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(transaction_id);
    if (!tx) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    if (tx.buyer_id !== user.id && tx.seller_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Only the buyer or seller may file a dispute on this transaction.' }, { status: 403 });

    const dispute = await base44.entities.Dispute.create({
      transaction_id, auction_id: tx.auction_id,
      filed_by: user.id, buyer_id: tx.buyer_id, seller_id: tx.seller_id,
      subject, description, dispute_type: dispute_type || 'other',
      status: 'open', evidence: Array.isArray(evidence) ? evidence : []
    });

    const other = tx.buyer_id === user.id ? tx.seller_id : tx.buyer_id;
    if (other) await notifyUser(base44.asServiceRole, other, {
      type: 'dispute_filed', title: 'A dispute has been filed',
      body: `A dispute has been filed regarding your transaction: ${subject}.`,
      link: `/transactions/${transaction_id}`
    });
    return Response.json({ dispute });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}