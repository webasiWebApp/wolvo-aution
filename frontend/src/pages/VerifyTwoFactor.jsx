import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@/api/base44Client';
import { safeReturnTo } from '@/lib/authReturnTo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, Loader2, KeyRound } from 'lucide-react';

const errOf = (e) => (e && e.message) || 'Verification failed.';

export default function VerifyTwoFactor() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('totp');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lostBusy, setLostBusy] = useState(false);
  const [lostMsg, setLostMsg] = useState('');

  const requestLost = async () => {
    setError(''); setLostBusy(true);
    try {
      await callFunction('requestLostAuthenticator', {});
      setLostMsg('Your request has been logged. An administrator will reset your two-factor authentication after identity re-verification, so you can set it up and scan the QR code again.');
    } catch (e) {
      setError(errOf(e));
    } finally { setLostBusy(false); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const payload = mode === 'totp' ? { code } : { recovery_code: recovery };
      await callFunction('verifyTwoFactor', payload);
      // Refresh the 2FA status MfaGate reads, and wait for the fresh value
      // before leaving — otherwise the cached (unverified) status bounces the
      // user straight back to this page.
      await queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
      await queryClient.refetchQueries({ queryKey: ['mfa-status'] });
      navigate(safeReturnTo(), { replace: true });
    } catch (e) {
      setError(errOf(e));
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold text-foreground">Two-factor verification</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Enter the 6-digit code from your authenticator app to continue.</p>

      {error && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <form onSubmit={submit} className="rounded-xl border border-border bg-card p-5 space-y-4">
        {mode === 'totp' ? (
          <div>
            <label className="text-sm font-medium text-foreground">Authenticator code</label>
            <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" className="mt-2 max-w-[200px]" />
          </div>
        ) : (
          <div>
            <label className="text-sm font-medium text-foreground">Recovery code</label>
            <Input value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" className="mt-2" />
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Button type="submit" disabled={busy || (mode === 'totp' ? code.length !== 6 : !recovery)}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Verify
          </Button>
          <button type="button" onClick={() => { setMode(mode === 'totp' ? 'recovery' : 'totp'); setError(''); }} className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 justify-center">
            <KeyRound className="h-3.5 w-3.5" /> {mode === 'totp' ? 'Use a recovery code instead' : 'Use an authenticator code instead'}
          </button>
        </div>
      </form>

      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs text-muted-foreground mb-2">Don't have your authenticator or recovery codes? Request a reset so you can scan the QR code again.</p>
        {lostMsg ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{lostMsg}</div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={requestLost} disabled={lostBusy}>
            {lostBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Lost your authenticator? Request reset
          </Button>
        )}
      </div>

      <div className="mt-4 text-sm text-muted-foreground text-center">
        <Link to="/security" className="hover:underline">Security settings</Link>
      </div>
    </div>
  );
}