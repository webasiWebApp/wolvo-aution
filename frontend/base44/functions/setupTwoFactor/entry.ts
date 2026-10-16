import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import QRCode from 'npm:qrcode@1.5.4';
import { generateSecret, buildOtpauthUri } from '../../shared/totp.ts';

// Begins TOTP setup: generates a unique secret per user, stores it (admin-only,
// never client-readable) in a PENDING state, and returns the otpauth URI + QR
// once so the user can scan with Google/Microsoft Authenticator. The secret is
// never retrievable again through any public API.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const existing = await base44.asServiceRole.entities.TwoFactorStatus.filter({ user_id: user.id }, { limit: 1 });
    const cur = (existing.items || [])[0];
    if (cur && cur.enabled) {
      return Response.json({ error: 'Two-factor authentication is already enabled. Disable it first (with reauthentication) to change your authenticator.' }, { status: 409 });
    }

    const secret = generateSecret(20);
    const label = user.email || user.id;
    const uri = buildOtpauthUri(secret, label, 'Wolvo');
    let qrDataUrl = '';
    try { qrDataUrl = await QRCode.toDataURL(uri, { margin: 1, width: 240 }); } catch (e) { qrDataUrl = ''; }

    const now = new Date().toISOString();
    if (cur) {
      await base44.asServiceRole.entities.TwoFactorStatus.update(cur.id, {
        totp_secret: secret, enabled: false, confirmed: false, method: 'authenticator_app',
        enrolled_at: now, last_used_step: 0, failed_attempts: 0, locked_until: '', recovery_codes: [], recovery_codes_remaining: 0, mfa_verified_until: ''
      });
    } else {
      await base44.asServiceRole.entities.TwoFactorStatus.create({
        user_id: user.id, totp_secret: secret, enabled: false, confirmed: false, method: 'authenticator_app',
        enrolled_at: now, last_used_step: 0, failed_attempts: 0, locked_until: '', recovery_codes: [], recovery_codes_remaining: 0, mfa_verified_until: ''
      });
    }

    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id, actor_email: user.email || '', action: 'totp_setup_started',
      entity_type: 'TwoFactorStatus', entity_id: user.id, details: 'User began TOTP setup.', severity: 'info'
    });

    return Response.json({ secret, otpauth_uri: uri, qr_data_url: qrDataUrl });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to start 2FA setup.' }, { status: 500 });
  }
}