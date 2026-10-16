import React from 'react';
import { Gavel, Search, Hammer, CreditCard, Truck, ShieldCheck, Hand } from 'lucide-react';

const STEPS = [
  { icon: Search, title: "1. Browse & discover", text: "Search live and upcoming auctions across Australia by category, price, location or format. No account needed to look." },
  { icon: Gavel, title: "2. Register to bid", text: "Create a free account, verify your identity, and get approval to bid. Registration, browsing and bidding are all free." },
  { icon: Hammer, title: "3. Place your bids", text: "Bid online in real time, or attend in person for physical and hybrid auctions. Watch the countdown and stay in front." },
  { icon: CreditCard, title: "4. Pay securely", text: "Winners are notified instantly. Settle securely through the platform and arrange collection or delivery." },
  { icon: Truck, title: "5. Collect or deliver", text: "Pick up from the seller's location at suburb level, or arrange freight for larger items across Australia." }
];

const FORMATS = [
  { icon: Hand, title: "Online-only", text: "Bid entirely online from anywhere. Auctions close on a countdown timer; the highest bidder wins." },
  { icon: ShieldCheck, title: "Physical auctions", text: "Attend in person at venues across Australia. Register on the day and bid live alongside other attendees." },
  { icon: Gavel, title: "Hybrid auctions", text: "The best of both worlds. Bid online or attend in person, with all bids competing in the same auction." }
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">How Wolvo works</h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          A simple, transparent process for buying and selling through online, physical and hybrid auctions across Australia.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-16">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="rounded-xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-sm text-foreground">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{s.text}</p>
            </div>
          );
        })}
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">Auction formats</h2>
      <div className="grid gap-5 md:grid-cols-3 mb-16">
        {FORMATS.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="rounded-xl border border-border bg-card p-6">
              <Icon className="h-7 w-7 text-accent mb-3" />
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-2">{f.text}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-primary text-primary-foreground p-8 text-center">
        <h2 className="text-2xl font-bold">Ready to start?</h2>
        <p className="mt-2 text-primary-foreground/80 max-w-xl mx-auto">
          Browse live auctions now, or read our buyer safety and seller information guides to learn more.
        </p>
      </div>
    </div>
  );
}