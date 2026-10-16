import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useItemComments } from '@/lib/garageSaleQueries';
import { useAuth } from '@/lib/AuthContext';
import { invokeFunction } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { MessageCircle, Send, Flag, BadgeCheck, LogIn } from 'lucide-react';
import { maskEmail } from '@/lib/utils';

export default function CommentsSection({ auction }) {
  const auctionId = auction && auction.id;
  const sellerUserId = auction && (auction.seller_id || auction.created_by_id);
  const { data: comments = [], isLoading } = useItemComments(auctionId);
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['item-comments', auctionId] });

  const post = (text, parent) => invokeFunction('postItemComment', { auction_id: auctionId, body: text, parent_comment_id: parent || '' });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      const res = await post(body);
      if (res.status >= 400) setErr((res.data && res.data.error) || 'Could not post comment.');
      else { setBody(''); invalidate(); }
    } catch (ex) { setErr(ex.message || 'Could not post comment.'); }
    finally { setSubmitting(false); }
  };

  const submitReply = async (parentId) => {
    setErr('');
    if (!replyBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await post(replyBody, parentId);
      if (res.status >= 400) setErr((res.data && res.data.error) || 'Could not post reply.');
      else { setReplyBody(''); setReplyTo(null); invalidate(); }
    } catch (ex) { setErr(ex.message || 'Could not post reply.'); }
    finally { setSubmitting(false); }
  };

  const report = async (commentId) => {
    try { await invokeFunction('postItemComment', { action: 'report', comment_id: commentId }); invalidate(); } catch (_) {}
  };

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesOf = (parentId) => comments.filter((c) => c.parent_comment_id === parentId);

  return (
    <div className="mt-8 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2"><MessageCircle className="h-5 w-5" /> Questions & comments</h2>

      {isLoading ? null : topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet. Ask a question about this item.</p>
      ) : (
        <ul className="space-y-4">
          {topLevel.map((c) => (
            <li key={c.id} className="space-y-2">
              <Comment c={c} sellerUserId={sellerUserId} onReport={report} />
              {repliesOf(c.id).map((r) => (
                <div key={r.id} className="ml-6"><Comment c={r} sellerUserId={sellerUserId} onReport={report} isReply /></div>
              ))}
              {isAuthenticated && (replyTo === c.id ? (
                <div className="ml-6 flex gap-2">
                  <input className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm" value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder="Reply…" />
                  <Button size="sm" onClick={() => submitReply(c.id)} disabled={submitting}>Send</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyBody(''); }}>Cancel</Button>
                </div>
              ) : (
                <button className="ml-6 text-xs text-muted-foreground hover:text-foreground" onClick={() => setReplyTo(c.id)}>Reply</button>
              ))}
            </li>
          ))}
        </ul>
      )}

      {err && <p className="text-sm text-red-600 mt-3">{err}</p>}

      <div className="mt-5 pt-4 border-t border-border">
        {isAuthenticated ? (
          <form onSubmit={submit} className="flex gap-2">
            <input className="flex-1 h-10 rounded-md border border-input bg-background px-3" placeholder="Ask a question or leave a comment…" value={body} onChange={(e) => setBody(e.target.value)} />
            <Button type="submit" disabled={submitting}>{submitting ? null : <Send className="h-4 w-4 mr-1" />} Post</Button>
          </form>
        ) : (
          <div className="text-center text-sm text-muted-foreground">
            <LogIn className="h-5 w-5 mx-auto mb-1" />
            <Link to="/login" className="text-primary hover:underline">Sign in</Link> to comment.
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-2">Comments do not affect bidding or auction outcomes.</p>
      </div>
    </div>
  );
}

function Comment({ c, sellerUserId, onReport, isReply }) {
  const isSeller = c.user_id && c.user_id === sellerUserId;
  return (
    <div className={`rounded-lg border border-border bg-background p-3 ${isReply ? 'text-sm' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{c.author_name ? maskEmail(c.author_name) : 'Anonymous'}</span>
          {isSeller && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-foreground bg-accent/20 px-2 py-0.5 rounded-full"><BadgeCheck className="h-3 w-3" /> Seller</span>
          )}
          <span className="text-xs text-muted-foreground">{new Date(c.created_date).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => onReport(c.id)} title="Report"><Flag className="h-3.5 w-3.5" /></button>
      </div>
      <p className="text-sm text-foreground mt-1.5 whitespace-pre-line">{c.body}</p>
    </div>
  );
}