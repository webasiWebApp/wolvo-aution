import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useAdminPayments, usePaymentAudit } from '@/lib/paymentQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw, Filter } from 'lucide-react';

const TX_STATUS = { pending_payment: 'Pending payment', paid: 'Paid', ready_for_collection: 'Ready for collection', completed: 'Completed', cancelled: 'Cancelled' };
const PM_STATUS = { awaiting_payment: 'Awaiting Payment', processing: 'Processing', paid: 'Paid', failed: 'Failed', expired: 'Expired', refund_pending: 'Refund Pending', partially_refunded: 'Partially Refunded', refunded: 'Refunded' };

export default function AdminPayments() {
  const { data: rows = [], isLoading } = useAdminPayments();
  const { data: audit = [] } = usePaymentAudit();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [busy, setBusy] = useState(null);

  const filtered = rows.filter((r) => (statusFilter === 'all' || r.status === statusFilter) && (methodFilter === 'all' || (r.payment && r.payment.payment_method) === methodFilter));

  const act = async (name, label, payload) => {
    setBusy(name + (payload.payment_id || ''));
    try {
      const res = await invokeFunction(name, payload);
      if (res.status >= 400) toast({ title: label + ' failed', description: res.data?.error, variant: 'destructive' });
      else { toast({ title: label }); qc.invalidateQueries({ queryKey: ['admin-payments'] }); qc.invalidateQueries({ queryKey: ['payment-audit'] }); }
    } catch (e) { toast({ title: label + ' failed', description: e.message, variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const sel = 'h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Payments</h1>
        <p className="text-sm text-muted-foreground">Transactions across all payment methods. Confirm manual receipts, review failures and refunds. Sellers see only their own transactions.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={sel}>
          <option value="all">All statuses</option>
          <option value="pending_payment">Pending payment</option>
          <option value="paid">Paid</option>
          <option value="ready_for_collection">Ready for collection</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className={sel}>
          <option value="all">All methods</option>
          <option value="payid">PayID</option>
          <option value="bank_transfer">Bank transfer</option>
          <option value="stripe">Stripe</option>
          <option value="paypal">PayPal</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-left">
              <tr>
                <th className="p-3">Reference</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3">Deadline</th><th className="p-3">Confirmed</th><th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No transactions.</td></tr>}
              {filtered.map((r) => {
                const pm = r.payment;
                const pmStatus = pm ? PM_STATUS[pm.status] : TX_STATUS[r.status];
                const badge = pmStatus === 'Paid' ? 'bg-emerald-100 text-emerald-800' : ['Failed', 'Expired'].includes(pmStatus) ? 'bg-red-100 text-red-800' : ['Refunded', 'Partially Refunded', 'Refund Pending'].includes(pmStatus) ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800';
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="p-3 font-mono text-xs">{r.payment_reference || r.id.slice(-8).toUpperCase()}</td>
                    <td className="p-3 font-medium">${(r.total || r.final_price || 0).toLocaleString('en-AU')}</td>
                    <td className="p-3">{pm?.payment_method || '—'}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badge}`}>{pmStatus}</span></td>
                    <td className="p-3 text-xs">{r.payment_deadline ? new Date(r.payment_deadline).toLocaleDateString('en-AU') : '—'}</td>
                    <td className="p-3 text-xs">{pm?.confirmed_at ? new Date(pm.confirmed_at).toLocaleString('en-AU') : '—'}</td>
                    <td className="p-3 text-right whitespace-nowrap">
                      {['payid', 'bank_transfer', 'manual'].includes(pm?.payment_method) && pm?.status === 'awaiting_payment' && (
                        <Button size="sm" onClick={() => act('confirmManualPayment', 'Payment confirmed', { payment_id: pm.id })} disabled={busy === 'confirmManualPayment' + pm.id}><CheckCircle2 className="h-3 w-3 mr-1" />Confirm</Button>
                      )}
                      {pm?.status === 'awaiting_payment' && (
                        <Button size="sm" variant="outline" className="ml-1" onClick={() => act('markPaymentFailed', 'Marked failed', { payment_id: pm.id, status: 'failed' })} disabled={busy === 'markPaymentFailed' + pm.id}><AlertTriangle className="h-3 w-3 mr-1" />Fail</Button>
                      )}
                      {pm?.status === 'paid' && (
                        <Button size="sm" variant="outline" className="ml-1" onClick={() => act('refundPayment', 'Refunded', { payment_id: pm.id })} disabled={busy === 'refundPayment' + pm.id}><RotateCcw className="h-3 w-3 mr-1" />Refund</Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold text-foreground mb-3">Payment audit log</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No manual changes recorded.</p>
        ) : (
          <ul className="divide-y divide-border">
            {audit.map((a) => (
              <li key={a.id} className="py-2 flex flex-col sm:flex-row sm:justify-between gap-1 text-sm">
                <span className="text-foreground"><span className="font-medium">{a.action.replace(/_/g, ' ')}</span> — {a.details}</span>
                <span className="text-xs text-muted-foreground">{a.actor_email || (a.actor_id || '').slice(-6)} · {new Date(a.created_date).toLocaleString('en-AU')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}