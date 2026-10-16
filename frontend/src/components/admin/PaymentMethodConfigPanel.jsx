import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { usePaymentMethodConfig } from '@/lib/paymentQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Save, CheckCircle2, Info } from 'lucide-react';

export default function PaymentMethodConfigPanel() {
  const { data: cfg, isLoading } = usePaymentMethodConfig();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (cfg !== undefined) setConfig({
      stripe_enabled: false, paypal_enabled: false, payid_enabled: false, bank_transfer_enabled: false,
      default_payment_deadline_days: 3, live_payments_enabled: false, ...cfg
    });
  }, [cfg]);

  const set = (k) => (e) => setConfig((c) => ({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' ? Number(e.target.value) : e.target.value) }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setSaved(false);
    try {
      const res = await invokeFunction('savePaymentMethodConfig', { config });
      if (res.status >= 400) toast({ title: 'Could not save', description: res.data?.error, variant: 'destructive' });
      else { setSaved(true); qc.invalidateQueries({ queryKey: ['payment-method-config'] }); setTimeout(() => setSaved(false), 3000); }
    } catch (err) { toast({ title: 'Could not save', description: err.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  if (isLoading || !config) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const inputCls = 'w-full max-w-sm h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
  const Toggle = ({ label, field, hint }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-border last:border-0">
      <div><p className="text-sm font-medium text-foreground">{label}</p>{hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}</div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
        <input type="checkbox" checked={!!config[field]} onChange={set(field)} className="sr-only peer" />
        <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
      </label>
    </div>
  );

  return (
    <form onSubmit={save} className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-foreground">Payment methods</h2>
        <p className="text-xs text-muted-foreground">Manual methods (PayID, bank transfer) work now. Online methods require provider credentials and a verified webhook before they are enabled.</p>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">Bank account details are admin-only. They are shown to a winning bidder only through the secure checkout function.</p>
      </div>

      <Toggle label="PayID" field="payid_enabled" hint="Australian PayID (manual confirmation)." />
      <div className="grid sm:grid-cols-3 gap-2">
        <input placeholder="PayID alias" value={config.payid_alias || ''} onChange={set('payid_alias')} className={inputCls} />
        <input placeholder="Name" value={config.payid_name || ''} onChange={set('payid_name')} className={inputCls} />
        <input placeholder="Instructions" value={config.payid_instructions || ''} onChange={set('payid_instructions')} className={inputCls} />
      </div>

      <Toggle label="Bank transfer" field="bank_transfer_enabled" hint="Manual confirmation." />
      <div className="grid sm:grid-cols-2 gap-2">
        <input placeholder="Bank name" value={config.bank_name || ''} onChange={set('bank_name')} className={inputCls} />
        <input placeholder="Account name" value={config.bank_account_name || ''} onChange={set('bank_account_name')} className={inputCls} />
        <input placeholder="BSB" value={config.bank_bsb || ''} onChange={set('bank_bsb')} className={inputCls} />
        <input placeholder="Account number" value={config.bank_account_number || ''} onChange={set('bank_account_number')} className={inputCls} />
        <input placeholder="Instructions" value={config.bank_instructions || ''} onChange={set('bank_instructions')} className={inputCls} />
      </div>

      <Toggle label="Stripe (cards)" field="stripe_enabled" hint="Requires Stripe credentials + webhook. Disabled until configured & tested." />
      <Toggle label="PayPal" field="paypal_enabled" hint="Requires PayPal credentials + webhook. Disabled until configured & tested." />

      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Default payment deadline (days)</label>
        <input type="number" value={config.default_payment_deadline_days} onChange={set('default_payment_deadline_days')} className="w-24 h-9 rounded-md border border-input bg-background px-3 text-sm" />
      </div>

      <Toggle label="Live payments active" field="live_payments_enabled" hint="Master switch. Leave off until all active methods are configured and tested." />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}Save payment settings</Button>
        {saved && <span className="text-sm text-emerald-600 font-medium inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Saved</span>}
      </div>
    </form>
  );
}