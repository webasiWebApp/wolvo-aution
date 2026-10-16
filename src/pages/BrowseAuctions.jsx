import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuctions, useAuctionCategories } from '@/lib/auctionQueries';
import AuctionCard from '@/components/AuctionCard';
import AuctionFilters from '@/components/AuctionFilters';
import { Loader2 } from 'lucide-react';

export default function BrowseAuctions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    category: searchParams.get('category') || '',
    status: '',
    bidding_type: '',
    price: '',
    state: ''
  });
  const { data: categories = [] } = useAuctionCategories();
  const { data: auctions = [], isLoading } = useAuctions(filters, { sort: '-closing_time', limit: 60 });

  // Keep the URL in sync with the search box so links/deep-links work.
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.category) params.set('category', filters.category);
    setSearchParams(params, { replace: true });
  }, [filters.q, filters.category]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Browse auctions</h1>
        <p className="mt-1.5 text-muted-foreground">Search live, upcoming and completed auctions across Australia.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5 mb-6">
        <AuctionFilters value={filters} onChange={setFilters} categories={categories} />
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {isLoading ? 'Loading…' : `${auctions.length} auction${auctions.length === 1 ? '' : 's'} found`}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : auctions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No auctions match your filters.</p>
          <button onClick={() => setFilters({ q: '', category: '', status: '', bidding_type: '', price: '', state: '' })} className="mt-3 text-sm font-medium text-primary hover:underline">
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {auctions.map((a) => (
            <AuctionCard key={a.id} auction={a} />
          ))}
        </div>
      )}
    </div>
  );
}