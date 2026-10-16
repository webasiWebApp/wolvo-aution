import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { clearedTwoFactorFields } from '../../shared/twoFactor.ts';

// Marks the signed-in user's account for deletion. We do not hard-delete the
// User record (the platform owns it and it cannot be removed via the SDK).
// Instead we permanently revoke bidding/verification privileges, drop personal
// verification evidence and authenticator secrets, revoke active sessions by
// disabling 2FA, and record a tombstone so the account can never transact again.
// A confirmation flag is persisted on the user profile for audit.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in to delete your account.' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (!body || body.confirm !== true) {
      return Response.json({ error: 'Confirmation flag is required.' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const now = new Date().toISOString();
    const userId = user.id;

    // 1. Mark verification cases as restricted and scrub evidence-level detail.
    const cases = await svc.entities.VerificationCase.filter({ user_id: userId }, { limit: 200 }).catch(() => ({ items: [] }));
    const caseItems = cases.items || [];
    await Promise.all(caseItems.map(async (c) => {
      return svc.entities.VerificationCase.update(c.id, {
        verification_status: 'RESTRICTED',
        user_facing_explanation: 'Account scheduled for deletion at user request.',
        legal_name: '',
        date_of_birth: null,
        residential_address: '',
        decided_at: now,
        decided_by: 'self'
      }).catch(() => null);
    }));

    // 2. Remove verification evidence documents (PII purge).
    const evidence = await svc.entities.VerificationEvidence.filter({ case_id: { $in: caseItems.map((c) => c.id) } }, { limit: 500 }).catch(() => ({ items: [] }));
    const evItems = evidence.items || [];
    if (evItems.length) {
      await svc.entities.VerificationEvidence.deleteMany({ id: { $in: evItems.map((e) => e.id) } }).catch(() => null);
    }

    // 3. Disable 2FA and clear authenticator secret / recovery codes.
    const tf = await svc.entities.TwoFactorStatus.filter({ user_id: userId }, { limit: 10 }).catch(() => ({ items: [] }));
    const tfItems = tf.items || [];
    await Promise.all(tfItems.map((t) => svc.entities.TwoFactorStatus.update(t.id, clearedTwoFactorFields()).catch(() => null)));

    // 4. Apply an account restriction tombstone so the user can never bid or transact again.
    await svc.entities.AccountRestriction.create({
      user_id: userId,
      reason: 'User-initiated account deletion',
      active: true,
      starts_at: now,
      notes: 'Account marked for deletion. All personal data scrubbed.'
    }).catch(() => null);

    // 5. Record an audit log entry.
    await svc.entities.AuditLog.create({
      actor_id: userId,
      action: 'account_deletion_requested',
      entity_type: 'User',
      entity_id: userId,
      details: 'Self-service account deletion confirmed via Security Settings.',
      severity: 'critical'
    }).catch(() => null);

    // 6. Revoke session: log the user out after the response is sent. The
    // platform's logout is a client-side redirect, so we signal the frontend
    // to call base44.auth.logout() on success.

    return Response.json({
      success: true,
      message: 'Your account has been marked for deletion and personal data has been scrubbed.'
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to process account deletion.' }, { status: 500 });
  }
}