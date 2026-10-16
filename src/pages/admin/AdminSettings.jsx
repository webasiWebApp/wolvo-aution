import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { usePricingConfig } from '@/lib/pricingQueries';
import { Button } from '@/components/ui/button';
import PricingFeeRow from '@/components/admin/PricingFeeRow';
import VerificationUsagePanel from '@/components/admin/VerificationUsagePanel';
import PricingHistoryPanel from '@/components/admin/PricingHistoryPanel';
import PaymentMethodConfigPanel from '@/components/admin/PaymentMethodConfigPanel';
import { Loader2, Save, CheckCircle2, Info } from 'lucide-react';

const USER_FEES = [
  { label: 'Buyer registration fee', enabledField: 'buyer_registration_fee_enabled', amountField: 'buyer_registration_fee_amount', hint: 'Charged when a buyer registers.' },
  { label: 'Seller registration fee', enabledField: 'seller_registration_fee_enabled', amountField: 'seller_registration_fee_amount', hint: 'Charged when a seller registers.' },
  { label: 'Basic listing fee', enabledField: 'listing_fee_enabled', amountField: 'listing_fee_amount', hint: 'Flat fee to publish a listing.' },
  { label: 'Bidding fee', enabledField: 'bidding_fee_enabled', amountField: 'bidding_fee_amount', hint: 'Per-bid charge.' },
  { label: 'Viewing booking fee', enabledField: 'viewing_booking_fee_enabled', amountField: 'viewing_booking_fee_amount', hint: 'Charged to book an inspection slot.' },
  { label: 'Physical attendance registration fee', enabledField: 'attendance_registration_fee_enabled', amountField: 'attendance_registration_fee_amount', hint: 'Charged to register for in-person attendance.' },
  { label: 'Identity verification fee', enabledField: 'verification_fee_enabled', amountField: 'verification_fee_amount', hint: 'Charged to users for identity verification. Third-party provider costs may still apply to the platform.' },
  { label: 'Basic notifications fee', enabledField: 'notifications_fee_enabled', amountField: 'notifications_fee_amount', hint: 'Per-notification charge.' }
];

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = usePricingConfig();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (data) setConfig(data); }, [data]);

  const set = (k) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'number' ? Number(e.target.value) : e.target.value);
    setConfig({ ...config, [k]: val });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');
    try {
      const res = await invokeFunction('savePricingConfig', { config });
      if (res.status >= 400) setError(res.data?.error || 'Could not save.');
      else {
        setSaved(true);
        queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
        queryClient.invalidateQueries({ queryKey: ['pricing-history'] });
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (err) { setError(err.message || 'Could not save.'); }
    finally { setSaving(false); }
  };

  if (isLoading || !config) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const inputCls = "w-32 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
  const Toggle = ({ label, field, hint }) => (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div><p className="text-sm font-medium text-foreground">{label}</p>{hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}</div>
      <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
        <input type="checkbox" checked={!!config[field]} onChange={set(field)} className="sr-only peer" />
        <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
      </label>
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Pricing & settings</h1>
        <p className="text-sm text-muted-foreground">All user-facing fees are $0 at launch. No fee is charged unless an administrator explicitly enables it and sets an amount. Future revenue options are disabled by default.</p>
      </div>

      <form onSubmit={save} className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground mb-1">User-facing fees</h2>
          <p className="text-xs text-muted-foreground mb-2">Every fee below is free at launch. Toggle on and set an amount to monetise. Applicable fees are shown to users before they commit.</p>
          {USER_FEES.map((f) => <PricingFeeRow key={f.enabledField} {...f} config={config} onChange={setConfig} />)}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground mb-1">Future revenue options</h2>
          <p className="text-xs text-muted-foreground mb-2">All disabled by default. Enable only when ready.</p>
          <Toggle label="Seller commission" field="commission_enabled" hint="Percentage taken from completed sales." />
          <div className="flex items-center gap-3 mt-3 mb-3"><label className="text-sm text-muted-foreground">Commission (%)</label><input type="number" value={config.commission_percent} onChange={set('commission_percent')} disabled={!config.commission_enabled} className={inputCls} /></div>
          <Toggle label="Featured listings" field="featured_listing_fee_enabled" hint="Fee to highlight a listing." />
          <div className="flex items-center gap-3 mt-3 mb-3"><label className="text-sm text-muted-foreground">Featured fee (AUD)</label><input type="number" value={config.featured_listing_fee_amount} onChange={set('featured_listing_fee_amount')} disabled={!config.featured_listing_fee_enabled} className={inputCls} /></div>
          <Toggle label="Premium seller subscription" field="subscription_enabled" hint="Recurring subscription for sellers." />
          <div className="flex flex-wrap items-center gap-6 mt-3 mb-3">
            <div className="flex items-center gap-2"><label className="text-sm text-muted-foreground">Monthly (AUD)</label><input type="number" value={config.subscription_monthly_amount} onChange={set('subscription_monthly_amount')} disabled={!config.subscription_enabled} className={inputCls} /></div>
            <div className="flex items-center gap-2"><label className="text-sm text-muted-foreground">Yearly (AUD)</label><input type="number" value={config.subscription_yearly_amount} onChange={set('subscription_yearly_amount')} disabled={!config.subscription_enabled} className={inputCls} /></div>
          </div>
          <Toggle label="Premium auction-management services" field="premium_auction_management_enabled" hint="Fee for enhanced auction-management tooling." />
          <div className="flex items-center gap-3 mt-3"><label className="text-sm text-muted-foreground">Amount (AUD)</label><input type="number" value={config.premium_auction_management_amount} onChange={set('premium_auction_management_amount')} disabled={!config.premium_auction_management_enabled} className={inputCls} /></div>
        </section>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-2">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-900">These settings configure the pricing model only. Actual charging requires connecting a payment provider (e.g. Stripe) — a future integration. No fee is charged while the free configuration is active.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}{saving ? 'Saving…' : 'Save settings'}</Button>
          {saved && <span className="text-sm text-emerald-600 font-medium inline-flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
        </div>
      </form>

      <PaymentMethodConfigPanel />
      <VerificationUsagePanel />
      <PricingHistoryPanel />
    </div>
  );
}