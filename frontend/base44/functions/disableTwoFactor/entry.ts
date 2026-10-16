import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { checkSecondFactor, clearedTwoFactorFields } from '../../shared/twoFactor.ts';

// Disables 2FA only after reauthentication (a valid authenticator or recovery code).
// Failed attempts count toward the shared lockout, so this endpoint cannot be
// used to brute-force a code. Password resets never touch this record, so
// resetting a password does not disable 2FA.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const body = await req.json();
    const page = await base44.asServiceRole.entities.TwoFactorStatus.filter({ user_id: user.id }, { limit: 1 });
    const tf = (page.items || [])[0];
    if (!tf || !tf.enabled) return Response.json({ error: 'Two-factor authentication is not enabled.' }, { status: 400 });

    const check = await checkSecondFactor(base44.asServiceRole, tf, body, {
      invalidMessage: 'Reauthentication failed. Enter a valid authenticator or recovery code to disable 2FA.'
    });
    if (!check.ok) {
      return Response.json({ error: check.error, attempts_remaining: check.attempts_remaining }, { status: check.status });
    }

    await base44.asServiceRole.entities.TwoFactorStatus.update(tf.id, clearedTwoFactorFields());

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: 'security', title: 'Two-factor authentication disabled',
      body: 'Two-factor authentication has been turned off. If this was not you, contact support immediately.', read: false
    });
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id, actor_email: user.email || '', action: 'totp_disabled',
      entity_type: 'TwoFactorStatus', entity_id: user.id, details: 'User disabled TOTP after reauth.', severity: 'critical'
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to disable 2FA.' }, { status: 500 });
  }
}
