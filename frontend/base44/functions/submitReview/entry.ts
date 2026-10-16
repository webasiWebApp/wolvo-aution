import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// A buyer or seller leaves a review after a COMPLETED transaction. Enforces
// eligibility: the reviewer must be a party to the transaction, the reviewee
// is the other party (never the reviewer's own account), the transaction must
// be completed, and only one review per reviewer per transaction is allowed.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { transaction_id, rating, comment } = body || {};
    if (!transaction_id || !Number.isFinite(Number(rating))) return Response.json({ error: 'transaction_id and rating are required.' }, { status: 400 });
    const r = Number(rating);
    if (r < 1 || r > 5) return Response.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(transaction_id);
    if (!tx) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    if (tx.status !== 'completed') return Response.json({ error: 'Reviews are only available for completed transactions.' }, { status: 400 });

    let reviewee_id = null;
    if (tx.buyer_id === user.id) reviewee_id = tx.seller_id;
    else if (tx.seller_id === user.id) reviewee_id = tx.buyer_id;
    else return Response.json({ error: 'Only the buyer or seller of this transaction may review it.' }, { status: 403 });
    if (!reviewee_id) return Response.json({ error: 'There is no reviewable party for this transaction.' }, { status: 400 });
    if (reviewee_id === user.id) return Response.json({ error: 'You cannot review your own account.' }, { status: 400 });

    const existPage = await base44.asServiceRole.entities.Review.filter({ transaction_id, reviewer_id: user.id }, { limit: 1 });
    if ((existPage.items || [])[0]) return Response.json({ error: 'You have already reviewed this transaction.' }, { status: 409 });

    const review = await base44.entities.Review.create({
      auction_id: tx.auction_id, transaction_id,
      reviewer_id: user.id, reviewee_id,
      rating: r, comment: comment || '',
      status: 'published', flagged: false, flag_status: 'none'
    });
    return Response.json({ review });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}