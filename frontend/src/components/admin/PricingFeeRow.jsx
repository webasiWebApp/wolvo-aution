import React from 'react';

export default function PricingFeeRow({ label, enabledField, amountField, hint, config, onChange }) {
  const enabled = !!config[enabledField];
  const amount = config[amountField] ?? 0;
  const set = (k, v) => onChange({ ...config, [k]: v });
  return (
    <div className="py-3 border-b border-border last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
          <input type="checkbox" checked={enabled} onChange={(e) => set(enabledField, e.target.checked)} className="sr-only peer" />
          <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-xs text-muted-foreground">Amount (AUD)</span>
        <input type="number" min="0" value={amount} disabled={!enabled} onChange={(e) => set(amountField, Number(e.target.value))} className="w-32 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" />
        {!enabled && <span className="text-xs text-emerald-700 font-medium">Free at launch</span>}
      </div>
    </div>
  );
}