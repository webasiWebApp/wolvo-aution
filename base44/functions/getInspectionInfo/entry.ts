import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Public lookup used by the inspection panel on a listing. Returns sanitized
// inspection slots (NO full_address) plus aggregate counts. The exact property
// address is never returned here — it is released only to an approved attendee
// via decideViewing. Anyone may call this; it reads via the service role and
// strips the private address field.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const auctionId = body && body.auction_id;
    if (!auctionId) return Response.json({ error: 'auction_id required' }, { status: 400 });

    const auction = await base44.asServiceRole.entities.Auction.get(auctionId);
    if (!auction) return Response.json({ error: 'Auction not found' }, { status: 404 });

    const slotPage = await base44.asServiceRole.entities.InspectionSlot.filter(
      { auction_id: auctionId }, { sort: 'scheduled_at', limit: 100 }
    );
    const slots = (slotPage.items || [])
      .filter((s) => s.status !== 'cancelled')
      .map((s) => ({
        id: s.id,
        scheduled_at: s.scheduled_at,
        duration_minutes: s.duration_minutes || 60,
        capacity: s.capacity || 1,
        location_hint: s.location_hint || '',
        status: s.status || 'open'
      }));

    const [interested, confirmed, completed] = await Promise.all([
      base44.asServiceRole.entities.ViewingAppointment.count({ auction_id: auctionId, status: 'requested' }),
      base44.asServiceRole.entities.ViewingAppointment.count({ auction_id: auctionId, status: 'confirmed' }),
      base44.asServiceRole.entities.ViewingAppointment.count({ auction_id: auctionId, check_in_status: 'checked_in' })
    ]);

    return Response.json({
      inspections_available: !!auction.inspections_available,
      slots,
      stats: { interested: interested || 0, confirmed: confirmed || 0, completed: completed || 0 }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}