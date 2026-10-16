import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { generateRecoveryCodes, hashRecoveryCode } from '../../shared/totp.ts';
import { checkSecondFactor } from '../../shared/twoFactor.ts';

// Generates a fresh set of recovery codes after reauthentication with the current
// authenticator. Previous recovery codes are invalidated. New codes shown once.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const body = await req.json();
    const page = await base44.asServiceRole.entities.TwoFactorStatus.filter({ user_id: user.id }, { limit: 1 });
    const tf = (page.items || [])[0];
    if (!tf || !tf.enabled) return Response.json({ error: 'Two-factor authentication is not enabled.' }, { status: 400 });

    const check = await checkSecondFactor(base44.asServiceRole, tf, body, { allowRecovery: false });
    if (!check.ok) {
      return Response.json({ error: check.error, attempts_remaining: check.attempts_remaining }, { status: check.status });
    }

    const plain = generateRecoveryCodes(10);
    const hashes = await Promise.all(plain.map(hashRecoveryCode));
    await base44.asServiceRole.entities.TwoFactorStatus.update(tf.id, {
      recovery_codes: hashes, recovery_codes_remaining: plain.length
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: 'security', title: 'Recovery codes regenerated',
      body: 'Your two-factor recovery codes were regenerated. Previous codes no longer work.', read: false
    });
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id, actor_email: user.email || '', action: 'recovery_codes_regenerated',
      entity_type: 'TwoFactorStatus', entity_id: user.id, details: 'Recovery codes regenerated after reauth.', severity: 'warning'
    });

    return Response.json({ success: true, recovery_codes: plain });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to regenerate recovery codes.' }, { status: 500 });
  }
}
