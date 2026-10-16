import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { generateCode, notifyUser, recomputeAttendanceStatus } from '../../shared/eventBookings.ts';

// Seller (admin) approves or declines an attendance registration. Approval
// issues a unique booking code (for check-in), promotes the registration to
// 'confirmed' (so it counts toward the minimum threshold), recomputes the
// auction status, and notifies the attendee. Decline notifies the attendee;
// no charge is ever implied.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Only sellers may review attendance.' }, { status: 403 });

    const body = await req.json();
    const { registration_id, decision } = body || {};
    if (!registration_id || !['approve', 'decline'].includes(decision)) {
      return Response.json({ error: 'registration_id and decision (approve/decline) are required.' }, { status: 400 });
    }

    const reg = await base44.asServiceRole.entities.AttendanceRegistration.get(registration_id);
    if (!reg) return Response.json({ error: 'Registration not found.' }, { status: 404 });
    if (reg.status !== 'registered') return Response.json({ error: 'This registration has already been processed.' }, { status: 400 });

    const now = new Date().toISOString();
    if (decision === 'approve') {
      const code = generateCode('AT');
      await base44.asServiceRole.entities.AttendanceRegistration.update(registration_id, {
        status: 'confirmed', booking_code: code, decided_at: now
      });
      await recomputeAttendanceStatus(base44.asServiceRole, reg.auction_id);
      await notifyUser(base44.asServiceRole, reg.user_id, {
        type: 'attendance_confirmed',
        title: 'Attendance confirmed',
        body: `Your attendance is confirmed. Present booking code ${code} at check-in. Registration does not guarantee the auction will proceed; you have not been charged.`,
        link: `/auctions/${reg.auction_id}`
      });
      return Response.json({ success: true, status: 'confirmed', booking_code: code });
    }

    await base44.asServiceRole.entities.AttendanceRegistration.update(registration_id, {
      status: 'declined', decided_at: now
    });
    await notifyUser(base44.asServiceRole, reg.user_id, {
      type: 'attendance_declined',
      title: 'Attendance declined',
      body: `Your attendance registration was declined. You have not been charged.`,
      link: `/auctions/${reg.auction_id}`
    });
    return Response.json({ success: true, status: 'declined' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}