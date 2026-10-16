import React from 'react';
import { ShieldCheck, BadgeCheck, Lock, Eye, AlertTriangle, Scale } from 'lucide-react';

const POINTS = [
  { icon: BadgeCheck, title: "Verified sellers", text: "Sellers are vetted and identity-verified before they can list. Look for the verified badge on listings." },
  { icon: Lock, title: "Secure payments", text: "Settlement is handled through the platform, not by cash handovers. Your payment is tracked and protected." },
  { icon: Eye, title: "Transparent bidding", text: "Every bid is visible in the bid history. There are no hidden reserves that change after you bid, and the minimum increment is shown up front." },
  { icon: ShieldCheck, title: "Buyer protection", text: "If an item is materially not as described, our resolution process helps you reach a fair outcome." },
  { icon: Scale, title: "Dispute resolution", text: "An independent process reviews contested sales and aims to settle matters fairly for both parties." },
  { icon: AlertTriangle, title: "Report a concern", text: "Spot something suspicious? Report any listing or seller through the Contact page and our team will investigate." }
];

export default function BuyerSafety() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 mb-4">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Buyer safety</h1>
        <p className="mt-3 text-muted-foreground">
          We work to keep Wolvo a safe and trustworthy place to buy. Here's how we protect you and what to watch for.
        </p>
      </div>

      <div className="space-y-4">
        {POINTS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.title} className="flex gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{p.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{p.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-6">
        <h3 className="font-semibold text-amber-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" /> Stay alert
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-amber-900/90 list-disc pl-5">
          <li>Never pay outside the platform. Off-platform payments are not protected.</li>
          <li>Meet for collection in safe, public locations where possible.</li>
          <li>Inspect items carefully or use the viewing notes before bidding.</li>
          <li>Trust your instincts. If a deal looks too good, report it.</li>
        </ul>
      </div>
    </div>
  );
}