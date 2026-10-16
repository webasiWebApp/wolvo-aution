import React from 'react';
import { useAuctions } from '@/lib/auctionQueries';
import AuctionCard from '@/components/AuctionCard';
import { Loader2, CalendarClock } from 'lucide-react';

export default function UpcomingAuctions() {
  const { data: auctions = [], isLoading } = useAuctions({ status: 'upcoming' }, { sort: 'start_time', limit: 60 });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Upcoming auctions</h1>
          <p className="text-muted-foreground">Auctions opening soon. Register early so you're ready to bid.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : auctions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No upcoming auctions scheduled right now. Please check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {auctions.map((a) => <AuctionCard key={a.id} auction={a} />)}
        </div>
      )}
    </div>
  );
}