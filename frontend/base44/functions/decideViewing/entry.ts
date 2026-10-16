import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { notifyUser } from '../../shared/eventBookings.ts';

// Seller (admin) approves or declines a viewing request. On approval the
// exact property address is released to the attendee (address_released = true)
// and the attendee is notified with the address and their booking code. On
// decline the attendee is notified. No charge is implied.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Only sellers may review viewings.' }, { status: 403 });

    const body = await req.json();
    const { appointment_id, decision, notes } = body || {};
    if (!appointment_id || !['approve', 'decline'].includes(decision)) {
      return Response.json({ error: 'appointment_id and decision (approve/decline) are required.' }, { status: 400 });
    }

    const appt = await base44.asServiceRole.entities.ViewingAppointment.get(appointment_id);
    if (!appt) return Response.json({ error: 'Appointment not found.' }, { status: 404 });
    if (appt.status !== 'requested') return Response.json({ error: 'This request has already been processed.' }, { status: 400 });

    const slot = appt.slot_id ? await base44.asServiceRole.entities.InspectionSlot.get(appt.slot_id).catch(() => null) : null;
    const now = new Date().toISOString();

    if (decision === 'approve') {
      await base44.asServiceRole.entities.ViewingAppointment.update(appointment_id, {
        status: 'confirmed',
        address_released: true,
        decided_at: now,
        decided_by: user.id
      });
      const address = (slot && slot.full_address) || (slot && slot.location_hint) || '';
      await notifyUser(base44.asServiceRole, appt.user_id, {
        type: 'viewing_confirmed',
        title: 'Viewing approved',
        body: `Your viewing for ${new Date(appt.requested_slot).toLocaleString('en-AU')} has been confirmed. Address: ${address}. Booking code: ${appt.booking_code}. You have not been charged.`,
        link: `/auctions/${appt.auction_id}`
      });
      return Response.json({ success: true, status: 'confirmed' });
    }

    await base44.asServiceRole.entities.ViewingAppointment.update(appointment_id, {
      status: 'declined',
      decided_at: now,
      decided_by: user.id
    });
    await notifyUser(base44.asServiceRole, appt.user_id, {
      type: 'viewing_declined',
      title: 'Viewing declined',
      body: `Your viewing request was declined.${notes ? ' ' + notes : ''} You have not been charged.`,
      link: `/auctions/${appt.auction_id}`
    });
    return Response.json({ success: true, status: 'declined' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}