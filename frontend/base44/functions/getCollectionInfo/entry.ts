import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Returns collection info for a transaction to an authorised party (the buyer,
// the seller, or an admin). Collection slots are admin-only via RLS, so this
// sanitized view is the only public path; capacity per slot is computed from
// active appointments. The buyer may only book once payment is recorded.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const { transaction_id } = body || {};
    if (!transaction_id) return Response.json({ error: 'transaction_id is required.' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(transaction_id);
    if (!tx) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    const isBuyer = tx.buyer_id === user.id;
    const isSeller = tx.seller_id === user.id;
    if (!isBuyer && !isSeller && user.role !== 'admin') return Response.json({ error: 'Not authorised for this transaction.' }, { status: 403 });

    const slotPage = await base44.asServiceRole.entities.CollectionSlot.filter({ auction_id: tx.auction_id, status: 'open' }, { sort: 'scheduled_at', limit: 100 });
    const apptPage = await base44.asServiceRole.entities.CollectionAppointment.filter({ auction_id: tx.auction_id, status: { $in: ['scheduled', 'completed'] } }, { limit: 500 });
    const appts = apptPage.items || [];
    const myAppt = appts.find((a) => a.user_id === user.id && a.transaction_id === transaction_id && a.status === 'scheduled') || null;

    const slots = (slotPage.items || []).map((s) => ({
      id: s.id, scheduled_at: s.scheduled_at, duration_minutes: s.duration_minutes || 30,
      capacity: s.capacity || 1, location: s.location || '', deadline: s.deadline || null,
      status: s.status,
      booked: appts.filter((a) => a.slot_id === s.id && a.status === 'scheduled').reduce((n, a) => n + (a.party_size || 1), 0)
    }));

    return Response.json({
      transaction: { id: tx.id, status: tx.status, payment_deadline: tx.payment_deadline, collection_deadline: tx.collection_deadline, final_price: tx.final_price, total: tx.total },
      slots,
      my_appointment: myAppt ? { id: myAppt.id, slot_id: myAppt.slot_id, scheduled_at: myAppt.scheduled_at, collection_code: myAppt.collection_code, status: myAppt.status, location: myAppt.location, party_size: myAppt.party_size } : null,
      can_book: isBuyer && ['paid', 'ready_for_collection'].includes(tx.status)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}