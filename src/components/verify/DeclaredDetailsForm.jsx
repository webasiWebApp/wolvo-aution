import React, { useState } from 'react';
import { callFunction } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

// Collects the minimum necessary declared identity details to start a case.
export default function DeclaredDetailsForm({ onCreated }) {
  const [form, setForm] = useState({ legal_name: '', date_of_birth: '', residential_address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await callFunction('submitVerification', form);
      onCreated();
    } catch (err) {
      setError(err?.message || 'Failed to submit.');
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">Legal name</label>
        <Input value={form.legal_name} onChange={set('legal_name')} placeholder="As shown on your identity documents" required className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Date of birth</label>
        <Input type="date" value={form.date_of_birth} onChange={set('date_of_birth')} required className="mt-1.5 max-w-[200px]" />
      </div>
      <div>
        <label className="text-sm font-medium text-foreground">Residential address</label>
        <textarea value={form.residential_address} onChange={set('residential_address')} required rows={3}
          placeholder="Street, suburb, state, postcode" className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Start verification</Button>
    </form>
  );
}