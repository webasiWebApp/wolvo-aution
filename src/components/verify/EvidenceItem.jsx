import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, ExternalLink, Copy } from 'lucide-react';

const STATUS_STYLES = {
  pending_review: 'bg-amber-100 text-amber-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  duplicate: 'bg-slate-200 text-slate-600'
};

export default function EvidenceItem({ item, label }) {
  const [opening, setOpening] = useState(false);
  const view = async () => {
    setOpening(true);
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: item.file_uri });
      window.open(signed_url, '_blank');
    } finally { setOpening(false); }
  };
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{label || item.document_type}</p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${STATUS_STYLES[item.status] || 'bg-muted text-muted-foreground'}`}>{item.status.replace(/_/g, ' ')}</span>
          {item.is_duplicate && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-600"><Copy className="h-3 w-3" /> duplicate — no points</span>
          )}
          {!item.is_duplicate && <span className="text-[11px] text-muted-foreground">{item.points_awarded} pts</span>}
        </div>
      </div>
      <button onClick={view} disabled={opening} className="shrink-0 inline-flex items-center gap-1 text-xs text-primary hover:underline">
        {opening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />} View
      </button>
    </div>
  );
}