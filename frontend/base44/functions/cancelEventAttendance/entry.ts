import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// A signed-in attendee cancels their own event attendance RSVP (or an admin
// cancels one). Frees the slot capacity for other visitors. Idempotent: a
// registration already cancelled/declined is left untouched.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in.' }, { status: 401 });

    const body = await req.json();
    const { registration_id } = body || {};
    if (!registration_id) return Response.json({ error: 'registration_id required.' }, { status: 400 });

    const reg = await base44.asServiceRole.entities.EventAttendance.get(registration_id).catch(() => null);
    if (!reg) return Response.json({ error: 'Registration not found.' }, { status: 404 });
    if (reg.user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Not authorised.' }, { status: 403 });
    }
    if (['cancelled', 'declined'].includes(reg.status)) {
      return Response.json({ ok: true, already: true });
    }
    await base44.asServiceRole.entities.EventAttendance.update(registration_id, { status: 'cancelled' });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}