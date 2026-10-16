import { useQuery } from '@tanstack/react-query';
import { base44, callFunction } from '@/api/base44Client';

export function usePaymentCheckout(transactionId) {
  return useQuery({
    queryKey: ['payment-checkout', transactionId],
    queryFn: async () => {
      if (!transactionId) return null;
      return await callFunction('getPaymentCheckout', { transaction_id: transactionId });
    },
    enabled: !!transactionId, staleTime: 10 * 1000
  });
}

export function usePaymentMethodConfig() {
  return useQuery({
    queryKey: ['payment-method-config'],
    queryFn: async () => {
      const page = await base44.entities.PaymentMethodConfig.filter({ config_name: 'default' }, { limit: 1 });
      return (page.items || [])[0] || null;
    },
    staleTime: 30 * 1000
  });
}

export function useAdminPayments() {
  return useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const txPage = await base44.entities.CompletedTransaction.filter({}, { sort: '-created_date', limit: 200 });
      const txs = txPage.items || [];
      const payPage = await base44.entities.Payment.filter({}, { sort: '-created_date', limit: 400 });
      const payments = payPage.items || [];
      const byTx = {};
      for (const p of payments) { if (!byTx[p.transaction_id]) byTx[p.transaction_id] = p; }
      return txs.map((t) => ({ ...t, payment: byTx[t.id] || null }));
    },
    staleTime: 15 * 1000
  });
}

export function usePaymentAudit() {
  return useQuery({
    queryKey: ['payment-audit'],
    queryFn: async () => {
      const page = await base44.entities.AuditLog.filter(
        { action: { $in: ['payment_method_selected', 'manual_payment_confirmed', 'payment_marked_failed', 'payment_marked_expired', 'refund_issued', 'payment_config_updated'] } },
        { sort: '-created_date', limit: 50 }
      );
      return page.items || [];
    },
    staleTime: 15 * 1000
  });
}