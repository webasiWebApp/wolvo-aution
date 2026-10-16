import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useTransactionDisputes } from '@/lib/transactionQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Scale, Loader2 } from 'lucide-react';

export default function DisputePanel({ tx, role }) {
  const { data: disputes = [] } = useTransactionDisputes(tx.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ subject: '', description: '', dispute_type: 'other' });
  const [busy, setBusy] = useState(false);
  const canFile = role.isBuyer || role.isSeller;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['transaction-disputes', tx.id] });

  const file = async (e) => {
    e.preventDefault();
    if (!form.subject || !form.description) { toast({ title: 'Subject and description required', variant: 'destructive' }); return; }
    setBusy(true);
    const res = await invokeFunction('fileDispute', { transaction_id: tx.id, ...form });
    if (res.status >= 400) toast({ title: 'Could not file dispute', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Dispute filed' }); setForm({ subject: '', description: '', dispute_type: 'other' }); invalidate(); }
    setBusy(false);
  };

  const resolve = async (id, status, resolution) => {
    const res = await invokeFunction('resolveDispute', { dispute_id: id, status, resolution });
    if (res.status >= 400) toast({ title: 'Could not resolve', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: `Dispute ${status}` }); invalidate(); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3"><Scale className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Disputes</h2></div>
      <p className="text-xs text-muted-foreground mb-3">Disputes are private — only the buyer, seller and admins can see them.</p>
      {disputes.length === 0 && <p className="text-sm text-muted-foreground mb-3">No disputes.</p>}
      <div className="space-y-2 mb-4">
        {disputes.map((d) => (
          <div key={d.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between"><span className="font-medium text-foreground">{d.subject}</span><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : d.status === 'dismissed' ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>{d.status.replace('_', ' ')}</span></div>
            <p className="text-xs text-muted-foreground mt-1">{d.description}</p>
            <p className="text-xs text-muted-foreground mt-1">Type: {d.dispute_type}</p>
            {d.resolution && <p className="text-xs text-emerald-700 mt-1">Resolution: {d.resolution}</p>}
            {role.isAdmin && ['open', 'under_review'].includes(d.status) && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => resolve(d.id, 'resolved', d.resolution || 'Resolved')}>Resolve</Button>
                <Button size="sm" variant="outline" onClick={() => resolve(d.id, 'dismissed', 'Dismissed')}>Dismiss</Button>
              </div>
            )}
          </div>
        ))}
      </div>
      {canFile && (
        <form onSubmit={file} className="border-t border-border pt-3 space-y-2">
          <p className="text-sm font-medium text-foreground">File a dispute</p>
          <div><Label className="text-xs">Subject</Label><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} /></div>
          <div><Label className="text-xs">Type</Label>
            <select value={form.dispute_type} onChange={(e) => setForm((f) => ({ ...f, dispute_type: e.target.value }))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option value="item_not_as_described">Item not as described</option>
              <option value="payment_issue">Payment issue</option>
              <option value="collection_issue">Collection issue</option>
              <option value="non_payment">Non-payment</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <Button type="submit" size="sm" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit dispute'}</Button>
        </form>
      )}
    </div>
  );
}