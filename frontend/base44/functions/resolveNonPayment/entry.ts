import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { notifyUser } from '../../shared/eventBookings.ts';
import { PAYMENT_DEADLINE_DAYS, COLLECTION_DEADLINE_DAYS } from '../../shared/settleAuction.ts';

// Admin resolves a non-payment report following the published auction rules.
// Actions: cancel (no sale), offer_next (re-award to the next eligible bidder
// that meets the reserve; relists when there is none), relist (return the
// auction to upcoming for the seller to relist), dismiss (keep the transaction
// open). No automatic charge or penalty is ever applied — only an admin
// decision moves the state, and only for an order that is still unpaid.
const DAY_MS = 86400000;

async function relistAuction(svc, tx, auction) {
  // Reset the bidding state so the relisted auction starts fresh; the old bids
  // stay on record as 'lost'.
  await svc.entities.Auction.update(tx.auction_id, {
    status: 'upcoming', winning_bid_id: '', current_highest_bid: 0, bid_count: 0, paused: false
  });
  if (tx.seller_id) await notifyUser(svc, tx.seller_id, {
    type: 'auction_relisted', title: 'Auction returned to upcoming',
    body: `"${auction.title}" was not paid and has been returned to upcoming for relisting, per the auction rules.`,
    link: `/auctions/${tx.auction_id}`
  });
}

async function offerToNextBidder(svc, tx, auction) {
  const reserve = auction.reserve_price || 0;
  const bidPage = await svc.entities.Bid.filter({ auction_id: tx.auction_id, status: 'lost' }, { sort: '-amount', limit: 50 });
  const nextBid = (bidPage.items || []).find((b) => b.bidder_id !== tx.buyer_id && (!reserve || b.amount >= reserve));
  if (!nextBid) return null;

  await svc.entities.Bid.update(nextBid.id, { status: 'won' });
  await svc.entities.Auction.update(tx.auction_id, { winning_bid_id: nextBid.id });
  const fees = tx.fees || 0;
  const commission = tx.commission || 0;
  const now = Date.now();
  const newTx = await svc.entities.CompletedTransaction.create({
    auction_id: tx.auction_id, buyer_id: nextBid.bidder_id, seller_id: tx.seller_id,
    final_price: nextBid.amount, fees, commission,
    total: nextBid.amount + fees + commission,
    winning_bid_id: nextBid.id, winning_bid_amount: nextBid.amount,
    payment_deadline: new Date(now + PAYMENT_DEADLINE_DAYS * DAY_MS).toISOString(),
    collection_deadline: new Date(now + COLLECTION_DEADLINE_DAYS * DAY_MS).toISOString(),
    status: 'pending_payment', non_payment_reported: false, non_payment_status: 'none'
  });
  await notifyUser(svc, nextBid.bidder_id, {
    type: 'transaction_created', title: 'You have been offered this item',
    body: `The previous winner did not complete payment. Your bid of $${nextBid.amount.toLocaleString('en-AU')} for "${auction.title}" has been selected. Please complete payment by the deadline.`,
    link: `/transactions/${newTx.id}`
  });
  return newTx;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Only admins may resolve non-payment reports.' }, { status: 403 });

    const body = await req.json();
    const { transaction_id, action } = body || {};
    if (!transaction_id || !['cancel', 'offer_next', 'relist', 'dismiss'].includes(action)) {
      return Response.json({ error: 'transaction_id and a valid action (cancel/offer_next/relist/dismiss) are required.' }, { status: 400 });
    }
    const svc = base44.asServiceRole;
    const tx = await svc.entities.CompletedTransaction.get(transaction_id);
    if (!tx) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    // A paid or already-closed order is never cancelled here — that would take
    // the item away from a buyer who has paid.
    if (tx.status !== 'pending_payment') return Response.json({ error: 'Only unpaid orders can be resolved for non-payment.' }, { status: 400 });

    if (action === 'dismiss') {
      await svc.entities.CompletedTransaction.update(transaction_id, { non_payment_status: 'resolved_dismissed' });
      return Response.json({ success: true, non_payment_status: 'resolved_dismissed' });
    }

    const auction = await svc.entities.Auction.get(tx.auction_id).catch(() => null);

    // Cancel the current transaction — no charge/penalty — and release the
    // previous winner's bid.
    await svc.entities.CompletedTransaction.update(transaction_id, {
      status: 'cancelled', non_payment_status: `resolved_${action}`, completed_at: new Date().toISOString()
    });
    if (tx.winning_bid_id) await svc.entities.Bid.update(tx.winning_bid_id, { status: 'lost' }).catch(() => null);
    await notifyUser(svc, tx.buyer_id, {
      type: 'transaction_cancelled', title: 'Transaction cancelled',
      body: `Your transaction was cancelled following a non-payment review. No charge has been applied.`,
      link: `/transactions/${transaction_id}`
    });
    if (!auction) return Response.json({ success: true, non_payment_status: `resolved_${action}` });

    if (action === 'offer_next') {
      const newTx = await offerToNextBidder(svc, tx, auction);
      if (newTx) return Response.json({ success: true, non_payment_status: 'resolved_offer_next', new_transaction_id: newTx.id });
      // No eligible next bidder — relist instead so the item is not left stranded.
      await relistAuction(svc, tx, auction);
      return Response.json({ success: true, non_payment_status: 'resolved_offer_next', relisted: true });
    }

    if (action === 'relist') await relistAuction(svc, tx, auction);
    return Response.json({ success: true, non_payment_status: `resolved_${action}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
