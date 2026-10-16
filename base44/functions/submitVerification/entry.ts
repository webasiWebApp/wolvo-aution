import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Creates a verification case with the user's declared identity details.
// One active (PENDING/UNVERIFIED) case per user. A verified user cannot open a
// new case (it would replace their verified status), and a restricted user
// cannot submit their way out of an admin restriction.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'You must be signed in to submit verification.' }, { status: 401 });

    const body = await req.json();
    const legal_name = (body && body.legal_name || '').trim();
    const date_of_birth = (body && body.date_of_birth || '').trim();
    const residential_address = (body && body.residential_address || '').trim();
    if (!legal_name || !date_of_birth || !residential_address) {
      return Response.json({ error: 'Legal name, date of birth and residential address are required.' }, { status: 400 });
    }

    const latestPage = await base44.asServiceRole.entities.VerificationCase.filter(
      { user_id: user.id },
      { sort: '-created_date', limit: 1 }
    );
    const latest = (latestPage.items || [])[0];
    if (latest && ['PENDING', 'UNVERIFIED'].includes(latest.verification_status)) {
      return Response.json({ error: 'You already have a verification case in progress.', case_id: latest.id }, { status: 409 });
    }
    if (latest && latest.verification_status === 'VERIFIED') {
      return Response.json({ error: 'Your identity is already verified.', case_id: latest.id }, { status: 409 });
    }
    if (latest && latest.verification_status === 'RESTRICTED') {
      return Response.json({ error: 'Your account is restricted. Please contact support.' }, { status: 403 });
    }

    const created = await base44.asServiceRole.entities.VerificationCase.create({
      user_id: user.id,
      legal_name,
      date_of_birth,
      residential_address,
      verification_status: 'PENDING',
      total_points: 0,
      has_primary_identity: false,
      has_address_evidence: false,
      combination_met: false,
      review_type: 'standard',
      requires_manual_review: false,
      provider_verified: false,
      external_verification_status: 'not_required',
      submitted_at: new Date().toISOString(),
      user_facing_explanation: 'Submit your identity and address evidence to begin verification.'
    });

    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id,
      actor_email: user.email || '',
      action: 'verification_submitted',
      entity_type: 'VerificationCase',
      entity_id: created.id,
      details: 'User submitted a verification case.',
      severity: 'info'
    });

    return Response.json({ success: true, case_id: created.id });
  } catch (error) {
    return Response.json({ error: error.message || 'Failed to submit verification.' }, { status: 500 });
  }
}