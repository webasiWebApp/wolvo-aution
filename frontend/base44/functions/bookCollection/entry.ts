import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { generateCode, notifyUser } from '../../shared/eventBookings.ts';

// The winning bidder books a collection slot. Enforces that payment has been
// recorded, the slot is open, the booking deadline has not passed, the slot
// is not at capacity, and the buyer has no existing active booking. Issues a
// unique collection confirmation code and notifies the seller.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { transaction_id, slot_id, party_size } = body || {};
    if (!transaction_id || !slot_id) return Response.json({ error: 'transaction_id and slot_id are required.' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(transaction_id);
    if (!tx) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    if (tx.buyer_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Only the winning bidder may book collection.' }, { status: 403 });
    if (!['paid', 'ready_for_collection'].includes(tx.status)) return Response.json({ error: 'Collection can only be booked after payment is recorded.' }, { status: 400 });

    const slot = await base44.asServiceRole.entities.CollectionSlot.get(slot_id);
    if (!slot || slot.auction_id !== tx.auction_id) return Response.json({ error: 'Collection slot not found.' }, { status: 404 });
    if (slot.status !== 'open') return Response.json({ error: 'This collection slot is no longer open.' }, { status: 400 });
    if (slot.deadline && new Date(slot.deadline).getTime() < Date.now()) return Response.json({ error: 'The booking deadline for this slot has passed.' }, { status: 400 });

    const ps = Math.max(1, Math.min(Number(party_size) || 1, 10));
    const existingPage = await base44.asServiceRole.entities.CollectionAppointment.filter({ transaction_id, status: { $in: ['scheduled', 'completed'] } }, { limit: 10 });
    if ((existingPage.items || []).find((a) => a.user_id === user.id && a.status === 'scheduled')) return Response.json({ error: 'You already have a collection booking for this item.' }, { status: 409 });

    const apptPage = await base44.asServiceRole.entities.CollectionAppointment.filter({ slot_id, status: 'scheduled' }, { limit: 500 });
    const booked = (apptPage.items || []).reduce((n, a) => n + (a.party_size || 1), 0);
    if (booked + ps > (slot.capacity || 1)) return Response.json({ error: 'This collection slot is at capacity.', capacity: slot.capacity || 1, booked }, { status: 409 });

    const appt = await base44.entities.CollectionAppointment.create({
      auction_id: tx.auction_id, transaction_id, slot_id, user_id: user.id,
      scheduled_at: slot.scheduled_at, location: slot.location, party_size: ps,
      status: 'scheduled', collection_code: generateCode('COL')
    });

    if (tx.seller_id) await notifyUser(base44.asServiceRole, tx.seller_id, {
      type: 'collection_booked', title: 'Collection booked',
      body: `The buyer has booked collection for ${new Date(slot.scheduled_at).toLocaleString('en-AU')}. Confirmation code ${appt.collection_code}.`,
      link: `/transactions/${transaction_id}`
    });
    return Response.json({ appointment: appt });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}