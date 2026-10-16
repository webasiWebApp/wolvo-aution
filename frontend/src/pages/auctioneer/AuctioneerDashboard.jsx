import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AuctioneerDetail from '@/components/auctioneer/AuctioneerDetail';
import { Link } from 'react-router-dom';
import { Loader2, Gavel } from 'lucide-react';

export default function AuctioneerDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [selectedId, setSelectedId] = useState(null);

  const { data: auctions = [], isLoading } = useQuery({
    queryKey: ['auctioneer-auctions', user?.id, isAdmin],
    queryFn: async () => {
      const query = isAdmin ? {} : { auctioneer_id: user.id };
      const page = await base44.entities.Auction.filter(query, { sort: '-created_date', limit: 100 });
      return page.items || [];
    },
    enabled: !!user
  });

  const selected = auctions.find((a) => a.id === selectedId) || auctions[0];

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Gavel className="h-6 w-6" /> Auctioneer console</h1>
        <p className="text-sm text-muted-foreground">Enter physical bids, monitor online bids, pause or close the auction.</p>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {auctions.length === 0 && <p className="text-sm text-muted-foreground">No auctions assigned to you.</p>}
          {auctions.map((a) => (
            <button key={a.id} onClick={() => setSelectedId(a.id)} className={`w-full text-left p-3 rounded-lg border ${selected?.id === a.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground text-sm truncate">{a.title}</span>
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 ${a.paused ? 'bg-amber-100 text-amber-700' : a.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{a.paused ? 'Paused' : a.status}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                <span className="capitalize">{a.bidding_type}</span> · ${(a.current_highest_bid || a.starting_bid || 0).toLocaleString('en-AU')} · {a.bid_count || 0} bids
              </div>
              <Link to={`/auctioneer/manage/${a.id}`} onClick={(e) => e.stopPropagation()} className="mt-1 inline-block text-xs text-primary hover:underline">Manage event →</Link>
            </button>
          ))}
        </div>
        <div className="lg:col-span-2">
          {selected ? <AuctioneerDetail auction={selected} /> : <div className="rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">Select an auction to manage.</div>}
        </div>
      </div>
    </div>
  );
}