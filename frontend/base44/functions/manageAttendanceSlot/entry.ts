import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { notifyUser } from '../../shared/eventBookings.ts';

// Event organiser (or admin) manages physical-attendance time slots for a
// garage sale / house clearance event. Slots carry a start time, duration and
// a capacity that caps how many people can attend that window — the crowd
// control for physical house clearances. Actions: create, update, cancel.
// Cancelling a slot also cancels every active RSVP for it and notifies the
// affected attendees. Only the event's organiser or an admin may act; the
// service role is used because AttendanceSlot writes are admin-only under RLS.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to manage attendance slots.' }, { status: 401 });

    const body = await req.json();
    const action = body && body.action;

    if (action === 'create') {
      const { event_id, scheduled_at, duration_minutes, capacity, label, location } = body || {};
      if (!event_id || !scheduled_at || !capacity) {
        return Response.json({ error: 'event_id, scheduled_at and capacity are required.' }, { status: 400 });
      }
      const event = await base44.asServiceRole.entities.GarageSaleEvent.get(event_id).catch(() => null);
      if (!event) return Response.json({ error: 'Event not found.' }, { status: 404 });
      if (event.created_by_id !== user.id && user.role !== 'admin') {
        return Response.json({ error: 'Only the event organiser can manage attendance slots.' }, { status: 403 });
      }
      if (event.participation === 'online') {
        return Response.json({ error: 'Online-only events do not have physical attendance slots.' }, { status: 400 });
      }
      const slot = await base44.asServiceRole.entities.AttendanceSlot.create({
        event_id,
        scheduled_at: new Date(scheduled_at).toISOString(),
        duration_minutes: Math.max(5, Number(duration_minutes) || 60),
        capacity: Math.max(1, Number(capacity) || 1),
        label: label || '',
        location: location || event.address || '',
        status: 'open'
      });
      return Response.json({ slot });
    }

    if (action === 'update') {
      const { slot_id, scheduled_at, duration_minutes, capacity, label, location, status } = body || {};
      if (!slot_id) return Response.json({ error: 'slot_id required.' }, { status: 400 });
      const slot = await base44.asServiceRole.entities.AttendanceSlot.get(slot_id).catch(() => null);
      if (!slot) return Response.json({ error: 'Slot not found.' }, { status: 404 });
      const event = await base44.asServiceRole.entities.GarageSaleEvent.get(slot.event_id).catch(() => null);
      if (!event || (event.created_by_id !== user.id && user.role !== 'admin')) {
        return Response.json({ error: 'Not authorised.' }, { status: 403 });
      }
      const patch = {};
      if (scheduled_at) patch.scheduled_at = new Date(scheduled_at).toISOString();
      if (duration_minutes) patch.duration_minutes = Math.max(5, Number(duration_minutes));
      if (capacity) patch.capacity = Math.max(1, Number(capacity));
      if (label !== undefined) patch.label = label;
      if (location !== undefined) patch.location = location;
      if (status && ['open', 'closed', 'cancelled'].includes(status)) patch.status = status;
      const updated = await base44.asServiceRole.entities.AttendanceSlot.update(slot_id, patch);
      return Response.json({ slot: updated });
    }

    if (action === 'cancel') {
      const { slot_id } = body || {};
      if (!slot_id) return Response.json({ error: 'slot_id required.' }, { status: 400 });
      const slot = await base44.asServiceRole.entities.AttendanceSlot.get(slot_id).catch(() => null);
      if (!slot) return Response.json({ error: 'Slot not found.' }, { status: 404 });
      const event = await base44.asServiceRole.entities.GarageSaleEvent.get(slot.event_id).catch(() => null);
      if (!event || (event.created_by_id !== user.id && user.role !== 'admin')) {
        return Response.json({ error: 'Not authorised.' }, { status: 403 });
      }
      await base44.asServiceRole.entities.AttendanceSlot.update(slot_id, { status: 'cancelled' });
      const regs = await base44.asServiceRole.entities.EventAttendance.filter(
        { slot_id, status: { $in: ['registered', 'confirmed'] } }, { limit: 500 }
      );
      const items = regs.items || [];
      if (items.length) {
        await base44.asServiceRole.entities.EventAttendance.updateMany(
          { slot_id, status: { $in: ['registered', 'confirmed'] } },
          { $set: { status: 'cancelled' } }
        );
        await Promise.allSettled(items.map((r) => notifyUser(base44.asServiceRole, r.user_id, {
          type: 'attendance_slot_cancelled',
          title: 'Your attendance slot was cancelled',
          body: `The time slot you booked for "${event.title}" has been cancelled by the organiser. Please pick another slot.`,
          link: `/garage-sales/${event.id}`
        })));
      }
      return Response.json({ ok: true, cancelled_registrations: items.length });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}