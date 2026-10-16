import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isStaff, canOperateAuction } from '../../shared/access.ts';

// Pauses an open auction. Used for network interruptions or other disruptions.
// While paused, no bids (online or physical) are accepted. Records the reason
// and time; resumption (and any extension) is handled by resumeAuction.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });
    if (!isStaff(user)) {
      return Response.json({ error: 'Only authorised auctioneers may pause an auction.' }, { status: 403 });
    }
    const body = await req.json();
    const auctionId = body && body.auction_id;
    const reason = String((body && body.reason) || '').slice(0, 500);
    if (!auctionId) return Response.json({ error: 'auction_id is required.' }, { status: 400 });

    const auction = await base44.asServiceRole.entities.Auction.get(auctionId);
    if (!auction) return Response.json({ error: 'Auction not found.' }, { status: 404 });
    if (!canOperateAuction(user, auction)) {
      return Response.json({ error: 'You are not the assigned auctioneer.' }, { status: 403 });
    }
    if (auction.status !== 'open') return Response.json({ error: 'Only open auctions can be paused.' }, { status: 400 });
    if (auction.paused) return Response.json({ error: 'Auction is already paused.' }, { status: 400 });

    await base44.asServiceRole.entities.Auction.update(auctionId, {
      paused: true,
      pause_reason: reason,
      paused_at: new Date().toISOString()
    });
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id, actor_email: user.email || '',
      action: 'auction_paused', entity_type: 'Auction', entity_id: auctionId,
      details: 'Auction paused. Reason: ' + reason, severity: 'warning'
    });
    return Response.json({ success: true, paused: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to pause auction.' }, { status: 500 });
  }
}