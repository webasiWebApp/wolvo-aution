import React from 'react';
import { useVerificationUsage } from '@/lib/pricingQueries';
import { ShieldCheck, Info } from 'lucide-react';

const LABELS = { UNVERIFIED: 'Unverified', PENDING: 'Pending', VERIFIED: 'Verified', REJECTED: 'Rejected', RESTRICTED: 'Restricted' };

export default function VerificationUsagePanel() {
  const { data: usage } = useVerificationUsage();
  const byStatus = usage?.byStatus || {};
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3"><ShieldCheck className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Identity verification — cost control</h2></div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">Total cases</p><p className="text-xl font-bold text-foreground">{usage?.total ?? '—'}</p></div>
        {Object.entries(LABELS).map(([k, l]) => (
          <div key={k} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-semibold text-foreground">{byStatus[k] ?? 0}</p></div>
        ))}
      </div>
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex gap-2">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-900">Paid identity checks are triggered only when required for participation (bidding or attendance), never when a visitor browses a listing. No third-party verification provider is connected, so no provider cost is incurred. Valid results are reused only where the provider's terms permit.</p>
      </div>
    </section>
  );
}