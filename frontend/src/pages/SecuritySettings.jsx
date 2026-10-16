import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { callFunction } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShieldCheck, ShieldAlert, Loader2, KeyRound, Smartphone, Copy, Check, AlertTriangle } from 'lucide-react';
import DeleteAccountSection from '@/components/DeleteAccountSection';

const errOf = (e) => (e && e.message) || 'Something went wrong.';

export default function SecuritySettings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: status, isLoading } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: async () => await callFunction('getTwoFactorStatus'),
    staleTime: 15 * 1000
  });

  const [view, setView] = useState('idle'); // idle | setup | recovery
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [reauthCode, setReauthCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const startSetup = async () => {
    setError(''); setBusy(true);
    try {
      const data = await callFunction('setupTwoFactor', {});
      setSetup(data);
      setView('setup');
    } catch (e) { setError(errOf(e)); } finally { setBusy(false); }
  };

  const confirmSetup = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = await callFunction('confirmTwoFactor', { code });
      setRecoveryCodes(data.recovery_codes);
      setView('recovery');
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
    } catch (e) { setError(errOf(e)); } finally { setBusy(false); }
  };

  const doDisable = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await callFunction('disableTwoFactor', { code: reauthCode });
      setReauthCode(''); setView('idle');
      setMsg('Two-factor authentication has been disabled.');
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
    } catch (e) { setError(errOf(e)); } finally { setBusy(false); }
  };

  const doRegen = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const data = await callFunction('regenerateRecoveryCodes', { code: reauthCode });
      setRecoveryCodes(data.recovery_codes);
      setReauthCode(''); setView('recovery');
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] });
    } catch (e) { setError(errOf(e)); } finally { setBusy(false); }
  };

  const lostAuth = async () => {
    setError(''); setBusy(true);
    try {
      await callFunction('requestLostAuthenticator', {});
      setMsg('Your lost-authenticator request has been logged. An administrator will contact you after identity re-verification.');
    } catch (e) { setError(errOf(e)); } finally { setBusy(false); }
  };

  const copyCodes = () => {
    if (!recoveryCodes) return;
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const enabled = status && status.enabled;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold text-foreground">Security settings</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Manage two-factor authentication for your Wolvo account.</p>

      {msg && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{msg}</div>}
      {error && <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Status card */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              {enabled ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-muted-foreground" />}
              <h2 className="font-semibold text-foreground">Two-factor authentication</h2>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {enabled ? 'Enabled — your account is protected with an authenticator app.' : 'Not enabled. Protect your account with Google or Microsoft Authenticator.'}
            </p>
            {enabled && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Recovery codes remaining: <strong className="text-foreground">{status.recovery_codes_remaining}</strong></span>
                <span>MFA verified this session: <strong className={status.mfa_verified ? 'text-emerald-600' : 'text-amber-600'}>{status.mfa_verified ? 'Yes' : 'No'}</strong></span>
                {status.locked && <span className="text-rose-600">Temporarily locked</span>}
              </div>
            )}
          </div>
          {enabled && !status.mfa_verified && (
            <Button size="sm" onClick={() => navigate('/verify-2fa?returnTo=/security')}>Verify now</Button>
          )}
        </div>
      </div>

      {/* Setup flow */}
      {!enabled && view === 'idle' && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-1">Enable two-factor authentication</h3>
          <p className="text-sm text-muted-foreground mb-4">Scan a QR code with your authenticator app, then confirm with a 6-digit code. You'll receive single-use recovery codes.</p>
          <Button onClick={startSetup} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Start setup</Button>
        </div>
      )}

      {view === 'setup' && setup && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2"><Smartphone className="h-4 w-4" /> Scan with your authenticator app</h3>
          <p className="text-sm text-muted-foreground mb-4">Use Google Authenticator, Microsoft Authenticator or any TOTP app.</p>
          <div className="flex flex-col sm:flex-row gap-5 items-center">
            {setup.qr_data_url ? (
              <img src={setup.qr_data_url} alt="2FA QR code" className="w-48 h-48 rounded-md border border-border" />
            ) : (
              <div className="w-48 h-48 rounded-md border border-border flex items-center justify-center text-xs text-muted-foreground p-4 text-center">QR unavailable. Enter the secret manually.</div>
            )}
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">Or enter this secret manually:</p>
              <code className="block bg-muted px-3 py-2 rounded-md text-sm font-mono break-all">{setup.secret}</code>
            </div>
          </div>
          <form onSubmit={confirmSetup} className="mt-5">
            <label className="text-sm font-medium text-foreground">Enter the 6-digit code from your app</label>
            <div className="flex gap-2 mt-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" inputMode="numeric" className="max-w-[160px]" />
              <Button type="submit" disabled={busy || code.length !== 6}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Confirm & enable</Button>
            </div>
          </form>
        </div>
      )}

      {view === 'recovery' && recoveryCodes && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2"><KeyRound className="h-4 w-4" /> Save your recovery codes</h3>
          <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 my-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>These are shown once. Store them somewhere safe. Each code can be used a single time if you lose your authenticator.</span>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-muted/50 rounded-md p-4 font-mono text-sm">
            {recoveryCodes.map((c, i) => <div key={i}>{c}</div>)}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={copyCodes}>{copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />} {copied ? 'Copied' : 'Copy codes'}</Button>
            <Button size="sm" onClick={() => { setView('idle'); setRecoveryCodes(null); setMsg('Two-factor authentication is now active.'); }}>Done</Button>
          </div>
        </div>
      )}

      {/* Management when enabled */}
      {enabled && view === 'idle' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-1">Regenerate recovery codes</h3>
            <p className="text-sm text-muted-foreground mb-4">Requires your current authenticator code. Previous codes stop working.</p>
            <form onSubmit={doRegen} className="flex gap-2 items-end">
              <Input value={reauthCode} onChange={(e) => setReauthCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Authenticator code" inputMode="numeric" className="max-w-[200px]" />
              <Button type="submit" variant="outline" disabled={busy || reauthCode.length !== 6}>Regenerate</Button>
              <Button type="button" variant="ghost" onClick={() => setReauthCode('')}>Cancel</Button>
            </form>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5">
            <h3 className="font-semibold text-rose-700 mb-1">Disable two-factor authentication</h3>
            <p className="text-sm text-muted-foreground mb-4">Requires reauthentication with your authenticator or a recovery code.</p>
            <form onSubmit={doDisable} className="flex gap-2 items-end">
              <Input value={reauthCode} onChange={(e) => setReauthCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Authenticator code" inputMode="numeric" className="max-w-[200px]" />
              <Button type="submit" variant="destructive" disabled={busy || reauthCode.length !== 6}>Disable</Button>
              <Button type="button" variant="ghost" onClick={() => setReauthCode('')}>Cancel</Button>
            </form>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-1">Lost your authenticator?</h3>
            <p className="text-sm text-muted-foreground mb-4">If you can't access your authenticator or recovery codes, request a review. An administrator will reset 2FA after identity re-verification.</p>
            <Button variant="outline" onClick={lostAuth} disabled={busy}>Request lost-authenticator recovery</Button>
          </div>
        </div>
      )}

      <DeleteAccountSection />

      <div className="mt-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:underline">Back to marketplace</Link>
      </div>
    </div>
  );
}