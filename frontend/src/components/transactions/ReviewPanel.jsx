import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useTransactionReviews } from '@/lib/transactionQueries';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star, Loader2, Flag, EyeOff, Eye } from 'lucide-react';

export default function ReviewPanel({ tx, role }) {
  const { user } = useAuth();
  const { data: reviews = [] } = useTransactionReviews(tx.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const completed = tx.status === 'completed';
  const canReview = completed && (role.isBuyer || role.isSeller) && !reviews.find((r) => r.reviewer_id === user?.id);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['transaction-reviews', tx.id] });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await invokeFunction('submitReview', { transaction_id: tx.id, rating, comment });
    if (res.status >= 400) toast({ title: 'Could not submit review', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Review submitted' }); setComment(''); setRating(5); invalidate(); }
    setBusy(false);
  };

  const report = async (id) => {
    const res = await invokeFunction('reportReview', { review_id: id, reason: 'Reported from transaction page' });
    if (res.status >= 400) toast({ title: 'Could not report', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Review reported for moderation' }); invalidate(); }
  };

  const moderate = async (id, action) => {
    const res = await invokeFunction('moderateReview', { review_id: id, action });
    if (res.status >= 400) toast({ title: 'Could not moderate', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Review moderated' }); invalidate(); }
  };

  const visible = reviews.filter((r) => r.status === 'published' || role.isAdmin);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3"><Star className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Reviews</h2></div>
      {visible.length === 0 && <p className="text-sm text-muted-foreground mb-3">No reviews yet.</p>}
      <div className="space-y-2 mb-4">
        {visible.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground"><span className="text-amber-500">{'★'.repeat(r.rating)}</span><span className="text-muted-foreground">{'★'.repeat(5 - r.rating)}</span>{r.status === 'hidden' && <span className="text-xs text-muted-foreground ml-2">(hidden)</span>}</span>
              {r.flag_status === 'reported' && <span className="text-xs text-amber-700">Reported</span>}
            </div>
            {r.comment && <p className="text-xs text-muted-foreground mt-1">{r.comment}</p>}
            <div className="flex gap-2 mt-2">
              {r.status === 'published' && r.reviewer_id !== user?.id && <Button size="sm" variant="ghost" className="text-amber-700" onClick={() => report(r.id)}><Flag className="h-3.5 w-3.5 mr-1" /> Report</Button>}
              {role.isAdmin && (<>
                {r.status === 'published' && <Button size="sm" variant="ghost" onClick={() => moderate(r.id, 'hide')}><EyeOff className="h-3.5 w-3.5 mr-1" /> Hide</Button>}
                {r.status === 'hidden' && <Button size="sm" variant="ghost" onClick={() => moderate(r.id, 'publish')}><Eye className="h-3.5 w-3.5 mr-1" /> Publish</Button>}
              </>)}
            </div>
          </div>
        ))}
      </div>
      {canReview && (
        <form onSubmit={submit} className="border-t border-border pt-3 space-y-2">
          <p className="text-sm font-medium text-foreground">Leave a review</p>
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => (<button type="button" key={n} onClick={() => setRating(n)} className={`text-2xl ${n <= rating ? 'text-amber-500' : 'text-muted-foreground'}`}>★</button>))}</div>
          <Textarea placeholder="Share your experience..." value={comment} onChange={(e) => setComment(e.target.value)} />
          <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit review'}</Button>
        </form>
      )}
      {!completed && (role.isBuyer || role.isSeller) && <p className="text-xs text-muted-foreground">Reviews are available once the transaction is completed.</p>}
    </div>
  );
}