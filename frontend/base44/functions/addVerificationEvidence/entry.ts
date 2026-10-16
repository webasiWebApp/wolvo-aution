import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { getActivePolicy, evaluateCase, buildUserExplanation } from '../../shared/verificationScoring.ts';

// Records one piece of evidence for the user's active case, recomputes the
// 100-point score, flags mismatches/duplicates/expiry, and updates the case.
// Evidence files are uploaded privately by the client (UploadPrivateFile);
// the client passes the resulting file_uri here. OCR/provider extraction is
// NOT treated as proof of authenticity — verification_method stays
// "awaiting_external" until an external provider or admin review confirms.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in.' }, { status: 401 });

    const body = await req.json();
    const file_uri = body && body.file_uri;
    const file_name = (body && body.file_name) || '';
    const document_type = body && body.document_type;
    if (!file_uri || !document_type) return Response.json({ error: 'file_uri and document_type are required.' }, { status: 400 });

    const casePage = await base44.asServiceRole.entities.VerificationCase.filter(
      { user_id: user.id, verification_status: 'PENDING' },
      { sort: '-created_date', limit: 1 }
    );
    const vcase = (casePage.items || [])[0];
    if (!vcase) return Response.json({ error: 'No active verification case. Submit verification details first.' }, { status: 404 });

    const policy = await getActivePolicy(base44.asServiceRole);
    if (!policy) return Response.json({ error: 'Scoring policy is not configured.' }, { status: 500 });

    const cat = (policy.categories || []).find((c) => c.key === document_type);
    const pointsAwarded = cat ? (cat.points || 0) : 0;

    // User-scoped create so created_by_id = owner (RLS read works for the owner).
    const evidence = await base44.entities.VerificationEvidence.create({
      case_id: vcase.id,
      user_id: user.id,
      file_uri,
      file_name,
      document_type,
      category_group: cat ? cat.group : '',
      points_awarded: pointsAwarded,
      extracted_name: (body && body.extracted_name) || '',
      extracted_dob: (body && body.extracted_dob) || '',
      extracted_address: (body && body.extracted_address) || '',
      expiry_date: (body && body.expiry_date) || '',
      document_reference: (body && body.document_reference) || '',
      verification_method: 'awaiting_external',
      provider_verified: false,
      is_duplicate: false,
      status: 'pending_review',
      uploaded_at: new Date().toISOString()
    });

    const evPage = await base44.asServiceRole.entities.VerificationEvidence.filter(
      { case_id: vcase.id },
      { sort: 'created_date', limit: 200 }
    );
    const evaluation = evaluateCase(
      evPage.items || [],
      policy,
      { legal_name: vcase.legal_name, date_of_birth: vcase.date_of_birth, residential_address: vcase.residential_address }
    );

    // Mark duplicate evidence (service role bypasses admin-only update RLS).
    for (const did of evaluation.duplicates) {
      await base44.asServiceRole.entities.VerificationEvidence.update(did, { is_duplicate: true, status: 'duplicate' });
    }

    // Refresh flags for this case.
    await base44.asServiceRole.entities.VerificationFlag.deleteMany({ case_id: vcase.id });
    if (evaluation.flags.length) {
      await base44.asServiceRole.entities.VerificationFlag.bulkCreate(
        evaluation.flags.map((f) => ({
          case_id: vcase.id,
          evidence_id: f.evidence_id || '',
          flag_type: f.flag_type,
          details: f.details,
          severity: f.severity,
          resolved: false
        }))
      );
    }

    const explanation = buildUserExplanation(evaluation, policy);
    await base44.asServiceRole.entities.VerificationCase.update(vcase.id, {
      total_points: evaluation.total_points,
      has_primary_identity: evaluation.has_primary_identity,
      has_address_evidence: evaluation.has_address_evidence,
      combination_met: evaluation.combination_met,
      user_facing_explanation: explanation
    });

    return Response.json({
      success: true,
      evidence_id: evidence.id,
      total_points: evaluation.total_points,
      has_primary_identity: evaluation.has_primary_identity,
      has_address_evidence: evaluation.has_address_evidence,
      combination_met: evaluation.combination_met,
      explanation
    });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to add evidence.' }, { status: 500 });
  }
}