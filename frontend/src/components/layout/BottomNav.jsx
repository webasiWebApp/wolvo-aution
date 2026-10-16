import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Heart, Gavel, Receipt, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { label: 'Browse', path: '/auctions', icon: Home, match: ['/auctions', '/upcoming', '/completed', '/'] },
  { label: 'Watchlist', path: '/watchlist', icon: Heart, match: ['/watchlist'] },
  { label: 'Bids', path: '/my-bids', icon: Gavel, match: ['/my-bids'] },
  { label: 'Orders', path: '/my-transactions', icon: Receipt, match: ['/my-transactions', '/transactions'] },
  { label: 'Security', path: '/security', icon: ShieldCheck, match: ['/security', '/verify', '/verify-2fa'] }
];

export default function BottomNav() {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 select-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="mx-auto max-w-2xl grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.match.some((m) => (m === '/' ? pathname === '/' : pathname.startsWith(m)));
          const Icon = t.icon;
          return (
            <Link
              key={t.path}
              to={t.path}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors',
                active ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'fill-accent/10')} />
              <span className={cn(active && 'font-semibold')}>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}