import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { notifyUser } from '../../shared/eventBookings.ts';

// Seller (admin) drives the event state machine. The threshold transition to
// MINIMUM_ATTENDANCE_REACHED is automatic (recomputeAttendanceStatus); reaching
// it does NOT confirm the event — the seller must still confirm here. Cancels
// free capacity and notify all registered/confirmed attendees (no charge).
// Reschedules notify attendees and keep their registrations active. Complete
// marks the event done.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Only sellers may manage the event.' }, { status: 403 });

    const body = await req.json();
    const { auction_id, action, new_physical_date } = body || {};
    if (!auction_id || !['confirm', 'reschedule', 'cancel', 'complete'].includes(action)) {
      return Response.json({ error: 'auction_id and a valid action (confirm/reschedule/cancel/complete) are required.' }, { status: 400 });
    }

    const auction = await base44.asServiceRole.entities.Auction.get(auction_id);
    if (!auction) return Response.json({ error: 'Auction not found.' }, { status: 404 });
    if (auction.bidding_type === 'online') return Response.json({ error: 'Online auctions have no physical event.' }, { status: 400 });

    const page = await base44.asServiceRole.entities.AttendanceRegistration.filter(
      { auction_id, status: { $in: ['confirmed', 'registered'] } }, { limit: 1000 }
    );
    const attendees = page.items || [];

    if (action === 'confirm') {
      if (!['MINIMUM_ATTENDANCE_REACHED', 'AWAITING_SELLER_CONFIRMATION', 'AWAITING_MINIMUM_ATTENDANCE', 'AUCTION_RESCHEDULED'].includes(auction.attendance_status || 'REGISTRATION_OPEN')) {
        return Response.json({ error: 'Confirm the event after the minimum attendance is reached.' }, { status: 400 });
      }
      await base44.asServiceRole.entities.Auction.update(auction_id, { attendance_status: 'AUCTION_CONFIRMED' });
      for (const a of attendees) {
        await notifyUser(base44.asServiceRole, a.user_id, {
          type: 'auction_confirmed',
          title: 'Auction confirmed',
          body: `"${auction.title}" has been confirmed by the seller and will proceed. Registration does not guarantee a seat — arrive early. You have not been charged.`,
          link: `/auctions/${auction_id}`
        });
      }
      return Response.json({ success: true, attendance_status: 'AUCTION_CONFIRMED' });
    }

    if (action === 'reschedule') {
      const update = { attendance_status: 'AUCTION_RESCHEDULED' };
      if (new_physical_date) update.physical_date = new_physical_date;
      await base44.asServiceRole.entities.Auction.update(auction_id, update);
      for (const a of attendees) {
        await notifyUser(base44.asServiceRole, a.user_id, {
          type: 'auction_rescheduled',
          title: 'Auction rescheduled',
          body: `"${auction.title}" has been rescheduled${new_physical_date ? ' to ' + new Date(new_physical_date).toLocaleString('en-AU') : ''}. Your registration remains active. You have not been charged.`,
          link: `/auctions/${auction_id}`
        });
      }
      return Response.json({ success: true, attendance_status: 'AUCTION_RESCHEDULED', physical_date: update.physical_date });
    }

    if (action === 'cancel') {
      await base44.asServiceRole.entities.Auction.update(auction_id, { attendance_status: 'AUCTION_CANCELLED' });
      await base44.asServiceRole.entities.AttendanceRegistration.updateMany(
        { auction_id, status: { $in: ['registered', 'confirmed'] } },
        { $set: { status: 'cancelled' } }
      );
      for (const a of attendees) {
        await notifyUser(base44.asServiceRole, a.user_id, {
          type: 'auction_cancelled',
          title: 'Auction cancelled',
          body: `"${auction.title}" has been cancelled. Registration did not guarantee the auction would proceed. You have not been charged.`,
          link: `/auctions/${auction_id}`
        });
      }
      return Response.json({ success: true, attendance_status: 'AUCTION_CANCELLED' });
    }

    await base44.asServiceRole.entities.Auction.update(auction_id, { attendance_status: 'AUCTION_COMPLETED' });
    return Response.json({ success: true, attendance_status: 'AUCTION_COMPLETED' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}