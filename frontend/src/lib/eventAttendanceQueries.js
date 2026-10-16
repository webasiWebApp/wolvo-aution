import { useQuery } from '@tanstack/react-query';
import { base44, callFunction } from '@/api/base44Client';

// Event-level physical attendance slots + the signed-in visitor's own RSVP.
// Used by the EventAttendancePanel on garage sale / house clearance events.
export function useEventAttendance(eventId) {
  return useQuery({
    queryKey: ['event-attendance', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      return await callFunction('getEventAttendance', { event_id: eventId });
    },
    enabled: !!eventId,
    staleTime: 15 * 1000
  });
}