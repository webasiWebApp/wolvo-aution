// base44/shared/auctionBidding.ts
// Authoritative bid-placement logic shared by online (placeBid) and physical
// (auctioneerPlaceBid) entry. Online and physical bids share ONE auction state:
// a single current_highest_bid and a single winning bid. There are no separate
// per-channel winning records. A reconcile step converges to a single winner
// even when two bids land near-simultaneously.

import { auctionOwnerId } from './access.ts';

export async function placeAuthoritativeBid(base44, opts) {
  const auctionId = opts.auction_id;
  const amount = Number(opts.amount);
  if (!auctionId || !Number.isFinite(amount) || amount <= 0) {
    return { status: 400, error: 'Invalid bid request.' };
  }

  const auction = await base44.entities.Auction.get(auctionId);
  if (!auction) return { status: 404, error: 'Auction not found.' };
  if (auction.status !== 'open') {
    return { status: 400, error: 'This auction is not currently open for bidding.' };
  }
  // A paused auction accepts no bids — online or physical. This is the network-
  // interruption procedure: the auctioneer pauses, conflicting offline records
  // are rejected, and bidding resumes (optionally extended) only on resume.
  if (auction.paused) {
    return { status: 409, error: 'This auction is paused. Bids are not accepted while paused.', paused: true };
  }
  if (auction.closing_time && new Date(auction.closing_time).getTime() < Date.now()) {
    return { status: 400, error: 'This auction has closed.' };
  }

  const source = opts.bid_source || 'online';
  // Enforce the auction mode: online-only auctions reject physical bids and
  // vice-versa; hybrid accepts both.
  if (source === 'online' && (auction.bidding_type === 'physical' || auction.online_bidding_enabled === false)) {
    return { status: 400, error: 'Online bidding is not enabled for this auction.' };
  }
  if (source === 'physical' && auction.bidding_type === 'online') {
    return { status: 400, error: 'Physical bidding is not enabled for this auction.' };
  }

  // Shill-bidding guard: the seller can never bid on their own item.
  if (opts.bidder_id && opts.bidder_id === auctionOwnerId(auction)) {
    return { status: 403, error: 'You cannot bid on your own listing.' };
  }

  const startingBid = auction.starting_bid || 0;
  const currentBid = auction.current_highest_bid || startingBid;
  const requiredMin = (auction.bid_count || 0) > 0 ? currentBid + (auction.min_bid_increment || 0) : startingBid;
  if (amount < requiredMin) {
    return { status: 400, error: `Your bid must be at least $${requiredMin.toLocaleString('en-AU')}.`, minimum: requiredMin };
  }

  // Create the bid as winning; reconcile below ensures a single winner.
  const bid = await base44.entities.Bid.create({
    auction_id: auctionId,
    auction_title: auction.title,
    bidder_id: opts.bidder_id,
    bidder_name: opts.bidder_name,
    amount,
    status: 'winning',
    bid_source: source,
    auctioneer_id: opts.auctioneer_id || '',
    is_sample: auction.is_sample
  });

  await base44.entities.Auction.update(auctionId, {
    current_highest_bid: amount,
    bid_count: (auction.bid_count || 0) + 1
  });

  await reconcileWinner(base44, auctionId);

  return { status: 200, success: true, bid: { id: bid.id, amount }, new_highest_bid: amount };
}

// The highest bid in a list sorted oldest-first; ties go to the earliest bid.
export function highestBid(bidsOldestFirst) {
  let best = null;
  for (const b of bidsOldestFirst || []) { if (!best || b.amount > best.amount) best = b; }
  return best;
}

// Converges the auction to exactly one winning bid (the highest amount; ties
// broken by earliest timestamp) and syncs current_highest_bid. Idempotent.
export async function reconcileWinner(base44, auctionId) {
  const page = await base44.entities.Bid.filter({ auction_id: auctionId, status: 'winning' }, { sort: 'created_date', limit: 100 });
  const items = page.items || [];
  const keep = highestBid(items);
  if (!keep) return;
  const losers = items.filter((b) => b.id !== keep.id);
  if (losers.length) {
    await base44.entities.Bid.bulkUpdate(losers.map((b) => ({ id: b.id, status: 'outbid' })));
  }
  // Recompute the bid count from the records so concurrent bids don't undercount.
  // Only bids of the current round count — bids settled in an earlier round of a
  // relisted auction are 'won'/'lost' and stay out of the new count.
  const total = await base44.entities.Bid.count({ auction_id: auctionId, status: { $in: ['winning', 'outbid'] } });
  await base44.entities.Auction.update(auctionId, { current_highest_bid: keep.amount, bid_count: total });
}