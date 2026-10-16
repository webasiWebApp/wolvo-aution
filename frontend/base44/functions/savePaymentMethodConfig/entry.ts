import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { auditPayment, defaultConfig } from '../../shared/payments.ts';

// Admin saves the payment-method configuration (PayID + bank transfer
// instructions, enable flags for all four methods, deadline default, live
// payments master switch). Bank account details are admin-only via RLS and
// are released to a winning bidder only through getPaymentCheckout. Audit
// recorded. Online methods are disabled by default and must not be enabled
// until credentials + a verified webhook are in place.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Only administrators may configure payment methods.' }, { status: 403 });

    const body = await req.json();
    const incoming = body && body.config;
    if (!incoming) return Response.json({ error: 'config is required.' }, { status: 400 });
    // Only known config fields are saved, so record metadata sent back by the
    // client (id, created_date, ...) can never be written over.
    const data = defaultConfig();
    for (const key of Object.keys(data)) {
      if (incoming[key] !== undefined) data[key] = incoming[key];
    }
    data.config_name = 'default';
    data.last_updated_at = new Date().toISOString();
    data.last_updated_by = user.id;
    // Never trust a client claim that live payments are ready — that is set
    // here only when the admin explicitly toggles it.
    data.live_payments_enabled = !!incoming.live_payments_enabled;

    const existing = await base44.asServiceRole.entities.PaymentMethodConfig.filter({ config_name: 'default' }, { limit: 1 });
    const ex = (existing.items || [])[0];
    let saved;
    if (ex) saved = await base44.asServiceRole.entities.PaymentMethodConfig.update(ex.id, data);
    else saved = await base44.asServiceRole.entities.PaymentMethodConfig.create(data);

    await auditPayment(base44.asServiceRole, { payment_id: '', action: 'payment_config_updated', actor_id: user.id, actor_email: user.email || '', details: 'Payment method configuration updated.', severity: 'warning' });
    return Response.json({ success: true, config: saved });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}