import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { placeAuthoritativeBid } from '../../shared/auctionBidding.ts';
import { isStaff, canOperateAuction } from '../../shared/access.ts';

// An authorised auctioneer enters a PHYSICAL bid on behalf of a registered
// bidder. The physical bid writes to the same authoritative state as online
// bids — there is one current_highest_bid and one winning bid per auction.
// The bidder must still satisfy verified-identity + 2FA requirements.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });
    if (!isStaff(user)) {
      return Response.json({ error: 'Only authorised auctioneers may enter physical bids.' }, { status: 403 });
    }

    const body = await req.json();
    const auctionId = body && body.auction_id;
    const bidderId = body && body.bidder_id;
    const amount = body && body.amount;
    if (!auctionId || !bidderId || !Number.isFinite(Number(amount))) {
      return Response.json({ error: 'auction_id, bidder_id and amount are required.' }, { status: 400 });
    }

    // The auctioneer must be assigned to this auction (admins may act on any).
    const auction = await base44.asServiceRole.entities.Auction.get(auctionId);
    if (!auction) return Response.json({ error: 'Auction not found.' }, { status: 404 });
    if (!canOperateAuction(user, auction)) {
      return Response.json({ error: 'You are not the assigned auctioneer for this auction.' }, { status: 403 });
    }

    // The physical bidder must satisfy the same verified-user + 2FA requirements.
    const [vcPage, tfPage, restPage] = await Promise.all([
      base44.asServiceRole.entities.VerificationCase.filter({ user_id: bidderId }, { sort: '-created_date', limit: 1 }),
      base44.asServiceRole.entities.TwoFactorStatus.filter({ user_id: bidderId }, { limit: 1 }),
      base44.asServiceRole.entities.AccountRestriction.filter({ user_id: bidderId, active: true }, { limit: 1 })
    ]);
    if ((restPage.items || [])[0]) {
      return Response.json({ error: 'The selected bidder is restricted and cannot bid.' }, { status: 403 });
    }
    const vcase = (vcPage.items || [])[0];
    if (!vcase || vcase.verification_status !== 'VERIFIED') {
      return Response.json({ error: 'The selected bidder has not completed identity verification.' }, { status: 403 });
    }
    const twofa = (tfPage.items || [])[0];
    if (!twofa || !twofa.enabled) {
      return Response.json({ error: 'The selected bidder has not enabled two-factor authentication.' }, { status: 403 });
    }

    // Use the verified legal name from the bidder's verification case as the
    // display name (the User entity is not queryable via the entities API).
    const bidderName = (vcase && vcase.legal_name) || bidderId;

    const result = await placeAuthoritativeBid(base44.asServiceRole, {
      auction_id: auctionId,
      amount,
      bidder_id: bidderId,
      bidder_name: bidderName,
      bid_source: 'physical',
      auctioneer_id: user.id
    });

    if (result.status === 200) {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: user.id, actor_email: user.email || '',
        action: 'physical_bid_entered',
        entity_type: 'Auction', entity_id: auctionId,
        details: `Auctioneer entered physical bid $${Number(amount).toLocaleString('en-AU')} for bidder ${bidderId}.`,
        severity: 'warning'
      });
    }
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to enter physical bid.' }, { status: 500 });
  }
}