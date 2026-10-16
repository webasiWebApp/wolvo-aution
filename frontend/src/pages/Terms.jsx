import React from 'react';

const SECTIONS = [
  { h: "1. Acceptance of terms", p: "By accessing or using Wolvo, you agree to these Terms and Conditions. If you do not agree, you must not use the platform." },
  { h: "2. Eligibility", p: "You must be at least 18 years old and able to form a legally binding contract to register, list items or place bids." },
  { h: "3. Accounts", p: "You are responsible for maintaining the security of your account and for all activity under it. You must provide accurate information at registration and verify your identity when requested." },
  { h: "4. Bidding", p: "A bid is a binding offer to buy at the stated amount. The highest bid at the close of an auction is the winning bid, subject to any reserve. Bids cannot be retracted once placed, except where permitted by law." },
  { h: "5. Listing and selling", p: "Sellers must own or be authorised to sell listed items, describe them accurately, and fulfil completed sales. We may remove listings that are misleading, prohibited or otherwise unsuitable." },
  { h: "6. Fees", p: "During the launch period, registration, browsing, bidding and attendance are free. Listing fees, commissions, featured-listing fees and subscriptions may be introduced by the administrator and will be disclosed before they apply." },
  { h: "7. Payments and settlement", p: "Settlement for completed sales is handled through the platform. Off-platform payments are not protected and are discouraged." },
  { h: "8. Prohibited conduct", p: "You must not manipulate bids, bid on your own listings, misuse the platform, infringe others' rights, or attempt to access administrative functions without authorisation." },
  { h: "9. Location privacy", p: "Public listings show suburb-level locations only. Exact addresses of private residences are not displayed publicly." },
  { h: "10. Limitation of liability", p: "The platform acts as a venue for auctions. To the extent permitted by law, we are not liable for the conduct of buyers or sellers, or for the condition or availability of listed items." },
  { h: "11. Changes to terms", p: "We may update these terms from time to time. Continued use after changes constitutes acceptance of the updated terms." },
  { h: "12. Governing law", p: "These terms are governed by the laws of Australia." }
];

export default function Terms() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Terms &amp; Conditions</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: October 2026</p>
      <div className="space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.h}>
            <h2 className="text-lg font-semibold text-foreground mb-2">{s.h}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.p}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 text-xs text-muted-foreground border-t border-border pt-6">
        This is a demonstration terms document for a development-stage platform and is not legal advice. Formal terms should be reviewed before launch.
      </p>
    </div>
  );
}