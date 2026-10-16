import React from 'react';
import { usePricingHistory } from '@/lib/pricingQueries';
import { History } from 'lucide-react';

export default function PricingHistoryPanel() {
  const { data: history = [] } = usePricingHistory();
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3"><History className="h-5 w-5 text-primary" /><h2 className="font-semibold text-foreground">Fee change history</h2></div>
      {history.length === 0 && <p className="text-sm text-muted-foreground">No changes recorded yet.</p>}
      <ul className="space-y-2">
        {history.map((h) => (
          <li key={h.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between"><span className="font-medium text-foreground">{h.actor_email || h.actor_id}</span><span className="text-xs text-muted-foreground">{new Date(h.created_date).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
            <p className="text-xs text-muted-foreground mt-1 break-words">{h.details}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}