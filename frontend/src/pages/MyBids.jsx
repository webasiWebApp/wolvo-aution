import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useMyTransactions } from '@/lib/transactionQueries';
import { Button } from '@/components/ui/button';
import { Loader2, Gavel, CreditCard, BadgeCheck } from 'lucide-react';

const STATUS_STYLES = {
  winning: 'bg-emerald-100 text-emerald-700',
  outbid: 'bg-amber-100 text-amber-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-slate-200 text-slate-600',
  placed: 'bg-blue-100 text-blue-700'
};

export default function MyBids() {
  const { user } = useAuth();

  const { data: bids = [], isLoading } = useQuery({
    queryKey: ['my-bids', user?.id],
    queryFn: async () => {
      const page = await base44.entities.Bid.filter({ bidder_id: user.id }, { sort: '-created_date', limit: 200 });
      return page.items || [];
    },
    enabled: !!user?.id
  });

  const { data: myTxs = [] } = useMyTransactions();
  const txByAuction = {};
  for (const t of myTxs) { if (!txByAuction[t.auction_id]) txByAuction[t.auction_id] = t; }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Gavel className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold text-foreground">My bids</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Every bid you've placed across Wolvo.</p>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : bids.length === 0 ? (
        <div className="text-center py-20">
          <Gavel className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">You haven't placed any bids yet.</p>
          <Link to="/auctions"><Button className="mt-4">Browse auctions</Button></Link>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Auction</th>
                <th className="px-4 py-3">Your bid</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Placed</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {bids.map((b) => {
                const tx = txByAuction[b.auction_id];
                const won = b.status === 'won' && tx && tx.buyer_id === user?.id;
                const showPayNow = won && tx.status === 'pending_payment';
                const paid = won && tx.status !== 'pending_payment' && tx.status !== 'cancelled';
                return (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">{b.auction_title || '—'}</td>
                    <td className="px-4 py-3">${(b.amount || 0).toLocaleString('en-AU')}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[b.status] || STATUS_STYLES.placed}`}>
                        {b.status || 'placed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(b.created_date).toLocaleDateString('en-AU')}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {showPayNow ? (
                        <Link to={`/transactions/${tx.id}`}><Button size="sm"><CreditCard className="h-3.5 w-3.5 mr-1" /> Pay now</Button></Link>
                      ) : paid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><BadgeCheck className="h-3.5 w-3.5" /> Paid</span>
                      ) : (
                        <Link to={`/auctions/${b.auction_id}`} className="text-primary hover:underline text-xs font-medium">View</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}