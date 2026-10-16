import { useQuery } from '@tanstack/react-query';
import { base44, callFunction } from '@/api/base44Client';

export function useInspectionInfo(auctionId) {
  return useQuery({
    queryKey: ['inspection-info', auctionId],
    queryFn: async () => {
      return await callFunction('getInspectionInfo', { auction_id: auctionId });
    },
    enabled: !!auctionId,
    staleTime: 15 * 1000
  });
}

export function useMyViewings(auctionId, userId) {
  return useQuery({
    queryKey: ['my-viewings', auctionId, userId],
    queryFn: async () => {
      const page = await base44.entities.ViewingAppointment.filter({ auction_id: auctionId }, { sort: '-created_date', limit: 20 });
      return page.items || [];
    },
    enabled: !!auctionId && !!userId,
    staleTime: 10 * 1000
  });
}

export function useAttendanceInfo(auctionId) {
  return useQuery({
    queryKey: ['attendance-info', auctionId],
    queryFn: async () => {
      const data = await callFunction('getAttendanceInfo', { auction_id: auctionId });
      return data?.attendance || { enabled: false };
    },
    enabled: !!auctionId,
    staleTime: 15 * 1000
  });
}

export function useMyAttendance(auctionId, userId) {
  return useQuery({
    queryKey: ['my-attendance', auctionId, userId],
    queryFn: async () => {
      const page = await base44.entities.AttendanceRegistration.filter({ auction_id: auctionId }, { sort: '-created_date', limit: 5 });
      return (page.items || [])[0] || null;
    },
    enabled: !!auctionId && !!userId,
    staleTime: 10 * 1000
  });
}

// All bookings (admin) for the management console — service-role via functions
// would be ideal; here we rely on admin RLS read which returns all records.
export function useAllViewings(auctionId) {
  return useQuery({
    queryKey: ['all-viewings', auctionId],
    queryFn: async () => {
      const page = await base44.entities.ViewingAppointment.filter({ auction_id: auctionId }, { sort: '-created_date', limit: 200 });
      return page.items || [];
    },
    enabled: !!auctionId,
    staleTime: 10 * 1000
  });
}

export function useAllAttendance(auctionId) {
  return useQuery({
    queryKey: ['all-attendance', auctionId],
    queryFn: async () => {
      const page = await base44.entities.AttendanceRegistration.filter({ auction_id: auctionId }, { sort: '-created_date', limit: 500 });
      return page.items || [];
    },
    enabled: !!auctionId,
    staleTime: 10 * 1000
  });
}

export function useInspectionSlotsAdmin(auctionId) {
  return useQuery({
    queryKey: ['inspection-slots-admin', auctionId],
    queryFn: async () => {
      const page = await base44.entities.InspectionSlot.filter({ auction_id: auctionId }, { sort: 'scheduled_at', limit: 100 });
      return page.items || [];
    },
    enabled: !!auctionId,
    staleTime: 10 * 1000
  });
}