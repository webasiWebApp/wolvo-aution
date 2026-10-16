import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAQS = [
  { q: "Do I need an account to browse auctions?", a: "No. Anyone can browse public listings, view product information and check current auction status without registering. You only need an account to place bids." },
  { q: "Is it free to use the marketplace?", a: "Yes. During the launch period, registration, browsing, identity verification, bidding, viewing appointments and attendance registration are all free. Listing fees, commissions and featured upgrades may be introduced later and will be clearly shown before they apply." },
  { q: "What's the difference between online, physical and hybrid auctions?", a: "Online auctions are bid entirely online. Physical auctions are attended in person at venues across Australia. Hybrid auctions allow both online and in-person bidding in the same auction. Each listing shows which formats it supports." },
  { q: "How does the countdown timer work?", a: "Each open auction shows a live countdown to its closing time. When the timer reaches zero, the auction closes and the highest bidder wins. Bids placed in the final minutes may be subject to anti-snipe extensions in a future update." },
  { q: "What is a minimum bid increment?", a: "Each auction sets a minimum amount by which a new bid must exceed the current highest bid. This keeps bidding orderly and is shown on every listing." },
  { q: "Why can't I see the seller's exact address?", a: "To protect sellers' privacy, public listings show only the suburb. Exact collection details are shared only once a sale is arranged and confirmed." },
  { q: "Are the listings real?", a: "Listings marked 'Sample' are demonstration data for development and are not real auctions. Real listings will not carry the Sample badge." },
  { q: "How do I pay if I win?", a: "Winning bidders are notified when an auction closes. Settlement is handled securely through the platform, not by cash handovers, so your payment is tracked and protected." },
  { q: "Can I sell on the marketplace?", a: "Yes. Visit our Seller Information page for the full process. During launch, listing is free. Sellers are vetted and identity-verified before listing." },
  { q: "Which areas does the marketplace cover?", a: "Wolvo runs auctions across every Australian state and territory, from coast to coast." }
];

function Item({ faq, open, onToggle }) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="font-medium text-foreground">{faq.q}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
      )}
    </div>
  );
}

export default function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">Frequently asked questions</h1>
        <p className="mt-3 text-muted-foreground">Everything you need to know about buying and selling on Wolvo.</p>
      </div>
      <div className="rounded-xl border border-border bg-card px-5">
        {FAQS.map((faq, i) => (
          <Item key={i} faq={faq} open={openIdx === i} onToggle={() => setOpenIdx(openIdx === i ? -1 : i)} />
        ))}
      </div>
    </div>
  );
}