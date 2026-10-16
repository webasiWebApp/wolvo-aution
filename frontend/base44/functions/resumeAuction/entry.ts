import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isStaff, canOperateAuction } from '../../shared/access.ts';

// Resumes a paused auction. Optionally extends the closing time by a number of
// minutes (network-interruption recovery). Records the resumption time and any
// extension. Bids are accepted again once resumed.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });
    if (!isStaff(user)) {
      return Response.json({ error: 'Only authorised auctioneers may resume an auction.' }, { status: 403 });
    }
    const body = await req.json();
    const auctionId = body && body.auction_id;
    const extendMinutes = Math.max(0, Number(body && body.extend_minutes) || 0);
    if (!auctionId) return Response.json({ error: 'auction_id is required.' }, { status: 400 });

    const auction = await base44.asServiceRole.entities.Auction.get(auctionId);
    if (!auction) return Response.json({ error: 'Auction not found.' }, { status: 404 });
    if (!canOperateAuction(user, auction)) {
      return Response.json({ error: 'You are not the assigned auctioneer.' }, { status: 403 });
    }
    if (!auction.paused) return Response.json({ error: 'Auction is not paused.' }, { status: 400 });

    const now = new Date();
    let closingTime = auction.closing_time;
    let extendedClosingTime = auction.extended_closing_time || '';
    if (extendMinutes > 0) {
      const base = (auction.closing_time && new Date(auction.closing_time).getTime() > now.getTime())
        ? new Date(auction.closing_time).getTime()
        : now.getTime();
      const newClose = new Date(base + extendMinutes * 60 * 1000).toISOString();
      closingTime = newClose;
      extendedClosingTime = newClose;
    }

    await base44.asServiceRole.entities.Auction.update(auctionId, {
      paused: false,
      resumed_at: now.toISOString(),
      closing_time: closingTime,
      extended_closing_time: extendedClosingTime
    });
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id, actor_email: user.email || '',
      action: 'auction_resumed', entity_type: 'Auction', entity_id: auctionId,
      details: 'Auction resumed. Extension minutes: ' + extendMinutes, severity: 'warning'
    });
    return Response.json({ success: true, paused: false, closing_time: closingTime });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to resume auction.' }, { status: 500 });
  }
}