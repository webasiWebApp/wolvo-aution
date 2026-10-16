import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useWatchlist } from '@/lib/auctionQueries';
import AuctionCard from '@/components/AuctionCard';
import { Button } from '@/components/ui/button';
import { Loader2, Heart, HeartOff } from 'lucide-react';

export default function Watchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: entries = [], isLoading } = useWatchlist(user?.id);

  const ids = entries.map((e) => e.auction_id);
  const { data: auctions = [], isLoading: loadingAuctions } = useQuery({
    queryKey: ['watchlist-auctions', ids.join(',')],
    queryFn: async () => {
      if (!ids.length) return [];
      const results = await Promise.all(ids.map((id) => base44.entities.Auction.get(id).catch(() => null)));
      return results.filter(Boolean);
    },
    enabled: ids.length > 0
  });

  const remove = async (entryId) => {
    await base44.entities.Watchlist.delete(entryId);
    queryClient.invalidateQueries({ queryKey: ['watchlist', user?.id] });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Heart className="h-6 w-6 text-rose-500" />
        <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Auctions you're keeping an eye on.</p>

      {isLoading || loadingAuctions ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : auctions.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">You aren't watching any auctions yet.</p>
          <Link to="/auctions"><Button className="mt-4">Browse auctions</Button></Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {auctions.map((a) => {
            const entry = entries.find((e) => e.auction_id === a.id);
            return (
              <div key={a.id} className="relative">
                <AuctionCard auction={a} />
                {entry && (
                  <button
                    onClick={() => remove(entry.id)}
                    className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-md bg-card/90 border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:text-rose-600 hover:border-rose-200 shadow-sm"
                  >
                    <HeartOff className="h-3.5 w-3.5" /> Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}