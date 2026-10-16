import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { notifyUser } from '../../shared/eventBookings.ts';

// Admin (or moderator) resolves or dismisses a dispute, recording the
// resolution, notes, resolver and timestamp. Both parties are notified.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'moderator')) return Response.json({ error: 'Only admins or moderators may resolve disputes.' }, { status: 403 });
    const body = await req.json();
    const { dispute_id, status, resolution, notes } = body || {};
    if (!dispute_id || !['under_review', 'resolved', 'dismissed'].includes(status)) return Response.json({ error: 'dispute_id and a valid status are required.' }, { status: 400 });
    const d = await base44.asServiceRole.entities.Dispute.get(dispute_id);
    if (!d) return Response.json({ error: 'Dispute not found.' }, { status: 404 });
    const now = new Date().toISOString();
    await base44.asServiceRole.entities.Dispute.update(dispute_id, {
      status,
      resolution: resolution || d.resolution || '',
      resolution_notes: notes || d.resolution_notes || '',
      resolved_by: user.id,
      resolved_at: now
    });
    for (const uid of [d.buyer_id, d.seller_id]) {
      if (uid) await notifyUser(base44.asServiceRole, uid, {
        type: 'dispute_resolved', title: `Dispute ${status.replace('_', ' ')}`,
        body: `Your dispute "${d.subject}" has been ${status}.${resolution ? ' ' + resolution : ''}`,
        link: d.transaction_id ? `/transactions/${d.transaction_id}` : ''
      });
    }
    return Response.json({ success: true, status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}