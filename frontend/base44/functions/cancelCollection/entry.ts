import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// A buyer cancels their own collection booking (freeing the slot capacity), or
// an admin cancels any. No penalty.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { appointment_id } = body || {};
    if (!appointment_id) return Response.json({ error: 'appointment_id is required.' }, { status: 400 });
    const appt = await base44.asServiceRole.entities.CollectionAppointment.get(appointment_id);
    if (!appt) return Response.json({ error: 'Booking not found.' }, { status: 404 });
    if (appt.user_id !== user.id && user.role !== 'admin') return Response.json({ error: 'You can only cancel your own booking.' }, { status: 403 });
    if (appt.status !== 'scheduled') return Response.json({ error: 'This booking is no longer active.' }, { status: 400 });
    await base44.asServiceRole.entities.CollectionAppointment.update(appointment_id, { status: 'cancelled' });
    return Response.json({ success: true, status: 'cancelled' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}