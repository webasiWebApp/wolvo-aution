import React from 'react';

const SECTIONS = [
  {
    h: "1. Information we collect",
    p: "We collect the information you provide when you register, list items, place bids or contact us, including your name, email address, phone number and verified identity details. We also collect technical data such as device and usage information to operate and secure the platform."
  },
  {
    h: "2. How we use your information",
    p: "We use your information to operate the marketplace, process registrations and bids, facilitate transactions, verify identity, communicate with you about auctions and sales, and to detect and prevent fraud or misuse."
  },
  {
    h: "3. Listing location data",
    p: "Public listings display only the suburb-level location of items. We do not expose the exact street address of a private residence on public listings. Precise collection details are shared only with the relevant parties once a sale is arranged."
  },
  {
    h: "4. Sharing of information",
    p: "We share information with the counterparty to a transaction (such as the winning bidder and seller) to the extent necessary to complete the sale. We do not sell your personal information to third parties."
  },
  {
    h: "5. Data security",
    p: "We use role-based access controls and a secure backend to protect your data. Administrative functions are restricted to authorised administrators and cannot be reached by manipulating URLs or browser requests."
  },
  {
    h: "6. Your rights",
    p: "You may request access to, correction of, or deletion of your personal information, subject to applicable Australian privacy law. Contact us through the Contact page to make a request."
  },
  {
    h: "7. Contact",
    p: "If you have any questions about this policy or how we handle your information, please contact us through the Contact page."
  }
];

export default function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">Privacy Policy</h1>
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
        This is a demonstration policy for a development-stage platform and is not legal advice. A formal privacy policy should be reviewed before launch.
      </p>
    </div>
  );
}