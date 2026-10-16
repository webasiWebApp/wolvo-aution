import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Seller (admin) creates or updates a collection slot: date/time, duration,
// capacity, location and a booking deadline. Admin-only via RLS; winners see
// slots through getCollectionInfo.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Only sellers may configure collection slots.' }, { status: 403 });

    const body = await req.json();
    const { id, auction_id, scheduled_at, duration_minutes, capacity, location, deadline, status } = body || {};
    if (!auction_id || !scheduled_at) return Response.json({ error: 'auction_id and scheduled_at are required.' }, { status: 400 });

    if (id) {
      const updated = await base44.asServiceRole.entities.CollectionSlot.update(id, {
        scheduled_at, duration_minutes, capacity, location, deadline, status
      });
      return Response.json({ slot: updated });
    }
    const slot = await base44.asServiceRole.entities.CollectionSlot.create({
      auction_id, scheduled_at,
      duration_minutes: duration_minutes || 30,
      capacity: capacity || 1,
      location: location || '',
      deadline: deadline || null,
      status: status || 'open'
    });
    return Response.json({ slot });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}