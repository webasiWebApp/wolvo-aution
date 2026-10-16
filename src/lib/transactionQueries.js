import { useQuery } from '@tanstack/react-query';
import { base44, callFunction } from '@/api/base44Client';

export function useTransaction(id) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => { if (!id) return null; return await base44.entities.CompletedTransaction.get(id); },
    enabled: !!id, staleTime: 15 * 1000
  });
}

export function useCollectionInfo(id) {
  return useQuery({
    queryKey: ['collection-info', id],
    queryFn: async () => {
      return await callFunction('getCollectionInfo', { transaction_id: id });
    },
    enabled: !!id, staleTime: 15 * 1000
  });
}

export function useTransactionDisputes(id) {
  return useQuery({
    queryKey: ['transaction-disputes', id],
    queryFn: async () => {
      const page = await base44.entities.Dispute.filter({ transaction_id: id }, { sort: '-created_date', limit: 50 });
      return page.items || [];
    },
    enabled: !!id, staleTime: 10 * 1000
  });
}

export function useTransactionReviews(id) {
  return useQuery({
    queryKey: ['transaction-reviews', id],
    queryFn: async () => {
      const page = await base44.entities.Review.filter({ transaction_id: id }, { sort: '-created_date', limit: 50 });
      return page.items || [];
    },
    enabled: !!id, staleTime: 10 * 1000
  });
}

export function useMyTransactions() {
  return useQuery({
    queryKey: ['my-transactions'],
    queryFn: async () => {
      const page = await base44.entities.CompletedTransaction.filter({}, { sort: '-created_date', limit: 100 });
      return page.items || [];
    },
    staleTime: 15 * 1000
  });
}

// The transaction for a given auction, visible only to its buyer/seller/admin
// (RLS enforces this). Used to surface a "Pay now" CTA to the winning bidder.
export function useTransactionForAuction(auctionId) {
  return useQuery({
    queryKey: ['transaction-for-auction', auctionId],
    queryFn: async () => {
      if (!auctionId) return null;
      const page = await base44.entities.CompletedTransaction.filter({ auction_id: auctionId }, { sort: '-created_date', limit: 1 });
      return (page.items || [])[0] || null;
    },
    enabled: !!auctionId, staleTime: 15 * 1000
  });
}