import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@/api/base44Client';
import { BadgeCheck, ShieldCheck, Loader2 } from 'lucide-react';

// Shows a bidder what still blocks them before bidding: identity verification
// and two-factor authentication. The backend enforces both; this just guides.
export default function BidReadiness() {
  const { data: v } = useQuery({
    queryKey: ['verification-status'],
    queryFn: async () => await callFunction('getVerificationStatus')
  });
  const { data: tf } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: async () => await callFunction('getTwoFactorStatus')
  });

  if (!v || !tf) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking eligibility…</div>;
  }

  const verified = v.verification_status === 'VERIFIED';
  const twoFactor = !!tf.enabled;

  if (verified && twoFactor) return null;

  return (
    <div className="space-y-2 mb-3">
      {!verified && (
        <Link to="/verify" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 hover:bg-amber-100">
          <BadgeCheck className="h-4 w-4 shrink-0" /> Identity verification required before you can bid. <span className="font-semibold underline ml-1">Verify now</span>
        </Link>
      )}
      {!twoFactor && (
        <Link to="/security" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 hover:bg-amber-100">
          <ShieldCheck className="h-4 w-4 shrink-0" /> Two-factor authentication required before you can bid. <span className="font-semibold underline ml-1">Enable now</span>
        </Link>
      )}
    </div>
  );
}