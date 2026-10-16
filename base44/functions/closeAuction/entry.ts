import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { settleAuction } from '../../shared/settleAuction.ts';
import { isStaff, canOperateAuction } from '../../shared/access.ts';

// Closes an open auction on request of an authorised auctioneer/admin. The
// settlement logic (finalise winning bid, create CompletedTransaction, notify,
// audit) lives in shared/settleAuction.ts and is shared with the scheduled
// auto-close job. No payment is taken here.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });
    if (!isStaff(user)) {
      return Response.json({ error: 'Only authorised auctioneers may close an auction.' }, { status: 403 });
    }
    const body = await req.json();
    const auctionId = body && body.auction_id;
    if (!auctionId) return Response.json({ error: 'auction_id is required.' }, { status: 400 });

    const auction = await base44.asServiceRole.entities.Auction.get(auctionId).catch(() => null);
    if (!auction) return Response.json({ error: 'Auction not found.' }, { status: 404 });
    if (!canOperateAuction(user, auction)) {
      return Response.json({ error: 'You are not the assigned auctioneer.' }, { status: 403 });
    }

    const result = await settleAuction(base44.asServiceRole, auctionId, { id: user.id, email: user.email || '' });
    if (!result.ok) return Response.json({ error: result.error }, { status: result.httpStatus || 400 });
    return Response.json({
      success: true, status: result.status,
      winning_bid_id: result.winning_bid_id || '',
      transaction_id: result.transaction_id || null,
      closed_reason: result.closed_reason || ''
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to close auction.' }, { status: 500 });
  }
}