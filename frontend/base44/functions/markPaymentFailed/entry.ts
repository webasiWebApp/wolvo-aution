import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { auditPayment, SETTLED_STATUSES } from '../../shared/payments.ts';

// Admin marks a payment Failed or Expired (e.g. deadline passed, funds never
// arrived, online charge declined). A paid, in-progress or refunded payment can
// never be failed here.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Only administrators may change payment status manually.' }, { status: 403 });

    const body = await req.json();
    const { payment_id, status, reason } = body || {};
    if (!payment_id) return Response.json({ error: 'payment_id is required.' }, { status: 400 });
    if (!['failed', 'expired'].includes(status)) return Response.json({ error: 'status must be failed or expired.' }, { status: 400 });

    const payment = await base44.asServiceRole.entities.Payment.get(payment_id);
    if (!payment) return Response.json({ error: 'Payment record not found.' }, { status: 404 });
    if (SETTLED_STATUSES.includes(payment.status)) return Response.json({ error: 'Cannot fail a payment that is paid, in progress or refunded.' }, { status: 400 });

    await base44.asServiceRole.entities.Payment.update(payment_id, { status, failure_reason: reason || '' });
    await auditPayment(base44.asServiceRole, { payment_id, action: 'payment_marked_' + status, actor_id: user.id, actor_email: user.email || '', details: `Payment marked ${status}. Reason: ${reason || 'n/a'}`, severity: 'warning' });
    return Response.json({ success: true, status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}