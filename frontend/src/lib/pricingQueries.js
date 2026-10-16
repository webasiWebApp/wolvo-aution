import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function usePricingConfig() {
  return useQuery({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const page = await base44.entities.PricingConfig.filter({ config_name: 'default' }, { limit: 1 });
      return (page.items && page.items[0]) || null;
    },
    staleTime: 60 * 1000
  });
}

export function usePricingHistory() {
  return useQuery({
    queryKey: ['pricing-history'],
    queryFn: async () => {
      const page = await base44.entities.AuditLog.filter({ action: 'pricing_config_updated' }, { sort: '-created_date', limit: 20 });
      return page.items || [];
    },
    staleTime: 30 * 1000
  });
}

export function useVerificationUsage() {
  return useQuery({
    queryKey: ['verification-usage'],
    queryFn: async () => {
      const res = await base44.entities.VerificationCase.aggregate({ groupBy: 'verification_status' });
      const rows = res.rows || [];
      const map = {};
      for (const r of rows) map[r.verification_status] = r.count;
      return { byStatus: map, total: rows.reduce((s, r) => s + r.count, 0) };
    },
    staleTime: 60 * 1000
  });
}