import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Admin moderates a reported review: hide (remove from public display),
// publish (keep visible), or dismiss_report (clear the flag, keep visible).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Only admins may moderate reviews.' }, { status: 403 });
    const body = await req.json();
    const { review_id, action } = body || {};
    if (!review_id || !['hide', 'publish', 'dismiss_report'].includes(action)) return Response.json({ error: 'review_id and a valid action are required.' }, { status: 400 });
    const review = await base44.asServiceRole.entities.Review.get(review_id);
    if (!review) return Response.json({ error: 'Review not found.' }, { status: 404 });
    const update = { flag_status: 'reviewed' };
    if (action === 'hide') update.status = 'hidden';
    if (action === 'publish') update.status = 'published';
    if (action === 'dismiss_report') { update.flagged = false; update.flag_reason = ''; }
    await base44.asServiceRole.entities.Review.update(review_id, update);
    return Response.json({ success: true, status: update.status || review.status, flag_status: 'reviewed' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}