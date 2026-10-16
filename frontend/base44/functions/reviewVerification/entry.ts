import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getActivePolicy, evaluateCase, buildUserExplanation } from '../../shared/verificationScoring.ts';

// Admin reviews a verification case and records a decision. Will refuse to
// mark VERIFIED unless the required combination is met AND (when a provider
// is configured) external verification has passed. Police clearance never
// independently establishes identity or address.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required.' }, { status: 403 });

    const body = await req.json();
    const case_id = body && body.case_id;
    const decision = body && body.decision;
    if (!case_id || !['VERIFIED', 'REJECTED', 'RESTRICTED'].includes(decision)) {
      return Response.json({ error: 'case_id and a valid decision (VERIFIED, REJECTED, RESTRICTED) are required.' }, { status: 400 });
    }

    const vcase = await base44.asServiceRole.entities.VerificationCase.get(case_id);
    if (!vcase) return Response.json({ error: 'Case not found.' }, { status: 404 });

    const policy = await getActivePolicy(base44.asServiceRole);
    const evPage = await base44.asServiceRole.entities.VerificationEvidence.filter({ case_id }, { sort: 'created_date', limit: 200 });
    const evaluation = evaluateCase(
      evPage.items || [],
      policy,
      { legal_name: vcase.legal_name, date_of_birth: vcase.date_of_birth, residential_address: vcase.residential_address }
    );

    // Matching-rule flags must be resolved before a case can be verified.
    const flagPage = await base44.asServiceRole.entities.VerificationFlag.filter({ case_id }, { limit: 200 });
    const blockingFlags = (flagPage.items || []).filter((f) => !f.resolved && (
      f.severity === 'high' || f.flag_type === 'conflicting_address'
    ));

    let externalStatus = vcase.external_verification_status || 'not_required';
    let providerVerified = !!vcase.provider_verified;
    if (body && body.external_verification === 'passed') { externalStatus = 'passed'; providerVerified = true; }
    if (body && body.external_verification === 'failed') { externalStatus = 'failed'; providerVerified = false; }

    if (decision === 'VERIFIED') {
      const extOk = policy && policy.provider_enabled ? externalStatus === 'passed' : true;
      const isException = (vcase.review_type === 'alternative' || vcase.review_type === 'exception');
      // Standard review requires the full evidence combination. Alternative /
      // exception review lets an admin verify a non-standard combination, but
      // never while unresolved matching-rule or fraud flags remain.
      if (!extOk) {
        return Response.json({
          error: 'Cannot verify: external identity verification has not passed.',
          combination_met: evaluation.combination_met,
          external_verification_status: externalStatus
        }, { status: 400 });
      }
      if (blockingFlags.length) {
        return Response.json({
          error: 'Cannot verify: unresolved matching or fraud flags remain (' + blockingFlags.map((f) => f.flag_type).join(', ') + ').',
          flags: blockingFlags.map((f) => f.flag_type)
        }, { status: 400 });
      }
      if (!isException && !evaluation.combination_met) {
        return Response.json({
          error: 'Cannot verify: required evidence combination or point target not met.',
          combination_met: evaluation.combination_met,
          total_points: evaluation.total_points
        }, { status: 400 });
      }
      // Alternative / exception review may use a non-standard combination, but
      // a primary identity document must still be present — a police clearance
      // or address evidence alone can never establish identity.
      if (isException && !evaluation.has_primary_identity) {
        return Response.json({
          error: 'Cannot verify under alternative review without at least one primary identity document.',
          has_primary_identity: false
        }, { status: 400 });
      }
    }

    const now = new Date().toISOString();
    const reviewType = (body && body.review_type) || vcase.review_type || 'standard';
    const rejectionReason = decision === 'REJECTED'
      ? ((body && body.rejection_reason) || 'Verification was not approved. Please review the requested evidence and resubmit.')
      : '';
    const userExplanation = decision === 'VERIFIED'
      ? 'Your identity has been verified. You may now bid once two-factor authentication is enabled.'
      : (rejectionReason || buildUserExplanation(evaluation, policy));

    await base44.asServiceRole.entities.VerificationCase.update(case_id, {
      verification_status: decision,
      decided_at: now,
      decided_by: user.id,
      review_type: reviewType,
      requires_manual_review: decision !== 'VERIFIED',
      external_verification_status: externalStatus,
      provider_verified: providerVerified,
      rejection_reason: rejectionReason,
      user_facing_explanation: userExplanation
    });

    if (body && body.note) {
      await base44.asServiceRole.entities.VerificationReviewNote.create({
        case_id,
        admin_id: user.id,
        note: body.note,
        review_type: reviewType,
        categories_reviewed: (body && body.categories_reviewed) || ''
      });
    }

    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id,
      actor_email: user.email || '',
      action: 'verification_decision',
      entity_type: 'VerificationCase',
      entity_id: case_id,
      details: 'Decision: ' + decision + '. Combination met: ' + evaluation.combination_met + '. External: ' + externalStatus + '.',
      severity: decision === 'RESTRICTED' ? 'critical' : 'warning'
    });

    // Notify the bidder of the decision so they do not have to refresh to learn
    // the outcome. Only registered app users can be emailed.
    try {
      const uPage = await base44.asServiceRole.entities.User.filter({ id: vcase.user_id }, { limit: 1, fields: ['email', 'full_name'] });
      const u = (uPage.items && uPage.items[0]) || (Array.isArray(uPage) && uPage[0]);
      if (u && u.email) {
        const decisionLabel = decision === 'VERIFIED' ? 'approved' : decision === 'RESTRICTED' ? 'restricted' : 'not approved';
        const first_name = (u.full_name || '').split(' ')[0] || 'there';
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          template_name: 'VerificationDecision',
          variables: {
            first_name,
            decision_label: decisionLabel,
            explanation: userExplanation,
            app_name: 'Wolvo'
          }
        });
      }
    } catch (_e) { /* email failure must not roll back the decision */ }

    return Response.json({
      success: true,
      decision,
      combination_met: evaluation.combination_met,
      total_points: evaluation.total_points
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to review verification.' }, { status: 500 });
  }
}