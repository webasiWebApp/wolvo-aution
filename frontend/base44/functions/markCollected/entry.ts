import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { isStaff, canOperateAuction } from '../../shared/access.ts';
import { notifyUser } from '../../shared/eventBookings.ts';

// Authorised seller/staff (admin, or the auctioneer assigned to the auction)
// marks a booked item as collected. Records the time and the staff member, sets
// the appointment to completed, and — if the transaction was paid — marks the
// transaction completed. The buyer is notified.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isStaff(user)) return Response.json({ error: 'Only authorised sellers or staff may mark an item collected.' }, { status: 403 });

    const body = await req.json();
    const { appointment_id } = body || {};
    if (!appointment_id) return Response.json({ error: 'appointment_id is required.' }, { status: 400 });

    const appt = await base44.asServiceRole.entities.CollectionAppointment.get(appointment_id);
    if (!appt) return Response.json({ error: 'Booking not found.' }, { status: 404 });
    if (appt.status !== 'scheduled') return Response.json({ error: 'This booking is no longer active.' }, { status: 400 });
    if (user.role === 'auctioneer') {
      const auction = await base44.asServiceRole.entities.Auction.get(appt.auction_id).catch(() => null);
      if (!canOperateAuction(user, auction)) return Response.json({ error: 'You are not the assigned auctioneer.' }, { status: 403 });
    }

    const now = new Date().toISOString();
    await base44.asServiceRole.entities.CollectionAppointment.update(appointment_id, {
      status: 'completed', collected_at: now, collected_by: user.id
    });

    if (appt.transaction_id) {
      const tx = await base44.asServiceRole.entities.CompletedTransaction.get(appt.transaction_id).catch(() => null);
      if (tx && ['paid', 'ready_for_collection'].includes(tx.status)) {
        await base44.asServiceRole.entities.CompletedTransaction.update(appt.transaction_id, { status: 'completed', completed_at: now });
      }
      if (tx) await notifyUser(base44.asServiceRole, tx.buyer_id, {
        type: 'collection_completed', title: 'Item collected',
        body: `Your item has been marked as collected. Thank you for using Wolvo.`,
        link: `/transactions/${appt.transaction_id}`
      });
    }
    return Response.json({ success: true, status: 'completed', collected_at: now });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}