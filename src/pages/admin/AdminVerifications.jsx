import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44, callFunction } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, ExternalLink, Flag, CheckCircle2, XCircle } from 'lucide-react';

const STATUS_CLS = {
  PENDING: 'bg-amber-100 text-amber-700',
  VERIFIED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  RESTRICTED: 'bg-slate-300 text-slate-800',
  UNVERIFIED: 'bg-muted text-muted-foreground'
};

export default function AdminVerifications() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(null);
  const [decision, setDecision] = useState('VERIFIED');
  const [external, setExternal] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ['admin-verification-cases'],
    queryFn: async () => {
      const page = await base44.entities.VerificationCase.list({ sort: '-created_date', limit: 100 });
      return page.items || [];
    }
  });

  const selected = cases.find((c) => c.id === selectedId);

  const { data: detail } = useQuery({
    queryKey: ['admin-verification-case', selectedId],
    queryFn: async () => {
      const evPage = await base44.entities.VerificationEvidence.filter({ case_id: selectedId }, { sort: 'created_date', limit: 200 });
      const flagPage = await base44.entities.VerificationFlag.filter({ case_id: selectedId }, { limit: 200 });
      const notePage = await base44.entities.VerificationReviewNote.filter({ case_id: selectedId }, { sort: '-created_date', limit: 50 });
      return { evidence: evPage.items || [], flags: flagPage.items || [], notes: notePage.items || [] };
    },
    enabled: !!selectedId
  });

  const review = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      const payload = { case_id: selectedId, decision, note };
      if (external) payload.external_verification = external;
      if (decision === 'REJECTED') payload.rejection_reason = reason;
      await callFunction('reviewVerification', payload);
      setMsg('Decision recorded.');
      queryClient.invalidateQueries({ queryKey: ['admin-verification-cases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-verification-case', selectedId] });
    } catch (err) {
      setMsg(err?.message || 'Failed to record decision.');
    } finally { setBusy(false); }
  };

  const viewFile = async (file_uri) => {
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri });
    window.open(signed_url, '_blank');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">Identity verification</h1>
      <p className="text-sm text-muted-foreground mb-6">Review 100-point identity cases. A case can only be marked verified when the required combination is met and (if configured) external verification has passed.</p>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              {cases.length === 0 && <p className="text-sm text-muted-foreground p-4">No verification cases.</p>}
              <ul className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {cases.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setSelectedId(c.id)} className={`w-full text-left px-4 py-3 hover:bg-muted/40 ${selectedId === c.id ? 'bg-muted/60' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{c.legal_name || c.user_id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${STATUS_CLS[c.verification_status] || 'bg-muted'}`}>{c.verification_status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.total_points || 0} pts · {c.submitted_at ? new Date(c.submitted_at).toLocaleDateString() : ''}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-3">
          {!selected ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Select a case to review.</div>
          ) : !detail ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {/* Case summary */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-3"><ShieldCheck className="h-4 w-4 text-accent" /><h2 className="font-semibold text-foreground">Case details</h2></div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Legal name</dt><dd className="text-foreground">{selected.legal_name || '—'}</dd>
                  <dt className="text-muted-foreground">Date of birth</dt><dd className="text-foreground">{selected.date_of_birth || '—'}</dd>
                  <dt className="text-muted-foreground">Address</dt><dd className="text-foreground col-span-1">{selected.residential_address || '—'}</dd>
                  <dt className="text-muted-foreground">Points</dt><dd className="text-foreground">{selected.total_points || 0}</dd>
                  <dt className="text-muted-foreground">Primary identity</dt><dd>{selected.has_primary_identity ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</dd>
                  <dt className="text-muted-foreground">Address evidence</dt><dd>{selected.has_address_evidence ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</dd>
                  <dt className="text-muted-foreground">Review type</dt><dd className="text-foreground">{selected.review_type || 'standard'}</dd>
                </dl>
              </div>

              {/* Evidence */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold text-foreground mb-3">Evidence ({detail.evidence.length})</h3>
                {detail.evidence.length === 0 ? <p className="text-sm text-muted-foreground">No evidence submitted.</p> : (
                  <ul className="space-y-2">
                    {detail.evidence.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-3 text-sm py-2 border-b border-border last:border-0">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{e.document_type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">{e.status} · {e.points_awarded} pts{e.is_duplicate ? ' · duplicate' : ''}{e.provider_verified ? ' · provider-verified' : ''}</p>
                        </div>
                        <button onClick={() => viewFile(e.file_uri)} className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> View</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Flags */}
              {detail.flags.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <h3 className="font-semibold text-amber-700 mb-2 flex items-center gap-2"><Flag className="h-4 w-4" /> Flags ({detail.flags.length})</h3>
                  <ul className="space-y-1.5 text-sm">
                    {detail.flags.map((f) => <li key={f.id} className="text-amber-800"><span className="font-medium">{f.flag_type.replace(/_/g, ' ')}</span> — {f.details}</li>)}
                  </ul>
                </div>
              )}

              {/* Review notes history */}
              {detail.notes.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-semibold text-foreground mb-2">Review notes</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {detail.notes.map((n) => <li key={n.id} className="border-l-2 border-border pl-3">{n.note}</li>)}
                  </ul>
                </div>
              )}

              {/* Decision form */}
              <form onSubmit={review} className="rounded-xl border border-border bg-card p-5 space-y-3">
                <h3 className="font-semibold text-foreground">Record decision</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-foreground">Decision</label>
                    <select value={decision} onChange={(e) => setDecision(e.target.value)} className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="VERIFIED">Verified</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="RESTRICTED">Restricted</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground">External verification</label>
                    <select value={external} onChange={(e) => setExternal(e.target.value)} className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Not applicable</option>
                      <option value="passed">Passed</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                </div>
                {decision === 'REJECTED' && (
                  <div>
                    <label className="text-sm font-medium text-foreground">Rejection reason (shown to user)</label>
                    <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground">Internal review note</label>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Categories reviewed, rationale…" />
                </div>
                {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
                <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Record decision</Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}