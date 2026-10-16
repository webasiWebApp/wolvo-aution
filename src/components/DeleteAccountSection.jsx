import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44, invokeFunction } from '@/api/base44Client';

const CONSEQUENCES = [
  'Your account is immediately restricted and can no longer place bids, list items, or transact.',
  'Your identity verification evidence (document scans, extracted details) is permanently deleted.',
  'Your two-factor authenticator secret and recovery codes are wiped.',
  'Open watchlist items, bids, and saved payment references are removed.',
  'Historical completed transactions are retained for legal/audit record-keeping but no longer accessible to you.',
  'This action is irreversible and cannot be undone.'
];

export default function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setError(''); setBusy(true);
    try {
      const res = await invokeFunction('deleteAccount', { confirm: true });
      if (res.status >= 400) {
        setError(res.data?.error || 'Deletion request failed.');
      } else {
        setDone(true);
        setBusy(false);
        setTimeout(() => {
          base44.auth.logout('/');
        }, 2500);
      }
    } catch (e) {
      setError(e.message || 'Deletion request failed.');
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-rose-100 p-2 shrink-0">
          <Trash2 className="h-5 w-5 text-rose-700" />
        </div>
        <div>
          <h3 className="font-semibold text-rose-700">Delete your account</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently remove your personal data and close your Wolvo account. Read the consequences carefully before continuing.
          </p>
        </div>
      </div>

      <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4 mr-1.5" /> Delete account
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="relative w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" /> Confirm account deletion
              </h3>
              {!busy && <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>}
            </div>

            {done ? (
              <div className="p-6 text-center">
                <p className="text-sm text-foreground font-medium">Your account has been marked for deletion.</p>
                <p className="text-xs text-muted-foreground mt-1">Signing you out…</p>
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto mt-3" />
              </div>
            ) : (
              <>
                <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto">
                  <ul className="space-y-2">
                    {CONSEQUENCES.map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                      disabled={busy}
                      className="mt-0.5"
                    />
                    <span>I understand this is irreversible and I want to delete my account.</span>
                  </label>
                  {error && <p className="text-sm text-rose-600">{error}</p>}
                </div>
                <div className="px-5 py-4 border-t border-border flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={busy}>
                    Cancel
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={!ack || busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                    {busy ? 'Deleting…' : 'Delete forever'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}