import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// User requests alternative / exception manual review for their active case.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const body = await req.json();
    const review_type = body && body.review_type === 'exception' ? 'exception' : 'alternative';

    const page = await base44.asServiceRole.entities.VerificationCase.filter(
      { user_id: user.id, verification_status: 'PENDING' },
      { sort: '-created_date', limit: 1 }
    );
    const vcase = (page.items || [])[0];
    if (!vcase) return Response.json({ error: 'No active verification case.' }, { status: 404 });

    await base44.asServiceRole.entities.VerificationCase.update(vcase.id, {
      review_type,
      requires_manual_review: true,
      user_facing_explanation: 'Your case has been queued for alternative manual review. An administrator will assess it and contact you.'
    });

    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id,
      actor_email: user.email || '',
      action: 'manual_review_requested',
      entity_type: 'VerificationCase',
      entity_id: vcase.id,
      details: 'Review type: ' + review_type + '.',
      severity: 'info'
    });

    // Notify admins so manual review requests aren't missed. Surface any
    // send error back to the caller so delivery problems aren't hidden.
    let notify_error = null;
    try {
      const adminsPage = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      const admins = Array.isArray(adminsPage) ? adminsPage : (adminsPage.items || []);
      for (const admin of admins) {
        if (!admin.email) continue;
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          template_name: 'ManualReviewRequested',
          variables: {
            app_name: 'Wolvo',
            user_email: user.email || '',
            review_type_label: review_type === 'exception' ? 'Exception review' : 'Alternative review',
            case_id: vcase.id
          }
        });
      }
    } catch (e) {
      notify_error = e?.message || String(e);
    }

    return Response.json({ success: true, review_type, notify_error });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to request manual review.' }, { status: 500 });
  }
}