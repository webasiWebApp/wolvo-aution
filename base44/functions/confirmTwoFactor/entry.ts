import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { generateRecoveryCodes, hashRecoveryCode } from '../../shared/totp.ts';
import { checkSecondFactor } from '../../shared/twoFactor.ts';

// Confirms TOTP setup with a valid 6-digit code, enables 2FA, and returns the
// single-use recovery codes ONCE. Enforces replay prevention and lockout.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const body = await req.json();
    const page = await base44.asServiceRole.entities.TwoFactorStatus.filter({ user_id: user.id }, { limit: 1 });
    const tf = (page.items || [])[0];
    if (!tf || !tf.totp_secret) return Response.json({ error: 'No 2FA setup in progress. Start setup first.' }, { status: 404 });

    const check = await checkSecondFactor(base44.asServiceRole, tf, body, { allowRecovery: false });
    if (!check.ok) {
      return Response.json({ error: check.error, attempts_remaining: check.attempts_remaining }, { status: check.status });
    }

    const plainCodes = generateRecoveryCodes(10);
    const hashes = await Promise.all(plainCodes.map(hashRecoveryCode));
    await base44.asServiceRole.entities.TwoFactorStatus.update(tf.id, {
      enabled: true, confirmed: true, enrolled_at: new Date().toISOString(),
      recovery_codes: hashes, recovery_codes_remaining: plainCodes.length,
      mfa_verified_until: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: 'security', title: 'Two-factor authentication enabled',
      body: 'Two-factor authentication is now active on your account.', read: false
    });
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id, actor_email: user.email || '', action: 'totp_enabled',
      entity_type: 'TwoFactorStatus', entity_id: user.id, details: 'User confirmed TOTP setup.', severity: 'warning'
    });

    return Response.json({ success: true, recovery_codes: plainCodes });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to confirm 2FA.' }, { status: 500 });
  }
}
