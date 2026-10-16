import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { checkSecondFactor } from '../../shared/twoFactor.ts';

const SESSION_MINUTES = 10;

// Validates a TOTP code (or single-use recovery code) server-side. On success
// marks an MFA-verified session window that sensitive backend actions require.
// Lockout rate limiting and replay prevention live in shared/twoFactor.ts.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const body = await req.json();
    const page = await base44.asServiceRole.entities.TwoFactorStatus.filter({ user_id: user.id }, { limit: 1 });
    const tf = (page.items || [])[0];
    if (!tf || !tf.enabled) return Response.json({ error: 'Two-factor authentication is not enabled.' }, { status: 400 });

    const check = await checkSecondFactor(base44.asServiceRole, tf, body);
    if (!check.ok) {
      return Response.json({ error: check.error, attempts_remaining: check.attempts_remaining }, { status: check.status });
    }

    const validUntil = new Date(Date.now() + SESSION_MINUTES * 60 * 1000).toISOString();
    await base44.asServiceRole.entities.TwoFactorStatus.update(tf.id, { mfa_verified_until: validUntil });

    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id, actor_email: user.email || '',
      action: check.usedRecovery ? 'totp_recovery_used' : 'totp_verified',
      entity_type: 'TwoFactorStatus', entity_id: user.id,
      details: check.usedRecovery ? 'Recovery code used to verify.' : 'TOTP verified.', severity: 'info'
    });

    return Response.json({ success: true, verified: true, recovery_used: check.usedRecovery, valid_until: validUntil });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to verify.' }, { status: 500 });
  }
}
