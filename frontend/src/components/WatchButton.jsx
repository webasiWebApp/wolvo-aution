import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useWatchlist } from '@/lib/auctionQueries';
import { Button } from '@/components/ui/button';
import { Heart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WatchButton({ auctionId, userId }) {
  const queryClient = useQueryClient();
  const { data: entries = [] } = useWatchlist(userId);
  const [toggling, setToggling] = useState(false);

  if (!userId) return null;
  const entry = entries.find((e) => e.auction_id === auctionId);
  const watched = !!entry;

  const toggle = async () => {
    setToggling(true);
    try {
      if (watched) {
        await base44.entities.Watchlist.delete(entry.id);
      } else {
        await base44.entities.Watchlist.create({ auction_id: auctionId });
      }
      queryClient.invalidateQueries({ queryKey: ['watchlist', userId] });
    } finally {
      setToggling(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={toggling}
      className={cn(watched && "text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-600")}
    >
      {toggling ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <Heart className={cn("h-4 w-4 mr-1.5", watched && "fill-current")} />
      )}
      {watched ? 'Watching' : 'Watch this auction'}
    </Button>
  );
}