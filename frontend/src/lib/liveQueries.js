import { useQuery } from '@tanstack/react-query';
import { base44, callFunction } from '@/api/base44Client';

// Current Go Live state for an auction or garage sale event. Polled so the
// viewer panel detects when an auctioneer starts or stops a broadcast.
export function useLiveStream(targetType, targetId) {
  return useQuery({
    queryKey: ['live-stream', targetType, targetId],
    queryFn: async () => {
      if (!targetType || !targetId) return null;
      return await callFunction('getLiveStream', { target_type: targetType, target_id: targetId });
    },
    enabled: !!targetType && !!targetId,
    refetchInterval: 8000,
    staleTime: 5000
  });
}