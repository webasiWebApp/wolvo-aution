import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { auditPayment, STATUS_LABEL } from '../../shared/payments.ts';

// Issue a refund. For manual payments the admin records the refund status
// against the order (full -> refunded, partial -> partially_refunded) with an
// audit trail. Several partial refunds may be recorded until the full amount
// has been returned; the refund can never exceed what remains. Online payments
// (Stripe/PayPal) MUST be refunded through the provider's API with credentials
// — a manual status change is rejected so a buyer can never be shown a fake refund.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Only administrators may issue refunds.' }, { status: 403 });

    const body = await req.json();
    const { payment_id, amount, reason } = body || {};
    if (!payment_id) return Response.json({ error: 'payment_id is required.' }, { status: 400 });
    const payment = await base44.asServiceRole.entities.Payment.get(payment_id);
    if (!payment) return Response.json({ error: 'Payment record not found.' }, { status: 404 });
    if (!['paid', 'partially_refunded'].includes(payment.status)) return Response.json({ error: 'Only paid payments can be refunded.' }, { status: 400 });
    if (['stripe', 'paypal'].includes(payment.payment_method)) {
      return Response.json({ error: 'Online refunds must be processed through the provider integration (requires credentials and a verified API call). Manual status changes are not permitted for online payments.', requires_provider: true }, { status: 400 });
    }

    const alreadyRefunded = payment.refunded_amount || 0;
    const remaining = Math.max(0, (payment.amount || 0) - alreadyRefunded);
    const hasAmount = amount !== undefined && amount !== null && amount !== '';
    const refundAmt = hasAmount ? Number(amount) : remaining;
    if (!Number.isFinite(refundAmt) || refundAmt <= 0) return Response.json({ error: 'Refund amount must be greater than zero.' }, { status: 400 });
    if (refundAmt > remaining) return Response.json({ error: `Refund cannot exceed the remaining $${remaining}.`, remaining }, { status: 400 });

    const totalRefunded = alreadyRefunded + refundAmt;
    const full = totalRefunded >= (payment.amount || 0);
    const newStatus = full ? 'refunded' : 'partially_refunded';
    await base44.asServiceRole.entities.Payment.update(payment_id, {
      status: newStatus,
      refund_status: full ? 'refunded' : 'partial',
      refunded_amount: totalRefunded
    });
    await auditPayment(base44.asServiceRole, { payment_id, action: 'refund_issued', actor_id: user.id, actor_email: user.email || '', details: `${full ? 'Full' : 'Partial'} refund of $${refundAmt} issued (total refunded $${totalRefunded}). Reason: ${reason || 'n/a'}`, severity: 'warning' });
    return Response.json({ success: true, status: newStatus, status_label: STATUS_LABEL[newStatus], refunded_amount: totalRefunded });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
