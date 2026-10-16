import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Admin-only: saves the default pricing config and records every change to the
// audit log. All fee fields default to disabled/$0, so the launch configuration
// charges nothing. No fee is activated unless an admin explicitly enables it.
const FEE_FIELDS = [
  'registration_free', 'browsing_free', 'bidding_free', 'verification_free', 'attendance_free',
  'buyer_registration_fee_enabled', 'buyer_registration_fee_amount',
  'seller_registration_fee_enabled', 'seller_registration_fee_amount',
  'listing_fee_enabled', 'listing_fee_amount',
  'bidding_fee_enabled', 'bidding_fee_amount',
  'viewing_booking_fee_enabled', 'viewing_booking_fee_amount',
  'attendance_registration_fee_enabled', 'attendance_registration_fee_amount',
  'verification_fee_enabled', 'verification_fee_amount',
  'notifications_fee_enabled', 'notifications_fee_amount',
  'commission_enabled', 'commission_percent',
  'featured_listing_fee_enabled', 'featured_listing_fee_amount',
  'subscription_enabled', 'subscription_monthly_amount', 'subscription_yearly_amount',
  'premium_auction_management_enabled', 'premium_auction_management_amount',
  'notes'
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Only admins may change pricing.' }, { status: 403 });

    const body = await req.json();
    const incoming = body && body.config;
    if (!incoming || typeof incoming !== 'object') return Response.json({ error: 'config is required.' }, { status: 400 });

    const page = await base44.asServiceRole.entities.PricingConfig.filter({ config_name: 'default' }, { limit: 1 });
    let current = (page.items || [])[0] || null;

    const updates = {};
    const changes = [];
    for (const f of FEE_FIELDS) {
      if (incoming[f] === undefined) continue;
      const newVal = incoming[f];
      const oldVal = current ? current[f] : undefined;
      if (oldVal !== newVal) {
        updates[f] = newVal;
        changes.push(`${f}: ${JSON.stringify(oldVal)} -> ${JSON.stringify(newVal)}`);
      }
    }

    const stamp = { last_updated_at: new Date().toISOString(), last_updated_by: user.email || user.id };
    let saved;
    if (!current) {
      saved = await base44.asServiceRole.entities.PricingConfig.create({ config_name: 'default', ...updates, ...stamp });
    } else {
      saved = await base44.asServiceRole.entities.PricingConfig.update(current.id, { ...updates, ...stamp });
    }

    if (changes.length) {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_id: user.id, actor_email: user.email || '',
        action: 'pricing_config_updated', entity_type: 'PricingConfig', entity_id: saved.id,
        details: changes.join('; ').slice(0, 1900),
        severity: 'warning'
      });
    }
    return Response.json({ success: true, config: saved, changes: changes.length });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to save pricing config.' }, { status: 500 });
  }
}