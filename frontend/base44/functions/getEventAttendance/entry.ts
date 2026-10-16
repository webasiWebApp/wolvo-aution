import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Public lookup for the event-level attendance panel on a physical/hybrid
// garage sale / house clearance event. Returns the event's attendance slots
// with remaining capacity (booked = sum of party sizes of active RSVPs) and,
// for a signed-in visitor, their own active registration. No other attendees'
// personal data is returned. A single aggregate call computes booked counts
// per slot instead of one query per slot.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const eventId = body && body.event_id;
    if (!eventId) return Response.json({ error: 'event_id required' }, { status: 400 });

    const event = await base44.asServiceRole.entities.GarageSaleEvent.get(eventId).catch(() => null);
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });
    const physical = event.participation === 'physical' || event.participation === 'hybrid';
    if (!physical) return Response.json({ enabled: false });

    const slotPage = await base44.asServiceRole.entities.AttendanceSlot.filter(
      { event_id: eventId }, { sort: 'scheduled_at', limit: 200 }
    );
    const slots = slotPage.items || [];

    let bookedBySlot = {};
    if (slots.length) {
      const agg = await base44.asServiceRole.entities.EventAttendance.aggregate({
        query: { event_id: eventId, status: { $in: ['registered', 'confirmed'] } },
        groupBy: 'slot_id',
        sum: 'party_size'
      });
      for (const row of (agg.rows || [])) {
        bookedBySlot[row.slot_id] = row.sum_party_size || 0;
      }
    }

    const slotsWithCaps = slots.map((s) => {
      const booked = bookedBySlot[s.id] || 0;
      return {
        id: s.id, scheduled_at: s.scheduled_at, duration_minutes: s.duration_minutes,
        capacity: s.capacity, label: s.label, location: s.location, status: s.status,
        booked, remaining: Math.max(0, (s.capacity || 0) - booked)
      };
    });

    let mine = null;
    try {
      const user = await base44.auth.me();
      if (user) {
        const myPage = await base44.asServiceRole.entities.EventAttendance.filter(
          { event_id: eventId, user_id: user.id, status: { $in: ['registered', 'confirmed'] } },
          { limit: 5 }
        );
        mine = (myPage.items || [])[0] || null;
      }
    } catch (e) {
      // not signed in — mine stays null
    }

    const totalBooked = slotsWithCaps.reduce((n, s) => n + s.booked, 0);

    return Response.json({
      enabled: true,
      event_status: event.status,
      participation: event.participation,
      address: event.address || '',
      slots: slotsWithCaps,
      total_booked: totalBooked,
      mine
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}