import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Authenticated users comment on an individual item auction, and may reply to a
// comment. Comments NEVER modify bids or auction outcomes — this function
// touches only ItemComment records. Basic spam guard: a user may not post more
// than 6 comments per minute. 'report' flags a comment for admin review without
// removing it. Server-side permission: a signed-in user is required for every
// action; the comment is always authored by the caller (user_id stamped).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to comment.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    if (body.action === 'report') {
      const commentId = body.comment_id;
      if (!commentId) return Response.json({ error: 'comment_id is required.' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.ItemComment.get(commentId).catch(() => null);
      if (!existing) return Response.json({ error: 'Comment not found.' }, { status: 404 });
      await base44.asServiceRole.entities.ItemComment.update(commentId, { reported: true, report_reason: (body.reason || '').slice(0, 200) });
      return Response.json({ success: true });
    }

    const auctionId = body.auction_id;
    const text = (body.body || '').trim();
    if (!auctionId) return Response.json({ error: 'auction_id is required.' }, { status: 400 });
    if (!text) return Response.json({ error: 'Comment cannot be empty.' }, { status: 400 });
    if (text.length > 1000) return Response.json({ error: 'Comment is too long (max 1000 characters).' }, { status: 400 });

    const auction = await base44.asServiceRole.entities.Auction.get(auctionId).catch(() => null);
    if (!auction) return Response.json({ error: 'Item not found.' }, { status: 404 });

    // A reply must point at a visible comment on the same item.
    const parentId = body.parent_comment_id || '';
    if (parentId) {
      const parent = await base44.asServiceRole.entities.ItemComment.get(parentId).catch(() => null);
      if (!parent || parent.auction_id !== auctionId || parent.status !== 'visible') {
        return Response.json({ error: 'The comment you are replying to is no longer available.' }, { status: 400 });
      }
    }

    // Spam guard: no more than 6 comments by this user in the last 60 seconds.
    const since = new Date(Date.now() - 60000).toISOString();
    const recent = await base44.asServiceRole.entities.ItemComment.filter({ user_id: user.id, created_date: { $gte: since } }, { limit: 10 });
    if ((recent.items || []).length >= 6) return Response.json({ error: 'You are commenting too quickly. Please wait a moment.' }, { status: 429 });

    const created = await base44.asServiceRole.entities.ItemComment.create({
      auction_id: auctionId,
      event_id: auction.garage_sale_event_id || '',
      user_id: user.id,
      author_name: user.full_name || user.email,
      body: text,
      parent_comment_id: parentId,
      status: 'visible',
      reported: false
    });
    return Response.json({ comment: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}