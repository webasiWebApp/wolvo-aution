import React, { useState } from 'react';
import { base44, callFunction } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Upload } from 'lucide-react';

const GROUP_LABELS = {
  primary_identity: 'Primary identity',
  supporting: 'Supporting identity',
  address: 'Address evidence',
  alternative_review: 'Alternative review'
};

// Uploads one evidence document privately and records it against the active case.
export default function EvidenceUpload({ categories, onUploaded }) {
  const [docType, setDocType] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const grouped = categories.reduce((acc, c) => { (acc[c.group] = acc[c.group] || []).push(c); return acc; }, {});

  const upload = async (e) => {
    e.preventDefault();
    if (!file || !docType) return;
    setError(''); setBusy(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await callFunction('addVerificationEvidence', { file_uri, file_name: file.name, document_type: docType });
      setFile(null); setDocType('');
      e.target.reset();
      onUploaded();
    } catch (err) {
      setError(err?.message || 'Upload failed.');
    } finally { setBusy(false); }
  };

  const selected = categories.find((c) => c.key === docType);

  return (
    <form onSubmit={upload} className="space-y-3">
      <div>
        <label className="text-sm font-medium text-foreground">Document type</label>
        <select value={docType} onChange={(e) => setDocType(e.target.value)} required
          className="mt-1.5 w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="">Select a document…</option>
          {Object.keys(grouped).map((g) => (
            <optgroup key={g} label={GROUP_LABELS[g] || g}>
              {grouped[g].map((c) => (
                <option key={c.key} value={c.key}>{c.label}{c.points ? ` (${c.points} pts)` : ''}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Document file</label>
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files[0])} required
          className="mt-1.5 block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:cursor-pointer" />
        <p className="text-xs text-muted-foreground mt-1.5">Files are stored privately and visible only to you and platform administrators.</p>
      </div>
      {selected && selected.group === 'alternative_review' && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          A police clearance is for manual review only and does not establish identity or address on its own.
        </p>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button type="submit" disabled={busy || !file || !docType}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />} Add evidence</Button>
    </form>
  );
}