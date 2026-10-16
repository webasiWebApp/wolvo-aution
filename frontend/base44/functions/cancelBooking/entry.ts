import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { auctionOwnerId } from '../../shared/access.ts';
import { notifyUser, recomputeAttendanceStatus } from '../../shared/eventBookings.ts';

// A user cancels their own booking, or an admin cancels any. For viewings the
// capacity is freed (the slot counts active requests); for attendance the
// threshold is recomputed and the seller notified. No penalties apply.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { type, id } = body || {};
    if (!id || !['viewing', 'attendance'].includes(type)) return Response.json({ error: 'type (viewing/attendance) and id are required.' }, { status: 400 });

    if (type === 'viewing') {
      const appt = await base44.asServiceRole.entities.ViewingAppointment.get(id);
      if (!appt) return Response.json({ error: 'Booking not found.' }, { status: 404 });
      if (appt.user_id !== user.id && user.role !== 'admin') return Response.json({ error: 'You can only cancel your own booking.' }, { status: 403 });
      if (['cancelled', 'declined', 'completed'].includes(appt.status)) return Response.json({ error: 'This booking is no longer active.' }, { status: 400 });
      await base44.asServiceRole.entities.ViewingAppointment.update(id, { status: 'cancelled' });
      const auction = await base44.asServiceRole.entities.Auction.get(appt.auction_id).catch(() => null);
      if (auction) await notifyUser(base44.asServiceRole, auctionOwnerId(auction), {
        type: 'viewing_cancelled',
        title: 'Viewing cancelled',
        body: `A viewing for "${auction.title}" was cancelled. The slot capacity has been freed.`,
        link: '/auctioneer'
      });
      return Response.json({ success: true, status: 'cancelled' });
    }

    const reg = await base44.asServiceRole.entities.AttendanceRegistration.get(id);
    if (!reg) return Response.json({ error: 'Registration not found.' }, { status: 404 });
    if (reg.user_id !== user.id && user.role !== 'admin') return Response.json({ error: 'You can only cancel your own registration.' }, { status: 403 });
    if (['cancelled', 'declined'].includes(reg.status)) return Response.json({ error: 'This registration is no longer active.' }, { status: 400 });
    await base44.asServiceRole.entities.AttendanceRegistration.update(id, { status: 'cancelled' });
    await recomputeAttendanceStatus(base44.asServiceRole, reg.auction_id);
    return Response.json({ success: true, status: 'cancelled' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}