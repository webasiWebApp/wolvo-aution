import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { auctionOwnerId } from '../../shared/access.ts';
import { generateCode, notifyUser, recomputeAttendanceStatus } from '../../shared/eventBookings.ts';

// A signed-in user registers their intention to attend a physical/hybrid
// auction. Enforces the registration window and venue capacity, rejects
// duplicates, and notifies the seller. When approval is NOT required the
// registration is auto-confirmed and a booking code is issued immediately;
// otherwise it stays 'registered' (an expression of interest) until the
// seller approves via decideAttendance. Registration is never a charge and
// never guarantees the auction will proceed.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to register attendance.' }, { status: 401 });

    const body = await req.json();
    const { auction_id, full_name, email, phone, party_size } = body || {};
    if (!auction_id) return Response.json({ error: 'auction_id required.' }, { status: 400 });

    const auction = await base44.asServiceRole.entities.Auction.get(auction_id);
    if (!auction) return Response.json({ error: 'Auction not found.' }, { status: 404 });
    if (auction.bidding_type === 'online') return Response.json({ error: 'This auction does not have physical attendance.' }, { status: 400 });

    if (auction.attendance_status && ['AUCTION_CANCELLED', 'AUCTION_COMPLETED'].includes(auction.attendance_status)) {
      return Response.json({ error: 'This event is no longer accepting registrations.' }, { status: 400 });
    }

    const now = Date.now();
    const openT = auction.registration_open_time ? new Date(auction.registration_open_time).getTime() : null;
    const closeT = (auction.registration_close_time || auction.registration_deadline)
      ? new Date(auction.registration_close_time || auction.registration_deadline).getTime() : null;
    if (openT && now < openT) return Response.json({ error: 'Attendance registration is not open yet.' }, { status: 400 });
    if (closeT && now > closeT) return Response.json({ error: 'Attendance registration has closed.' }, { status: 400 });

    const ps = Math.max(1, Math.min(Number(party_size) || 1, 20));
    const activePage = await base44.asServiceRole.entities.AttendanceRegistration.filter(
      { auction_id, status: { $in: ['registered', 'confirmed'] } }, { limit: 1000 }
    );
    const active = activePage.items || [];
    const registeredCount = active.reduce((n, a) => n + (a.party_size || 1), 0);
    if (auction.max_venue_capacity && registeredCount + ps > auction.max_venue_capacity) {
      return Response.json({ error: 'This event is at capacity.', capacity: auction.max_venue_capacity, registered: registeredCount }, { status: 409 });
    }
    if (active.find((a) => a.user_id === user.id)) {
      return Response.json({ error: 'You have already registered to attend this event.' }, { status: 409 });
    }

    const autoConfirm = !auction.attendance_requires_approval;
    const reg = await base44.entities.AttendanceRegistration.create({
      auction_id,
      user_id: user.id,
      full_name: full_name || user.full_name || '',
      email: email || user.email || '',
      phone: phone || '',
      party_size: ps,
      status: autoConfirm ? 'confirmed' : 'registered',
      booking_code: autoConfirm ? generateCode('AT') : '',
      check_in_status: 'pending',
      registered_at: new Date().toISOString()
    });

    await notifyUser(base44.asServiceRole, auctionOwnerId(auction), {
      type: 'attendance_registered',
      title: autoConfirm ? 'New confirmed attendee' : 'New attendance registration',
      body: `${full_name || user.email} registered to attend "${auction.title}" (party of ${ps}).${autoConfirm ? ' Auto-confirmed (approval not required).' : ' Awaiting your approval.'}`,
      link: '/auctioneer'
    });

    await recomputeAttendanceStatus(base44.asServiceRole, auction_id);
    return Response.json({ registration: reg, auto_confirmed: autoConfirm });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}