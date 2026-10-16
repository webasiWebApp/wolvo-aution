import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getActivePolicy, evaluateCase, buildUserExplanation } from '../../shared/verificationScoring.ts';

// Returns the user's verification status with a sanitized view (no fraud
// flags, no internal review notes, no extracted document text). The owner
// receives file_uri so they can view their own uploaded evidence.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const page = await base44.asServiceRole.entities.VerificationCase.filter(
      { user_id: user.id },
      { sort: '-created_date', limit: 1 }
    );
    const vcase = (page.items || [])[0];
    if (!vcase) {
      return Response.json({ has_case: false, verification_status: 'UNVERIFIED', explanation: 'You have not started identity verification.' });
    }

    const policy = await getActivePolicy(base44.asServiceRole);
    const evPage = await base44.asServiceRole.entities.VerificationEvidence.filter({ case_id: vcase.id }, { sort: 'created_date', limit: 200 });
    const evaluation = evaluateCase(
      evPage.items || [],
      policy,
      { legal_name: vcase.legal_name, date_of_birth: vcase.date_of_birth, residential_address: vcase.residential_address }
    );
    const explanation = vcase.verification_status === 'PENDING'
      ? buildUserExplanation(evaluation, policy)
      : (vcase.user_facing_explanation || buildUserExplanation(evaluation, policy));

    const evidence = (evPage.items || []).map((e) => ({
      id: e.id,
      document_type: e.document_type,
      status: e.status,
      is_duplicate: !!e.is_duplicate,
      points_awarded: e.points_awarded,
      uploaded_at: e.uploaded_at,
      file_uri: e.file_uri,
      file_name: e.file_name
    }));

    return Response.json({
      has_case: true,
      case_id: vcase.id,
      verification_status: vcase.verification_status,
      review_type: vcase.review_type,
      requires_manual_review: !!vcase.requires_manual_review,
      total_points: evaluation.total_points,
      has_primary_identity: evaluation.has_primary_identity,
      has_address_evidence: evaluation.has_address_evidence,
      combination_met: evaluation.combination_met,
      two_factor_required: true,
      explanation,
      evidence
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to load verification status.' }, { status: 500 });
  }
}