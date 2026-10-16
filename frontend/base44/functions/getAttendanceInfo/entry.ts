import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { recomputeAttendanceStatus } from '../../shared/eventBookings.ts';

// Public lookup for the attendance panel on a physical/hybrid listing.
// Refreshes the threshold status, then returns the attendance config and
// aggregate counts. No personal attendee data is returned — a user reads
// their own registration through the client (RLS: own records only).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const auctionId = body && body.auction_id;
    if (!auctionId) return Response.json({ error: 'auction_id required' }, { status: 400 });

    const auction = await base44.asServiceRole.entities.Auction.get(auctionId);
    if (!auction) return Response.json({ error: 'Auction not found' }, { status: 404 });
    const physical = auction.bidding_type === 'physical' || auction.bidding_type === 'hybrid';
    if (!physical) return Response.json({ attendance: { enabled: false } });

    await recomputeAttendanceStatus(base44.asServiceRole, auctionId);
    const refreshed = await base44.asServiceRole.entities.Auction.get(auctionId);

    const [confirmed, registered, checkedIn] = await Promise.all([
      base44.asServiceRole.entities.AttendanceRegistration.count({ auction_id: auctionId, status: 'confirmed' }),
      base44.asServiceRole.entities.AttendanceRegistration.count({ auction_id: auctionId, status: 'registered' }),
      base44.asServiceRole.entities.AttendanceRegistration.count({ auction_id: auctionId, check_in_status: 'checked_in' })
    ]);

    return Response.json({
      attendance: {
        enabled: true,
        attendance_status: refreshed.attendance_status || 'REGISTRATION_OPEN',
        requires_approval: !!auction.attendance_requires_approval,
        min_confirmed_attendees: auction.min_confirmed_attendees || 0,
        max_venue_capacity: auction.max_venue_capacity || 0,
        registration_open_time: auction.registration_open_time || null,
        registration_close_time: auction.registration_close_time || auction.registration_deadline || null,
        physical_date: auction.physical_date || null,
        online_bidding_enabled: !!auction.online_bidding_enabled,
        confirmed: confirmed || 0,
        registered: registered || 0,
        checked_in: checkedIn || 0
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}