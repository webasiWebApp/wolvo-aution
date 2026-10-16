import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Returns the user's 2FA status without ever exposing the secret or recovery codes.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const page = await base44.asServiceRole.entities.TwoFactorStatus.filter({ user_id: user.id }, { limit: 1 });
    const tf = (page.items || [])[0];
    if (!tf) {
      return Response.json({ enabled: false, confirmed: false, mfa_verified: false, recovery_codes_remaining: 0, setup_in_progress: false });
    }
    const verified = !!tf.mfa_verified_until && new Date(tf.mfa_verified_until).getTime() > Date.now();
    return Response.json({
      enabled: !!tf.enabled,
      confirmed: !!tf.confirmed,
      method: tf.method,
      enrolled_at: tf.enrolled_at,
      mfa_verified: verified,
      mfa_verified_until: tf.mfa_verified_until,
      recovery_codes_remaining: tf.recovery_codes_remaining || 0,
      locked: !!(tf.locked_until && new Date(tf.locked_until).getTime() > Date.now()),
      setup_in_progress: !!tf.totp_secret && !tf.enabled
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to load 2FA status.' }, { status: 500 });
  }
}