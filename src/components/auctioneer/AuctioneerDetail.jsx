import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44, invokeFunction } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Gavel, Pause, Play, Lock, Monitor, Building2 } from 'lucide-react';

export default function AuctioneerDetail({ auction }) {
  const queryClient = useQueryClient();
  const [bidderId, setBidderId] = useState('');
  const [amount, setAmount] = useState('');
  const [extendMin, setExtendMin] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const { data: bids = [], isLoading: bidsLoading } = useQuery({
    queryKey: ['bids', auction.id],
    queryFn: async () => {
      const page = await base44.entities.Bid.filter({ auction_id: auction.id }, { sort: '-created_date', limit: 100 });
      return page.items || [];
    }
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['bids', auction.id] });
    queryClient.invalidateQueries({ queryKey: ['auctioneer-auctions'] });
    queryClient.invalidateQueries({ queryKey: ['auction', auction.id] });
    queryClient.invalidateQueries({ queryKey: ['auctions'] });
  };

  const call = async (name, payload, label) => {
    setBusy(name); setMsg('');
    try {
      const res = await invokeFunction(name, payload);
      if (res.status >= 400) setMsg(`Error: ${res.data?.error || label + ' failed'}`);
      else { setMsg(`${label} succeeded.`); refresh(); }
    } catch (e) {
      setMsg(`Error: ${e.message}`);
    } finally { setBusy(''); }
  };

  const canEnterPhysical = auction.bidding_type === 'physical' || auction.bidding_type === 'hybrid';
  const isOpen = auction.status === 'open';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">{auction.title}</h2>
          <p className="text-xs text-muted-foreground capitalize">{auction.bidding_type} auction · {auction.suburb}, {auction.state}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Current highest bid</p>
          <p className="text-2xl font-bold text-foreground">${(auction.current_highest_bid || auction.starting_bid || 0).toLocaleString('en-AU')}</p>
          <p className="text-xs text-muted-foreground">{auction.bid_count || 0} bids</p>
        </div>
      </div>

      {auction.paused && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Auction paused{auction.pause_reason ? `: ${auction.pause_reason}` : ''}. Bids are not accepted while paused.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {isOpen && !auction.paused && (
          <>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => { const r = prompt('Reason for pausing (e.g. network interruption):'); if (r != null) call('pauseAuction', { auction_id: auction.id, reason: r }, 'Pause'); }}>
              <Pause className="h-4 w-4 mr-1" /> Pause
            </Button>
            <Button variant="destructive" size="sm" disabled={!!busy} onClick={() => { if (confirm('Close this auction? The winning bid will be finalised.')) call('closeAuction', { auction_id: auction.id }, 'Close'); }}>
              <Lock className="h-4 w-4 mr-1" /> Close auction
            </Button>
          </>
        )}
        {isOpen && auction.paused && (
          <>
            <Button size="sm" disabled={!!busy} onClick={() => call('resumeAuction', { auction_id: auction.id, extend_minutes: Number(extendMin) || 0 }, 'Resume')}>
              <Play className="h-4 w-4 mr-1" /> Resume
            </Button>
            <input type="number" value={extendMin} onChange={(e) => setExtendMin(e.target.value)} placeholder="Extend by (min)" className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm" />
          </>
        )}
      </div>

      {canEnterPhysical && isOpen && (
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Gavel className="h-4 w-4" /> Enter physical bid</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <input value={bidderId} onChange={(e) => setBidderId(e.target.value)} placeholder="Bidder user id" className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount $" className="h-10 rounded-md border border-input bg-background px-3 text-sm" />
            <Button disabled={!!busy} onClick={() => { call('auctioneerPlaceBid', { auction_id: auction.id, bidder_id: bidderId, amount: Number(amount) }, 'Physical bid'); setAmount(''); }}>Enter bid</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">The bidder must be verified with 2FA enabled. Physical bids share the same state as online bids.</p>
        </div>
      )}

      {msg && <p className="text-sm text-foreground">{msg}</p>}

      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Bid history</p>
        {bidsLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : bids.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bids yet.</p>
        ) : (
          <ul className="divide-y divide-border max-h-80 overflow-y-auto">
            {bids.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${b.bid_source === 'physical' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {b.bid_source === 'physical' ? <Building2 className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}{b.bid_source || 'online'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.bidder_name || 'Anonymous'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(b.created_date).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">${b.amount.toLocaleString('en-AU')}</p>
                  <span className={`text-xs font-medium ${b.status === 'winning' || b.status === 'won' ? 'text-emerald-600' : 'text-muted-foreground'}`}>{b.status}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}