import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { callFunction } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

// Post-login MFA gate: the platform grants a session on password login with no
// TOTP hook, so we enforce the second factor here. Enabled-2FA users who haven't
// passed a TOTP challenge this session are redirected to the challenge page.
// Sensitive actions (bidding, 2FA changes) are also enforced on the backend.
export default function MfaGate() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: async () => await callFunction('getTwoFactorStatus'),
    enabled: !!user,
    staleTime: 30 * 1000
  });

  useEffect(() => {
    if (!user || !data) return;
    if (data.enabled && !data.mfa_verified && location.pathname !== '/verify-2fa') {
      const returnTo = encodeURIComponent(location.pathname + location.search);
      navigate(`/verify-2fa?returnTo=${returnTo}`, { replace: true });
    }
  }, [user, data, location.pathname, location.search, navigate]);

  return null;
}