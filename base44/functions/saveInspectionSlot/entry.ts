import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Seller (admin) creates or updates an inspection slot. Holds the private
// full_address, which is admin-only via RLS and only released through
// decideViewing. capacity is the max number of attendees/parties the slot
// can hold across all active (requested + confirmed) appointments.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Only sellers may configure inspections.' }, { status: 403 });

    const body = await req.json();
    const { id, auction_id, scheduled_at, duration_minutes, capacity, location_hint, full_address, status } = body || {};
    if (!auction_id || !scheduled_at) return Response.json({ error: 'auction_id and scheduled_at are required.' }, { status: 400 });

    if (id) {
      const updated = await base44.asServiceRole.entities.InspectionSlot.update(id, {
        scheduled_at, duration_minutes, capacity, location_hint, full_address, status
      });
      return Response.json({ slot: updated });
    }

    const slot = await base44.asServiceRole.entities.InspectionSlot.create({
      auction_id,
      scheduled_at,
      duration_minutes: duration_minutes || 60,
      capacity: capacity || 1,
      location_hint: location_hint || '',
      full_address: full_address || '',
      status: status || 'open'
    });
    return Response.json({ slot });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}