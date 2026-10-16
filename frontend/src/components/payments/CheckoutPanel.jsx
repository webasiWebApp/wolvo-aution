import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { usePaymentCheckout } from '@/lib/paymentQueries';
import StripeCardCheckout from './StripeCardCheckout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CreditCard, Wallet, Landmark, Building2, AlertTriangle, Loader2, CheckCircle2, Clock, ShieldCheck, Info } from 'lucide-react';

const METHOD_ICON = { stripe: CreditCard, paypal: Wallet, payid: Landmark, bank_transfer: Building2, manual: CheckCircle2 };
const MANUAL_METHODS = ['payid', 'bank_transfer', 'manual'];

function statusBadgeClass(status) {
  if (status === 'paid') return 'bg-emerald-100 text-emerald-800';
  if (['failed', 'expired', 'canceled'].includes(status)) return 'bg-red-100 text-red-800';
  if (['refunded', 'partially_refunded', 'refund_pending'].includes(status)) return 'bg-purple-100 text-purple-800';
  return 'bg-amber-100 text-amber-800';
}

export default function CheckoutPanel({ tx, role }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: checkout, isLoading, error: loadError } = usePaymentCheckout(tx.id);
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState('');
  const [refundAmt, setRefundAmt] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['payment-checkout', tx.id] });
    queryClient.invalidateQueries({ queryKey: ['transaction', tx.id] });
    queryClient.invalidateQueries({ queryKey: ['admin-payments'] });
  };

  const call = async (name, label, payload) => {
    setBusy(name);
    try {
      const res = await invokeFunction(name, payload);
      if (res.status >= 400) toast({ title: label + ' failed', description: res.data?.error, variant: 'destructive' });
      else { toast({ title: label }); invalidate(); }
      return res;
    } catch (e) { toast({ title: label + ' failed', description: e.message, variant: 'destructive' }); }
    finally { setBusy(null); }
  };

  const overdue = tx.status === 'pending_payment' && tx.payment_deadline && new Date(tx.payment_deadline).getTime() < Date.now();

  const selectMethod = (method) => call('selectPaymentMethod', 'Method selected', { transaction_id: tx.id, method });
  const confirm = () => checkout?.payment?.id && call('confirmManualPayment', 'Payment confirmed', { payment_id: checkout.payment.id });
  const fail = (status) => call('markPaymentFailed', 'Payment updated', { payment_id: checkout?.payment?.id, status, reason: notes });
  const refund = () => call('refundPayment', 'Refund issued', { payment_id: checkout?.payment?.id, amount: refundAmt ? Number(refundAmt) : undefined, reason: notes });
  const report = async () => {
    const res = await call('reportNonPayment', 'Non-payment reported', { transaction_id: tx.id, notes });
    if (res && res.status < 400) {
      setNotes('');
      queryClient.invalidateQueries({ queryKey: ['transaction-disputes', tx.id] });
    }
  };

  if (loadError) return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3"><CreditCard className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Payment</h2></div>
      <p className="text-sm text-red-600">{loadError.message}</p>
    </div>
  );

  if (isLoading || !checkout) return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3"><CreditCard className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Payment</h2></div>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );

  const order = checkout.order;
  const methods = checkout.methods || [];
  const instr = checkout.instructions;
  const payment = checkout.payment;
  const manualMethod = MANUAL_METHODS.includes(order.method);
  const canConfirm = role.isStaff && manualMethod;
  const canReport = role.isSeller && !tx.non_payment_reported && (overdue || role.isAdmin);
  const canRefund = role.isAdmin && manualMethod && ['paid', 'partially_refunded'].includes(payment?.status);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3"><CreditCard className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Payment</h2></div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">Status</span>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(order.status)}`}>{order.status_label || order.status}</span>
      </div>
      <div className="text-sm space-y-1 mb-3">
        <div className="flex justify-between"><span className="text-muted-foreground">Amount due</span><span className="font-bold">${(order.amount || 0).toLocaleString('en-AU')}</span></div>
        {!!tx.fees && <div className="flex justify-between"><span className="text-muted-foreground">Fees</span><span className="font-medium">${(tx.fees || 0).toLocaleString('en-AU')}</span></div>}
        {!!tx.commission && <div className="flex justify-between"><span className="text-muted-foreground">Commission</span><span className="font-medium">${(tx.commission || 0).toLocaleString('en-AU')}</span></div>}
        <div className="flex justify-between"><span className="text-muted-foreground">Payment reference</span><span className="font-mono text-xs font-medium">{order.reference}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Payment deadline</span><span className={`font-medium ${overdue ? 'text-red-600' : ''}`}>{order.deadline ? new Date(order.deadline).toLocaleDateString('en-AU') : '—'}{overdue ? ' (overdue)' : ''}</span></div>
      </div>

      {tx.status === 'pending_payment' && role.isBuyer && (
        <div className="mb-4">
          <p className="text-sm font-medium text-foreground mb-2">Choose a payment method</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {methods.map((m) => {
              const Icon = METHOD_ICON[m.key] || CreditCard;
              const selected = order.method === m.key;
              return (
                <button key={m.key} disabled={!m.enabled || busy === 'selectPaymentMethod'} onClick={() => selectMethod(m.key)}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-50 ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
                  <Icon className="h-4 w-4 shrink-0" /> <span className="flex-1">{m.label}</span>
                  {!m.enabled && <span className="text-xs text-muted-foreground">Unavailable</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tx.status === 'pending_payment' && role.isBuyer && order.method === 'stripe' && (methods.find((m) => m.key === 'stripe') || {}).enabled && (
        <StripeCardCheckout tx={tx} invalidate={invalidate} />
      )}

      {instr && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 mb-3">
          <div className="flex items-center gap-2 mb-2"><ShieldCheck className="h-4 w-4 text-primary" /><p className="text-sm font-semibold text-foreground">Payment instructions</p></div>
          {instr.type === 'payid' && (
            <div className="text-sm text-foreground space-y-1">
              <div>PayID: <span className="font-mono font-medium">{instr.alias}</span> ({instr.name})</div>
              <div>Amount: ${instr.amount.toLocaleString('en-AU')}</div>
              <div>Reference: <span className="font-mono font-medium">{instr.reference}</span></div>
              {instr.notes && <p className="text-xs text-muted-foreground mt-1">{instr.notes}</p>}
            </div>
          )}
          {instr.type === 'bank_transfer' && (
            <div className="text-sm text-foreground space-y-1">
              <div>Bank: {instr.bank_name}</div>
              <div>Account name: {instr.account_name}</div>
              <div>BSB: <span className="font-mono">{instr.bsb}</span> · Account: <span className="font-mono">{instr.account_number}</span></div>
              <div>Amount: ${instr.amount.toLocaleString('en-AU')}</div>
              <div>Reference: <span className="font-mono font-medium">{instr.reference}</span></div>
              {instr.notes && <p className="text-xs text-muted-foreground mt-1">{instr.notes}</p>}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Info className="h-3 w-3" /> Payment is confirmed only when the seller verifies funds have arrived — a receipt upload does not mark it paid.</p>
        </div>
      )}

      {(canConfirm || role.isAdmin || canReport) && tx.status === 'pending_payment' && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {canConfirm && (
            <>
              <p className="text-xs text-muted-foreground">Confirm receipt only when funds have actually arrived. Do not confirm on the basis of a receipt or screenshot alone.</p>
              <Button onClick={confirm} disabled={busy === 'confirmManualPayment'}>{busy === 'confirmManualPayment' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />} Confirm payment received</Button>
            </>
          )}
          {role.isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => fail('failed')} disabled={busy === 'markPaymentFailed'}><AlertTriangle className="h-4 w-4 mr-1" /> Mark failed</Button>
              <Button variant="outline" size="sm" onClick={() => fail('expired')} disabled={busy === 'markPaymentFailed'}><Clock className="h-4 w-4 mr-1" /> Mark expired</Button>
            </div>
          )}
          {canReport && (
            <div><Textarea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} className="mb-2" /><Button variant="outline" size="sm" onClick={report} disabled={busy === 'reportNonPayment'}><AlertTriangle className="h-4 w-4 mr-1" /> Report non-payment</Button></div>
          )}
        </div>
      )}

      {canRefund && (
        <div className="border-t border-border pt-3 mt-2">
          <p className="text-xs text-muted-foreground mb-2">Record a refund for this manual payment. Card refunds are made through Stripe.</p>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <input type="number" placeholder={`Full = ${Math.max(0, (order.amount || 0) - (payment.refunded_amount || 0))}`} value={refundAmt} onChange={(e) => setRefundAmt(e.target.value)} className="w-32 h-9 rounded-md border border-input bg-background px-3 text-sm" />
            <Textarea placeholder="Reason" value={notes} onChange={(e) => setNotes(e.target.value)} className="flex-1 min-h-9" />
            <Button variant="outline" size="sm" onClick={refund} disabled={busy === 'refundPayment'}>Refund</Button>
          </div>
        </div>
      )}

      {tx.non_payment_reported && <p className="text-xs text-amber-700 mt-2">Non-payment reported ({tx.non_payment_status}). Under review.</p>}
    </div>
  );
}