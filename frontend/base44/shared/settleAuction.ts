import { notifyUser } from './eventBookings.ts';
import { auctionOwnerId } from './access.ts';
import { highestBid } from './auctionBidding.ts';

// Shared auction-settlement logic used by both the manual closeAuction
// (auctioneer/admin) and the scheduled autoCloseAuctions maintenance job.
// Finalises the single winning bid, creates a CompletedTransaction when there
// is a winning bid that meets the reserve, notifies the winner and seller,
// marks the auction closed, and writes an audit entry.
//
// Idempotent: returns already_closed (no writes) if the auction is not open,
// so the scheduler can re-run safely and a manual close after an auto-close is
// a no-op. `actor` ({ id, email }) is only used for the audit log — a user for
// manual close, the system for the scheduled close. No payment is taken here;
// the Payment record is created lazily by getPaymentCheckout when the winner
// opens checkout.

export const PAYMENT_DEADLINE_DAYS = 3;
export const COLLECTION_DEADLINE_DAYS = 14;

export async function settleAuction(base44, auctionId, actor) {
  const auction = await base44.entities.Auction.get(auctionId).catch(() => null);
  if (!auction) return { ok: false, error: 'Auction not found.', httpStatus: 404 };
  if (auction.status !== 'open') return { ok: false, error: 'Only open auctions can be closed.', httpStatus: 400, closed_reason: 'already_closed' };

  // Identify the single winning bid (highest amount; ties earliest).
  const winPage = await base44.entities.Bid.filter({ auction_id: auctionId, status: 'winning' }, { sort: 'created_date', limit: 100 });
  const winning = highestBid(winPage.items);
  const allPage = await base44.entities.Bid.filter({ auction_id: auctionId }, { sort: '-created_date', limit: 500 });
  const all = allPage.items || [];

  // The seller gets the sale notification and the transaction.
  const sellerId = auctionOwnerId(auction);
  const reserve = auction.reserve_price || 0;
  const reserveMet = !!winning && (!reserve || winning.amount >= reserve);

  let transaction = null;
  let closedReason = '';

  // Only a bid that actually buys the item is marked 'won'. When the reserve is
  // not met every bid is 'lost', so no bidder is ever shown a win with no sale.
  const wonBidId = reserveMet ? winning.id : '';
  if (wonBidId) await base44.entities.Bid.update(wonBidId, { status: 'won' });
  const losers = all.filter((b) => b.id !== wonBidId && b.status !== 'lost');
  if (losers.length) {
    await base44.entities.Bid.bulkUpdate(losers.map((b) => ({ id: b.id, status: 'lost' })));
  }

  if (reserveMet) {
    const pricingPage = await base44.entities.PricingConfig.filter({ config_name: 'default' }, { limit: 1 });
    const pricing = (pricingPage.items || [])[0] || {};
    const commission = pricing.commission_enabled ? Math.round((winning.amount * (pricing.commission_percent || 0)) / 100) : 0;
    const fees = pricing.listing_fee_enabled ? (pricing.listing_fee_amount || 0) : 0;
    const total = winning.amount + fees + commission;
    const now = Date.now();
    transaction = await base44.entities.CompletedTransaction.create({
      auction_id: auctionId,
      buyer_id: winning.bidder_id,
      seller_id: sellerId,
      final_price: winning.amount,
      fees, commission, total,
      winning_bid_id: winning.id,
      winning_bid_amount: winning.amount,
      payment_deadline: new Date(now + PAYMENT_DEADLINE_DAYS * 86400000).toISOString(),
      collection_deadline: new Date(now + COLLECTION_DEADLINE_DAYS * 86400000).toISOString(),
      status: 'pending_payment',
      non_payment_reported: false,
      non_payment_status: 'none'
    });
    await notifyUser(base44, winning.bidder_id, {
      type: 'transaction_created', title: 'You won the auction!',
      body: `You won "${auction.title}" with a bid of $${winning.amount.toLocaleString('en-AU')}. Please complete payment by ${new Date(transaction.payment_deadline).toLocaleDateString('en-AU')}.`,
      link: `/transactions/${transaction.id}`
    });
    if (sellerId) await notifyUser(base44, sellerId, {
      type: 'transaction_created', title: 'Auction sold',
      body: `"${auction.title}" sold to the winning bidder for $${winning.amount.toLocaleString('en-AU')}. Await payment.`,
      link: `/transactions/${transaction.id}`
    });
  } else if (winning && !reserveMet) {
    closedReason = 'reserve_not_met';
    if (sellerId) await notifyUser(base44, sellerId, {
      type: 'auction_closed_no_sale', title: 'Reserve not met',
      body: `"${auction.title}" closed but the highest bid ($${winning.amount.toLocaleString('en-AU')}) did not meet the reserve. No sale was created. You may relist.`,
      link: `/auctions/${auctionId}`
    });
  } else {
    closedReason = 'no_bids';
    if (sellerId) await notifyUser(base44, sellerId, {
      type: 'auction_closed_no_sale', title: 'Auction closed — no bids',
      body: `"${auction.title}" closed with no bids.`,
      link: `/auctions/${auctionId}`
    });
  }

  await base44.entities.Auction.update(auctionId, {
    status: 'closed',
    paused: false,
    winning_bid_id: wonBidId
  });
  await base44.entities.AuditLog.create({
    actor_id: (actor && actor.id) || '', actor_email: (actor && actor.email) || '',
    action: 'auction_closed', entity_type: 'Auction', entity_id: auctionId,
    details: winning
      ? `Auction closed. Winning bid $${winning.amount.toLocaleString('en-AU')} (${winning.bid_source}).${reserveMet ? ' Transaction created.' : ' Reserve not met — no sale.'}`
      : 'Auction closed with no winning bid.',
    severity: 'warning'
  });
  return {
    ok: true,
    status: 'closed',
    winning_bid_id: wonBidId,
    transaction_id: transaction ? transaction.id : null,
    closed_reason: closedReason
  };
}