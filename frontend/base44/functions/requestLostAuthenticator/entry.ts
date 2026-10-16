import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// User submits a lost-authenticator request. This does NOT reset 2FA — it logs
// the request for a separate admin identity re-verification process.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const body = await req.json();
    const reason = (body && body.reason || '').slice(0, 500);

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: 'security', title: 'Lost-authenticator request submitted',
      body: 'Your request to reset two-factor authentication has been logged. An administrator will review it after identity re-verification.', read: false
    });
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id, actor_email: user.email || '', action: 'lost_authenticator_requested',
      entity_type: 'TwoFactorStatus', entity_id: user.id,
      details: 'User requested lost-authenticator recovery. Reason: ' + reason, severity: 'critical'
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to submit request.' }, { status: 500 });
  }
}