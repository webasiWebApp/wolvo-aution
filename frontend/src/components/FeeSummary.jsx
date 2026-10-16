import React from 'react';
import { usePricingConfig } from '@/lib/pricingQueries';
import { Receipt } from 'lucide-react';

// Shows applicable fees before a user commits. With the default (free) config
// active, every fee is disabled/$0 so this renders "No fees apply. This is free."
// context: 'bidding' | 'listing' | 'attendance' | 'viewing' | 'verification'
export default function FeeSummary({ context = 'bidding' }) {
  const { data: config } = usePricingConfig();
  if (!config) return null;

  const items = [];
  const add = (enabled, amount, label) => {
    if (enabled && Number(amount) > 0) items.push({ label, amount: Number(amount) });
  };

  if (context === 'bidding') add(config.bidding_fee_enabled, config.bidding_fee_amount, 'Bidding fee');
  if (context === 'listing') {
    add(config.listing_fee_enabled, config.listing_fee_amount, 'Listing fee');
    add(config.featured_listing_fee_enabled, config.featured_listing_fee_amount, 'Featured listing fee');
  }
  if (context === 'attendance') add(config.attendance_registration_fee_enabled, config.attendance_registration_fee_amount, 'Attendance registration fee');
  if (context === 'viewing') add(config.viewing_booking_fee_enabled, config.viewing_booking_fee_amount, 'Viewing booking fee');
  if (context === 'verification') add(config.verification_fee_enabled, config.verification_fee_amount, 'Identity verification fee');

  const total = items.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5"><Receipt className="h-3.5 w-3.5" /> Fees</div>
      {items.length === 0 ? (
        <p className="text-xs text-emerald-700 font-medium">No fees apply. This is free.</p>
      ) : (
        <div className="space-y-1">
          {items.map((i) => (
            <div key={i.label} className="flex justify-between"><span className="text-muted-foreground">{i.label}</span><span className="font-medium text-foreground">${i.amount.toLocaleString('en-AU')}</span></div>
          ))}
          <div className="flex justify-between pt-1 border-t border-border"><span className="font-medium text-foreground">Total</span><span className="font-bold text-foreground">${total.toLocaleString('en-AU')}</span></div>
        </div>
      )}
    </div>
  );
}