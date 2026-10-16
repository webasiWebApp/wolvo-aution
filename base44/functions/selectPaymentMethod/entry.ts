import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getConfig, generateReference, methodEnabled, auditPayment, STATUS_LABEL, SETTLED_STATUSES } from '../../shared/payments.ts';

// The winning bidder chooses a payment method. For manual methods this locks
// the choice and returns the admin-configured instructions + the unique
// customer reference. For online methods it records the choice; the actual
// charge is initiated by the dedicated provider function (which requires
// credentials). The amount is never changeable here.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in.' }, { status: 401 });
    const body = await req.json();
    const { transaction_id, method } = body || {};
    if (!transaction_id || !method) return Response.json({ error: 'transaction_id and method are required.' }, { status: 400 });
    if (!['stripe', 'paypal', 'payid', 'bank_transfer'].includes(method)) return Response.json({ error: 'Unknown payment method.' }, { status: 400 });

    const tx = await base44.asServiceRole.entities.CompletedTransaction.get(transaction_id);
    if (!tx) return Response.json({ error: 'Transaction not found.' }, { status: 404 });
    if (tx.buyer_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Not authorised.' }, { status: 403 });
    if (['paid', 'ready_for_collection', 'completed'].includes(tx.status)) return Response.json({ error: 'This transaction is already paid.' }, { status: 400 });
    if (tx.status === 'cancelled') return Response.json({ error: 'This transaction was cancelled.' }, { status: 400 });

    const config = await getConfig(base44.asServiceRole);
    if (!methodEnabled(config, method)) return Response.json({ error: 'This payment method is not available.' }, { status: 400 });

    const amount = tx.total || tx.final_price || 0;
    const deadline = tx.payment_deadline || new Date(Date.now() + (config.default_payment_deadline_days || 3) * 86400000).toISOString();
    const pPage = await base44.asServiceRole.entities.Payment.filter({ transaction_id }, { sort: '-created_date', limit: 1 });
    let payment = (pPage.items || [])[0];
    const ref = (payment && payment.payment_reference) || generateReference();

    let instructions = null;
    if (method === 'payid') instructions = { type: 'payid', alias: config.payid_alias, name: config.payid_name, reference: ref, amount, notes: config.payid_instructions };
    else if (method === 'bank_transfer') instructions = { type: 'bank_transfer', bank_name: config.bank_name, account_name: config.bank_account_name, bsb: config.bank_bsb, account_number: config.bank_account_number, reference: ref, amount, notes: config.bank_instructions };
    const snapshot = instructions ? JSON.stringify(instructions) : '';

    if (!payment) {
      payment = await base44.asServiceRole.entities.Payment.create({
        auction_id: tx.auction_id, transaction_id, user_id: tx.buyer_id,
        amount, currency: 'AUD', payment_method: method, status: 'awaiting_payment',
        payment_reference: ref, customer_reference: ref, deadline, instructions_snapshot: snapshot,
        description: `Buyer selected ${method}.`
      });
    } else {
      if (SETTLED_STATUSES.includes(payment.status)) return Response.json({ error: 'Payment already in progress or paid.' }, { status: 400 });
      await base44.asServiceRole.entities.Payment.update(payment.id, { payment_method: method, customer_reference: ref, deadline, instructions_snapshot: snapshot, status: 'awaiting_payment' });
    }
    await base44.asServiceRole.entities.CompletedTransaction.update(transaction_id, { payment_method: method, payment_reference: ref, payment_deadline: deadline });
    await auditPayment(base44.asServiceRole, { payment_id: payment.id, action: 'payment_method_selected', actor_id: user.id, actor_email: user.email || '', details: `Buyer selected ${method} for transaction ${transaction_id.slice(-8)}.` });

    return Response.json({ method, reference: ref, deadline, amount, instructions, status: 'awaiting_payment', status_label: STATUS_LABEL['awaiting_payment'], online: method === 'stripe' || method === 'paypal' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}