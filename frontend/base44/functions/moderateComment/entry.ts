import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Admin moderation of item comments: hide, show, or delete. Each action is
// recorded in the audit log. Non-admins are refused. Comments are the only
// thing touched — bidding and auction outcomes are never affected.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Admins only.' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const commentId = body.comment_id;
    const action = body.action;
    if (!commentId || !['hide', 'show', 'delete'].includes(action)) {
      return Response.json({ error: 'comment_id and action (hide/show/delete) are required.' }, { status: 400 });
    }
    const comment = await base44.asServiceRole.entities.ItemComment.get(commentId).catch(() => null);
    if (!comment) return Response.json({ error: 'Comment not found.' }, { status: 404 });
    if (action === 'delete') {
      await base44.asServiceRole.entities.ItemComment.delete(commentId);
    } else {
      await base44.asServiceRole.entities.ItemComment.update(commentId, { status: action === 'hide' ? 'hidden' : 'visible' });
    }
    await base44.asServiceRole.entities.AuditLog.create({
      actor_id: user.id,
      actor_email: user.email || '',
      action: 'comment_moderated',
      entity_type: 'ItemComment',
      entity_id: commentId,
      details: `Comment ${action} by admin.`,
      severity: 'info'
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}