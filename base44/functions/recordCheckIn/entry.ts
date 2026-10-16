import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isStaff, canOperateAuction } from '../../shared/access.ts';

// Authorised staff (admin, or the auctioneer assigned to the auction) record
// arrival or a no-show for a viewing or attendance booking. Booking codes are
// looked up for attendance; viewings may be checked in by id or code. No-shows
// are recorded without penalty. Service-role writes bypass RLS so an
// auctioneer (not an admin) can still record check-in.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isStaff(user)) return Response.json({ error: 'Only authorised staff may record check-in.' }, { status: 403 });

    const body = await req.json();
    const { type, booking_code, id, action, auction_id } = body || {};
    if (!['viewing', 'attendance'].includes(type) || !['check_in', 'no_show'].includes(action)) {
      return Response.json({ error: 'Invalid request.' }, { status: 400 });
    }

    // Resolve the auction once we know it, then enforce auctioneer assignment.
    const enforceAuctioneer = async (aid) => {
      if (user.role === 'admin') return;
      const auction = aid ? await base44.asServiceRole.entities.Auction.get(aid).catch(() => null) : null;
      if (!canOperateAuction(user, auction)) {
        throw Object.assign(new Error('You are not the assigned auctioneer for this auction.'), { status: 403 });
      }
    };

    if (type === 'viewing') {
      let appt;
      if (id) appt = await base44.asServiceRole.entities.ViewingAppointment.get(id);
      else if (booking_code) {
        const p = await base44.asServiceRole.entities.ViewingAppointment.filter({ booking_code }, { limit: 1 });
        appt = (p.items || [])[0];
      }
      if (!appt) return Response.json({ error: 'Booking not found.' }, { status: 404 });
      try { await enforceAuctioneer(appt.auction_id); } catch (e) { return Response.json({ error: e.message }, { status: e.status || 403 }); }
      if (action === 'check_in' && appt.status !== 'confirmed') return Response.json({ error: 'Only confirmed bookings can be checked in.' }, { status: 400 });
      const update = { check_in_status: action === 'check_in' ? 'checked_in' : 'no_show' };
      if (action === 'check_in') update.status = 'completed';
      await base44.asServiceRole.entities.ViewingAppointment.update(appt.id, update);
      return Response.json({ success: true, check_in_status: update.check_in_status, status: update.status || appt.status });
    }

    if (!booking_code) return Response.json({ error: 'booking_code is required for attendance check-in.' }, { status: 400 });
    const p = await base44.asServiceRole.entities.AttendanceRegistration.filter({ booking_code, auction_id }, { limit: 1 });
    const reg = (p.items || [])[0];
    if (!reg) return Response.json({ error: 'No confirmed attendee with that booking code.' }, { status: 404 });
    try { await enforceAuctioneer(reg.auction_id); } catch (e) { return Response.json({ error: e.message }, { status: e.status || 403 }); }
    if (reg.status !== 'confirmed') return Response.json({ error: 'This attendee is not confirmed.' }, { status: 400 });
    await base44.asServiceRole.entities.AttendanceRegistration.update(reg.id, {
      check_in_status: action === 'check_in' ? 'checked_in' : 'no_show'
    });
    return Response.json({ success: true, check_in_status: action === 'check_in' ? 'checked_in' : 'no_show' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}