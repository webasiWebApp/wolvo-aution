import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { auctionOwnerId } from '../../shared/access.ts';
import { generateCode, notifyUser } from '../../shared/eventBookings.ts';

// A signed-in user requests a viewing for a specific inspection slot. Enforces
// slot capacity (active requested+confirmed appointments, weighted by party
// size), rejects past/closed slots and duplicate requests, and notifies the
// seller. The appointment is created with the user-scoped client so the user
// owns the record (created_by_id) and can read/cancel it later.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to request a viewing.' }, { status: 401 });

    const body = await req.json();
    const { auction_id, slot_id, party_size, notes } = body || {};
    if (!auction_id || !slot_id) return Response.json({ error: 'auction_id and slot_id are required.' }, { status: 400 });

    const auction = await base44.asServiceRole.entities.Auction.get(auction_id);
    if (!auction) return Response.json({ error: 'Auction not found.' }, { status: 404 });
    if (!auction.inspections_available) return Response.json({ error: 'Inspections are not available for this listing.' }, { status: 400 });

    const slot = await base44.asServiceRole.entities.InspectionSlot.get(slot_id);
    if (!slot || slot.auction_id !== auction_id) return Response.json({ error: 'Inspection slot not found.' }, { status: 404 });
    if (slot.status !== 'open') return Response.json({ error: 'This slot is no longer open for bookings.' }, { status: 400 });
    if (new Date(slot.scheduled_at).getTime() < Date.now()) return Response.json({ error: 'This inspection slot has already passed.' }, { status: 400 });

    const ps = Math.max(1, Math.min(Number(party_size) || 1, 10));
    const activePage = await base44.asServiceRole.entities.ViewingAppointment.filter(
      { slot_id, status: { $in: ['requested', 'confirmed'] } }, { limit: 500 }
    );
    const active = activePage.items || [];
    const booked = active.reduce((n, a) => n + (a.party_size || 1), 0);
    if (booked + ps > (slot.capacity || 1)) {
      return Response.json({
        error: 'This slot is at capacity. Please choose another time.',
        capacity: slot.capacity || 1, booked
      }, { status: 409 });
    }
    if (active.find((a) => a.user_id === user.id)) {
      return Response.json({ error: 'You already have a viewing request for this slot.' }, { status: 409 });
    }

    const appointment = await base44.entities.ViewingAppointment.create({
      auction_id,
      slot_id,
      user_id: user.id,
      requested_slot: slot.scheduled_at,
      party_size: ps,
      notes: notes || '',
      status: 'requested',
      booking_code: generateCode('WV'),
      check_in_status: 'pending',
      address_released: false
    });

    await notifyUser(base44.asServiceRole, auctionOwnerId(auction), {
      type: 'viewing_requested',
      title: 'New viewing request',
      body: `A viewing request was submitted for "${auction.title}" (party of ${ps}). Approve to release the address.`,
      link: '/auctioneer'
    });

    return Response.json({ appointment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}