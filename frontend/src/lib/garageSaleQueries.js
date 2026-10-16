import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useGarageSaleEvents(status = 'open') {
  return useQuery({
    queryKey: ['garage-sale-events', status],
    queryFn: async () => {
      const q = status ? { status } : {};
      const page = await base44.entities.GarageSaleEvent.filter(q, { sort: '-created_date', limit: 50 });
      return page.items || [];
    },
    staleTime: 30 * 1000
  });
}

export function useGarageSaleEvent(id) {
  return useQuery({
    queryKey: ['garage-sale-event', id],
    queryFn: async () => {
      if (!id) return null;
      return await base44.entities.GarageSaleEvent.get(id);
    },
    enabled: !!id,
    staleTime: 30 * 1000
  });
}

export function useEventItems(eventId) {
  return useQuery({
    queryKey: ['event-items', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const page = await base44.entities.Auction.filter({ garage_sale_event_id: eventId }, { sort: 'closing_time', limit: 100 });
      return page.items || [];
    },
    enabled: !!eventId,
    staleTime: 30 * 1000
  });
}

export function useItemComments(auctionId) {
  return useQuery({
    queryKey: ['item-comments', auctionId],
    queryFn: async () => {
      if (!auctionId) return [];
      const page = await base44.entities.ItemComment.filter({ auction_id: auctionId, status: 'visible' }, { sort: 'created_date', limit: 200 });
      return page.items || [];
    },
    enabled: !!auctionId,
    staleTime: 15 * 1000
  });
}