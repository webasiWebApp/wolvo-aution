import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44, callFunction } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, FileCheck2, FilePlus2 } from 'lucide-react';
import DeclaredDetailsForm from '@/components/verify/DeclaredDetailsForm';
import EvidenceUpload from '@/components/verify/EvidenceUpload';
import EvidenceItem from '@/components/verify/EvidenceItem';

const STATUS_META = {
  UNVERIFIED: { label: 'Not started', cls: 'bg-muted text-muted-foreground' },
  PENDING: { label: 'In review', cls: 'bg-amber-100 text-amber-700' },
  VERIFIED: { label: 'Verified', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Rejected', cls: 'bg-rose-100 text-rose-700' },
  RESTRICTED: { label: 'Restricted', cls: 'bg-slate-300 text-slate-800' }
};

export default function VerifyIdentity() {
  const queryClient = useQueryClient();
  const [reviewType, setReviewType] = useState('alternative');
  const [requesting, setRequesting] = useState(false);
  const [reqMsg, setReqMsg] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['verification-status'],
    queryFn: async () => await callFunction('getVerificationStatus'),
    staleTime: 10 * 1000
  });

  const { data: policy } = useQuery({
    queryKey: ['verification-policy'],
    queryFn: async () => {
      const page = await base44.entities.VerificationScoringPolicy.filter({ config_name: 'default' }, { limit: 1 });
      return (page.items || [])[0];
    }
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['verification-status'] });
  const categoryLabel = (key) => ((policy && policy.categories) || []).find((c) => c.key === key)?.label || key;

  const requestReview = async () => {
    setRequesting(true); setReqMsg('');
    try {
      const res = await callFunction('requestManualReview', { review_type: reviewType });
      const notifyError = res?.notify_error;
      setReqMsg(notifyError
        ? 'Review queued, but the admin notification email failed: ' + notifyError
        : 'Your case has been queued for manual review. An administrator will assess it and contact you.');
      refresh();
    } catch (err) {
      setReqMsg(err?.message || 'Failed to request review.');
    } finally { setRequesting(false); }
  };

  if (isLoading || !status) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const meta = STATUS_META[status.verification_status] || STATUS_META.UNVERIFIED;
  const target = (policy && policy.target_points) || 100;
  const canSubmit = !status.has_case || status.verification_status === 'REJECTED';
  const pending = status.verification_status === 'PENDING';

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-6 w-6 text-accent" />
        <h1 className="text-2xl font-bold text-foreground">Identity verification</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Complete a 100-point identity check before you can bid. Your documents are stored privately and never shown publicly.</p>

      {/* Status banner */}
      <div className={`rounded-xl border p-4 mb-6 flex items-start gap-3 ${status.verification_status === 'VERIFIED' ? 'border-emerald-200 bg-emerald-50' : status.verification_status === 'REJECTED' ? 'border-rose-200 bg-rose-50' : status.verification_status === 'RESTRICTED' ? 'border-slate-300 bg-slate-100' : 'border-border bg-card'}`}>
        {status.verification_status === 'VERIFIED' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" /> : status.verification_status === 'REJECTED' ? <XCircle className="h-5 w-5 text-rose-600 mt-0.5" /> : status.verification_status === 'RESTRICTED' ? <AlertTriangle className="h-5 w-5 text-slate-600 mt-0.5" /> : <FileCheck2 className="h-5 w-5 text-accent mt-0.5" />}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground">Verification status</h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{status.explanation}</p>
        </div>
      </div>

      {status.verification_status === 'VERIFIED' ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-2">You're ready to bid</h3>
          <p className="text-sm text-muted-foreground mb-4">Identity verified. Make sure two-factor authentication is enabled, then start bidding.</p>
          <div className="flex gap-2">
            <Link to="/security"><Button variant="outline" size="sm">Security settings</Button></Link>
            <Link to="/auctions"><Button size="sm">Browse auctions</Button></Link>
          </div>
        </div>
      ) : status.verification_status === 'RESTRICTED' ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Your account is restricted. Please <Link to="/contact" className="text-primary underline">contact support</Link> to resolve this.</p>
        </div>
      ) : canSubmit ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-foreground mb-1">{status.has_case ? 'Resubmit verification' : 'Start identity verification'}</h3>
          <p className="text-sm text-muted-foreground mb-4">Enter the legal name, date of birth and residential address shown on your documents. We'll compare your evidence against these.</p>
          <DeclaredDetailsForm onCreated={refresh} />
        </div>
      ) : pending ? (
        <div className="space-y-6">
          {/* Progress */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">Progress</h3>
              <span className="text-sm font-semibold text-foreground">{status.total_points} / {target} pts</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden mb-4">
              <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(100, (status.total_points / target) * 100)}%` }} />
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">{status.has_primary_identity ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />} Primary identity document</li>
              <li className="flex items-center gap-2">{status.has_address_evidence ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />} Address evidence</li>
              <li className="flex items-center gap-2">{status.total_points >= target ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />} Reached {target} points</li>
            </ul>
            <p className="text-xs text-muted-foreground mt-4">Reaching the points target alone does not verify you. Your case is reviewed against independent identity and address evidence.</p>
          </div>

          {/* Evidence list */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2"><FileCheck2 className="h-4 w-4" /> Submitted evidence</h3>
            {status.evidence && status.evidence.length ? status.evidence.map((e) => <EvidenceItem key={e.id} item={e} label={categoryLabel(e.document_type)} />) : <p className="text-sm text-muted-foreground py-2">No evidence submitted yet.</p>}
          </div>

          {/* Upload */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2"><FilePlus2 className="h-4 w-4" /> Add evidence</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload one document per category. The same document won't be counted twice.</p>
            {policy && <EvidenceUpload categories={policy.categories} onUploaded={refresh} />}
          </div>

          {/* Alternative review */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-1">Can't supply the standard documents?</h3>
            <p className="text-sm text-muted-foreground mb-4">Request an alternative or exception review. An administrator will assess your situation manually.</p>
            <div className="flex flex-wrap items-end gap-3">
              <select value={reviewType} onChange={(e) => setReviewType(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                <option value="alternative">Alternative review</option>
                <option value="exception">Exception review</option>
              </select>
              <Button variant="outline" onClick={requestReview} disabled={requesting}>{requesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Request manual review</Button>
            </div>
            {reqMsg && <p className="text-sm text-muted-foreground mt-3">{reqMsg}</p>}
          </div>
        </div>
      ) : null}
    </div>
  );
}