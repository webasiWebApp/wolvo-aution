import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { placeAuthoritativeBid } from '../../shared/auctionBidding.ts';

// Places an ONLINE bid. Requires an authenticated user who is verified, has 2FA
// enabled with an active MFA session, and is not restricted. The authoritative
// shared state is written via the service role so online and physical bids never
// diverge.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in to bid.' }, { status: 401 });

    // Bidding eligibility: not restricted, identity VERIFIED, 2FA enabled, MFA session active.
    const [vcPage, tfPage, restPage] = await Promise.all([
      base44.asServiceRole.entities.VerificationCase.filter({ user_id: user.id }, { sort: '-created_date', limit: 1 }),
      base44.asServiceRole.entities.TwoFactorStatus.filter({ user_id: user.id }, { limit: 1 }),
      base44.asServiceRole.entities.AccountRestriction.filter({ user_id: user.id, active: true }, { limit: 1 })
    ]);
    if ((restPage.items || [])[0]) {
      return Response.json({ error: 'Your account is currently restricted and cannot bid. Please contact support.' }, { status: 403 });
    }
    const vcase = (vcPage.items || [])[0];
    if (!vcase || vcase.verification_status !== 'VERIFIED') {
      return Response.json({ error: 'You must complete identity verification before bidding.' }, { status: 403 });
    }
    const twofa = (tfPage.items || [])[0];
    if (!twofa || !twofa.enabled) {
      return Response.json({ error: 'You must enable two-factor authentication before bidding.' }, { status: 403 });
    }
    if (!twofa.mfa_verified_until || new Date(twofa.mfa_verified_until).getTime() < Date.now()) {
      return Response.json({ error: 'Please complete two-factor authentication before bidding.' }, { status: 403 });
    }

    const body = await req.json();
    const result = await placeAuthoritativeBid(base44.asServiceRole, {
      auction_id: body && body.auction_id,
      amount: body && body.amount,
      bidder_id: user.id,
      bidder_name: user.full_name || user.email,
      bid_source: 'online'
    });
    return Response.json(result, { status: result.status });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to place bid.' }, { status: 500 });
  }
}