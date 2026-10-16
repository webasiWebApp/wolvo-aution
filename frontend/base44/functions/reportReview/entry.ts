import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Any signed-in user reports an abusive or fraudulent review. Flags the
// review for admin moderation (reportReview -> moderateReview). Idempotent per
// review: a review already reported cannot be reported again.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const { review_id, reason } = body || {};
    if (!review_id) return Response.json({ error: 'review_id is required.' }, { status: 400 });
    const review = await base44.asServiceRole.entities.Review.get(review_id);
    if (!review) return Response.json({ error: 'Review not found.' }, { status: 404 });
    if (review.flag_status === 'reported') return Response.json({ error: 'This review has already been reported and is awaiting review.' }, { status: 400 });
    await base44.asServiceRole.entities.Review.update(review_id, { flagged: true, flag_reason: reason || '', flag_status: 'reported' });
    return Response.json({ success: true, flag_status: 'reported' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}