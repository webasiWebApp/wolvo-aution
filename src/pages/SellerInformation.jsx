import React from 'react';
import { Tag, Camera, MapPin, Gavel, TrendingUp, Wallet, FileText, CheckCircle2 } from 'lucide-react';

const STEPS = [
  { icon: Tag, title: "Create your listing", text: "Add a title, description, condition, suburb location and clear photographs. Set a starting bid, minimum increment and reserve price." },
  { icon: Camera, title: "Add quality photos", text: "Good photography sells. Multiple clear, well-lit images from different angles help buyers bid with confidence." },
  { icon: Gavel, title: "Choose your format", text: "List as online-only, in-person at venues across Australia, or hybrid. You decide how buyers can participate." },
  { icon: TrendingUp, title: "Watch the bidding", text: "Track bids in real time. The current highest bid and bid count update live on your listing." },
  { icon: Wallet, title: "Get paid", text: "When the auction closes, the winning bidder is notified. Settlement is handled securely through the platform." },
  { icon: FileText, title: "Complete the sale", text: "Arrange collection or delivery. Both parties confirm completion to close out the sale." }
];

export default function SellerInformation() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Sell on Wolvo</h1>
        <p className="mt-3 text-muted-foreground">
          Reach motivated buyers across Australia. Listing is free during our launch period, with flexible formats to suit what you're selling.
        </p>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 mb-10">
        <h3 className="font-semibold text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" /> Free during launch
        </h3>
        <p className="text-sm text-emerald-900/90 mt-1">
          Registration, listing, bidding and attendance are all free. Listing fees, commissions and featured-listing upgrades can be enabled by the administrator as the marketplace grows, without rebuilding the platform.
        </p>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-6">How selling works</h2>
      <div className="space-y-4 mb-12">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="flex gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{s.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-6">
          <MapPin className="h-6 w-6 text-primary mb-2" />
          <h3 className="font-semibold text-foreground">Your privacy is protected</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Public listings show your suburb only, never your exact street address. Private residence details stay private until a sale is arranged.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6">
          <Gavel className="h-6 w-6 text-primary mb-2" />
          <h3 className="font-semibold text-foreground">Built to scale</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Nationwide from day one, with auctions across every state and territory.
          </p>
        </div>
      </div>
    </div>
  );
}