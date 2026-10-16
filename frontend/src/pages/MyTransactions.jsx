import React from 'react';
import { Link } from 'react-router-dom';
import { useMyTransactions } from '@/lib/transactionQueries';
import { Loader2, ArrowRight } from 'lucide-react';

const STATUS = { pending_payment: 'Pending payment', paid: 'Paid', ready_for_collection: 'Ready for collection', completed: 'Completed', cancelled: 'Cancelled' };

export default function MyTransactions() {
  const { data: txs = [], isLoading } = useMyTransactions();
  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-foreground mb-4">My transactions</h1>
      <p className="text-sm text-muted-foreground mb-5">Auctions you have won or sold. Payment is recorded manually; no card details are stored.</p>
      {txs.length === 0 && <p className="text-sm text-muted-foreground">No transactions yet.</p>}
      <div className="space-y-2">
        {txs.map((t) => (
          <Link key={t.id} to={`/transactions/${t.id}`} className="block rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">#{t.id.slice(-8).toUpperCase()} · ${(t.total || t.final_price || 0).toLocaleString('en-AU')}</p>
                <p className="text-xs text-muted-foreground">Auction {t.auction_id?.slice(-6).toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : t.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{STATUS[t.status] || t.status}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}