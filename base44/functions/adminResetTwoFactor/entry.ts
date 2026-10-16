import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { clearedTwoFactorFields } from '../../shared/twoFactor.ts';

// Admin-only: resets a user's 2FA after the separate lost-authenticator identity
// re-verification process. The user must set up 2FA again.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await req.json();
    const targetUserId = body && body.user_id;
    if (!targetUserId) return Response.json({ error: 'user_id is required.' }, { status: 400 });

    const page = await base44.asServiceRole.entities.TwoFactorStatus.filter({ user_id: targetUserId }, { limit: 1 });
    const tf = (page.items || [])[0];
    if (!tf) return Response.json({ error: 'No 2FA record found for that user.' }, { status: 404 });

    await base44.asServiceRole.entities.TwoFactorStatus.update(tf.id, clearedTwoFactorFields());

    await base44.asServiceRole.entities.Notification.create({
      user_id: targetUserId, type: 'security', title: 'Two-factor authentication reset by administrator',
      body: 'An administrator reset your two-factor authentication after identity re-verification. Set up 2FA again from Security Settings.', read: false
    });
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id, actor_email: user.email || '', action: 'admin_reset_2fa',
      entity_type: 'TwoFactorStatus', entity_id: targetUserId,
      details: 'Admin reset 2FA after lost-authenticator review.', severity: 'critical'
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to reset 2FA.' }, { status: 500 });
  }
}