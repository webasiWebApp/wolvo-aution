import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Build a Mongo-style query from the filter object used by the browse UI.
export function buildAuctionQuery(filters = {}) {
  const q = {};
  if (filters.q) {
    q.title = { $regex: filters.q, $options: "i" };
  }
  if (filters.category) q.category = filters.category;
  if (filters.status) q.status = filters.status;
  if (filters.bidding_type) q.bidding_type = filters.bidding_type;
  if (filters.state) q.state = filters.state;
  if (filters.price) {
    const [min, max] = filters.price.split("-").map(Number);
    q.current_highest_bid = { $gte: min, $lte: max };
  }
  return q;
}

export function useAuctions(filters = {}, options = {}) {
  return useQuery({
    queryKey: ['auctions', filters],
    queryFn: async () => {
      const query = buildAuctionQuery(filters);
      const opts = { sort: options.sort || '-created_date', limit: options.limit || 50 };
      const page = await base44.entities.Auction.filter(query, opts);
      return page.items || [];
    },
    staleTime: 30 * 1000
  });
}

export function useAuction(id) {
  return useQuery({
    queryKey: ['auction', id],
    queryFn: async () => {
      if (!id) return null;
      return await base44.entities.Auction.get(id);
    },
    enabled: !!id,
    staleTime: 30 * 1000
  });
}

export function useBidsForAuction(auctionId) {
  return useQuery({
    queryKey: ['bids', auctionId],
    queryFn: async () => {
      if (!auctionId) return [];
      const page = await base44.entities.Bid.filter({ auction_id: auctionId }, { sort: '-amount', limit: 50 });
      return page.items || [];
    },
    enabled: !!auctionId,
    staleTime: 15 * 1000
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const page = await base44.entities.Category.list({ sort: 'name', limit: 100 });
      return page.items || [];
    },
    staleTime: 5 * 60 * 1000
  });
}

// Distinct categories derived from existing auctions (fallback when Category table is empty).
export function useAuctionCategories() {
  return useQuery({
    queryKey: ['auction-categories'],
    queryFn: async () => {
      const page = await base44.entities.Auction.list({ distinct: 'category', limit: 100 });
      return (page.items || []).filter(Boolean).sort();
    },
    staleTime: 60 * 1000
  });
}

export function useWatchlist(userId) {
  return useQuery({
    queryKey: ['watchlist', userId],
    queryFn: async () => {
      const page = await base44.entities.Watchlist.filter({}, { sort: '-created_date', limit: 100 });
      return page.items || [];
    },
    enabled: !!userId,
    staleTime: 15 * 1000
  });
}