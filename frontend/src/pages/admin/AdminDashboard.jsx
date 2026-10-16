import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Gavel, TrendingUp, CheckCircle2, Mail, Users, ArrowRight, DollarSign } from 'lucide-react';

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [open, upcoming, closed, bids, messages] = await Promise.all([
        base44.entities.Auction.count({ status: 'open' }),
        base44.entities.Auction.count({ status: 'upcoming' }),
        base44.entities.Auction.count({ status: 'closed' }),
        base44.entities.Bid.count({}),
        base44.entities.ContactMessage.count({ status: 'new' })
      ]);
      let userCount = 0;
      try {
        const users = await base44.entities.User.list();
        userCount = Array.isArray(users) ? users.length : (users.items?.length || 0);
      } catch { userCount = 0; }
      return { open, upcoming, closed, bids, messages, userCount };
    }
  });

  const { data: recent = [] } = useQuery({
    queryKey: ['admin-recent'],
    queryFn: async () => {
      const page = await base44.entities.Auction.filter({}, { sort: '-created_date', limit: 5 });
      return page.items || [];
    }
  });

  const cards = [
    { label: 'Live auctions', value: stats?.open ?? '—', icon: Gavel, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Upcoming', value: stats?.upcoming ?? '—', icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
    { label: 'Closed', value: stats?.closed ?? '—', icon: CheckCircle2, color: 'text-slate-600 bg-slate-100' },
    { label: 'Total bids', value: stats?.bids ?? '—', icon: DollarSign, color: 'text-amber-600 bg-amber-50' },
    { label: 'New messages', value: stats?.messages ?? '—', icon: Mail, color: 'text-purple-600 bg-purple-50' },
    { label: 'Accounts', value: stats?.userCount ?? '—', icon: Users, color: 'text-indigo-600 bg-indigo-50' }
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
      <p className="text-sm text-muted-foreground mb-6">Platform overview for Wolvo.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg mb-3 ${c.color}`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              <p className="text-2xl font-bold text-foreground">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground">Recent listings</h2>
            <Link to="/admin/listings" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No listings yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((a) => (
                <li key={a.id} className="py-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">${(a.current_highest_bid || a.starting_bid || 0).toLocaleString('en-AU')} · {a.status}</p>
                  </div>
                  {a.is_sample && <span className="text-[10px] font-bold uppercase bg-black/70 text-white px-1.5 py-0.5 rounded">Sample</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold text-foreground mb-4">Quick actions</h2>
          <div className="space-y-2">
            <Link to="/admin/listings" className="block rounded-lg border border-border p-3 hover:bg-muted transition-colors">
              <p className="text-sm font-medium text-foreground">Create a listing</p>
              <p className="text-xs text-muted-foreground">Add a new auction with photos, pricing and format.</p>
            </Link>
            <Link to="/admin/settings" className="block rounded-lg border border-border p-3 hover:bg-muted transition-colors">
              <p className="text-sm font-medium text-foreground">Configure pricing</p>
              <p className="text-xs text-muted-foreground">Listing fees, commissions, featured upgrades and subscriptions.</p>
            </Link>
            <Link to="/admin/accounts" className="block rounded-lg border border-border p-3 hover:bg-muted transition-colors">
              <p className="text-sm font-medium text-foreground">Manage accounts</p>
              <p className="text-xs text-muted-foreground">View registered buyers, sellers and administrators.</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}