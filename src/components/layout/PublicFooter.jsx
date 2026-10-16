import React from 'react';
import { Link } from 'react-router-dom';

const LOGO_URL = 'https://media.base44.com/images/public/6acf0f20dea3206601d70422/87021ca00_generated_image.png';

const FOOTER_SECTIONS = [
  {
    title: "Marketplace",
    links: [
      { label: "Browse Auctions", path: "/auctions" },
      { label: "Upcoming Auctions", path: "/upcoming" },
      { label: "Completed Auctions", path: "/completed" }
    ]
  },
  {
    title: "Information",
    links: [
      { label: "How It Works", path: "/how-it-works" },
      { label: "Buyer Safety", path: "/buyer-safety" },
      { label: "Seller Information", path: "/sellers" },
      { label: "FAQs", path: "/faq" }
    ]
  },
  {
    title: "Legal & Support",
    links: [
      { label: "Contact", path: "/contact" },
      { label: "Privacy Policy", path: "/privacy" },
      { label: "Terms & Conditions", path: "/terms" }
    ]
  }
];

export default function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-primary text-primary-foreground mt-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-3">
              <img src={LOGO_URL} alt="Wolvo" className="h-8 w-8 rounded-lg object-cover" />
              <span className="font-bold tracking-tight">WOLVO</span>
            </Link>
            <p className="text-sm text-primary-foreground/70 max-w-xs">
              Australia's online auction marketplace. Bid with confidence on vehicles, equipment, collectables and more, from coast to coast.
            </p>
          </div>
          {FOOTER_SECTIONS.map((s) => (
            <div key={s.title}>
              <h4 className="text-sm font-semibold mb-3">{s.title}</h4>
              <ul className="space-y-2">
                {s.links.map((l) => (
                  <li key={l.path}>
                    <Link to={l.path} className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-primary-foreground/70">
            © {new Date().getFullYear()} Wolvo. A demonstration platform. Listings marked "Sample" are not real auctions.
          </p>
          <p className="text-xs text-primary-foreground/70">Australia-wide</p>
        </div>
      </div>
    </footer>
  );
}