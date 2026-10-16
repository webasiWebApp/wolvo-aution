import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { generateCode, notifyUser } from '../../shared/eventBookings.ts';

// A signed-in visitor RSVPs for a specific physical-attendance time slot at a
// garage sale / house clearance event. The slot must be open and in the
// future, the event must be physical/hybrid and open, and the slot's capacity
// (sum of party sizes of active RSVPs) must not be exceeded. One RSVP per user
// per event. RSVPs are auto-confirmed (status 'confirmed') with a booking code,
// since the purpose is crowd management rather than approval. The organiser
// is notified. The user-scoped client creates the record so created_by_id is
// the attendee (RLS: create own).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to RSVP.' }, { status: 401 });

    const body = await req.json();
    const { event_id, slot_id, full_name, email, phone, party_size } = body || {};
    if (!event_id || !slot_id) {
      return Response.json({ error: 'event_id and slot_id are required.' }, { status: 400 });
    }

    const event = await base44.asServiceRole.entities.GarageSaleEvent.get(event_id).catch(() => null);
    if (!event) return Response.json({ error: 'Event not found.' }, { status: 404 });
    if (event.participation === 'online') {
      return Response.json({ error: 'This event is online only.' }, { status: 400 });
    }
    if (event.status !== 'open') {
      return Response.json({ error: 'This event is not accepting RSVPs right now.' }, { status: 400 });
    }

    const slot = await base44.asServiceRole.entities.AttendanceSlot.get(slot_id).catch(() => null);
    if (!slot || slot.event_id !== event_id) {
      return Response.json({ error: 'Slot not found.' }, { status: 404 });
    }
    if (slot.status !== 'open') {
      return Response.json({ error: 'This time slot is no longer open.' }, { status: 400 });
    }
    if (new Date(slot.scheduled_at).getTime() < Date.now()) {
      return Response.json({ error: 'This time slot has already started.' }, { status: 400 });
    }

    const ps = Math.max(1, Math.min(Number(party_size) || 1, 20));

    const agg = await base44.asServiceRole.entities.EventAttendance.aggregate({
      query: { slot_id, status: { $in: ['registered', 'confirmed'] } },
      groupBy: 'slot_id',
      sum: 'party_size'
    });
    const booked = ((agg.rows || [])[0] || {}).sum_party_size || 0;
    if (booked + ps > (slot.capacity || 0)) {
      return Response.json({ error: 'This time slot is at capacity.', booked, capacity: slot.capacity }, { status: 409 });
    }

    const dup = await base44.asServiceRole.entities.EventAttendance.filter(
      { event_id, user_id: user.id, status: { $in: ['registered', 'confirmed'] } }, { limit: 1 }
    );
    if ((dup.items || [])[0]) {
      return Response.json({ error: 'You have already RSVP\'d for this event. Cancel it first to choose a different slot.' }, { status: 409 });
    }

    const reg = await base44.entities.EventAttendance.create({
      event_id,
      slot_id,
      user_id: user.id,
      full_name: full_name || user.full_name || '',
      email: email || user.email || '',
      phone: phone || '',
      party_size: ps,
      status: 'confirmed',
      booking_code: generateCode('EV'),
      check_in_status: 'pending',
      registered_at: new Date().toISOString()
    });

    await notifyUser(base44.asServiceRole, event.created_by_id, {
      type: 'event_attendance_registered',
      title: 'New event RSVP',
      body: `${full_name || user.email} booked ${ps} place(s) for a time slot at "${event.title}".`,
      link: `/garage-sales/${event.id}`
    });

    return Response.json({ registration: reg });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}