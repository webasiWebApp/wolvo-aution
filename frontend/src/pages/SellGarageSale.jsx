import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { invokeFunction } from '@/api/base44Client';
import { useGarageSaleEvent } from '@/lib/garageSaleQueries';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';

const EMPTY = {
  title: '', description: '', participation: 'online', venue_name: '', suburb: '', state: '', address: '',
  inspection_notes: '', inspection_times: '', event_start: '', event_end: '', collection_instructions: '', images: ''
};

export default function SellGarageSale() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const { data: existing } = useGarageSaleEvent(editId);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title || '',
        description: existing.description || '',
        participation: existing.participation || 'online',
        venue_name: existing.venue_name || '',
        suburb: existing.suburb || '',
        state: existing.state || '',
        address: existing.address || '',
        inspection_notes: existing.inspection_notes || '',
        inspection_times: Array.isArray(existing.inspection_times) ? existing.inspection_times.join('\n') : '',
        event_start: existing.event_start ? existing.event_start.slice(0, 16) : '',
        event_end: existing.event_end ? existing.event_end.slice(0, 16) : '',
        collection_instructions: existing.collection_instructions || '',
        images: Array.isArray(existing.images) ? existing.images.join('\n') : ''
      });
    }
  }, [existing]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.title.trim()) { setErr('A title is required.'); return; }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description,
      participation: form.participation,
      venue_name: form.venue_name,
      suburb: form.suburb,
      state: form.state,
      address: form.address,
      inspection_notes: form.inspection_notes,
      inspection_times: form.inspection_times.split('\n').map((s) => s.trim()).filter(Boolean),
      event_start: form.event_start ? new Date(form.event_start).toISOString() : '',
      event_end: form.event_end ? new Date(form.event_end).toISOString() : '',
      collection_instructions: form.collection_instructions,
      images: form.images.split('\n').map((s) => s.trim()).filter(Boolean)
    };
    try {
      const res = await invokeFunction('manageGarageSaleEvent', {
        action: editId ? 'update_event' : 'create_event',
        event_id: editId || undefined,
        ...payload
      });
      if (res.status >= 400) {
        setErr((res.data && res.data.error) || 'Could not save event.');
      } else {
        const newId = editId || (res.data && res.data.event && res.data.event.id);
        navigate(`/garage-sales/${newId}`);
      }
    } catch (ex) {
      setErr(ex.message || 'Could not save event.');
    } finally {
      setSaving(false);
    }
  };

  const field = (k, label, opts = {}) => (
    <label key={k} className="block">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} {...opts} />
    </label>
  );

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <Link to="/garage-sales" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"><ArrowLeft className="h-4 w-4" /> Back</Link>
      <h1 className="text-3xl font-bold text-foreground mb-6">{editId ? 'Edit garage sale' : 'Host a garage sale'}</h1>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-6">
        {field('title', 'Event title *')}
        <label className="block">
          <span className="text-sm font-medium text-foreground">Description</span>
          <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Participation</span>
            <select className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3" value={form.participation} onChange={(e) => setForm({ ...form, participation: e.target.value })}>
              <option value="online">Online only</option>
              <option value="physical">In-person</option>
              <option value="hybrid">Hybrid</option>
            </select>
          </label>
          {field('venue_name', 'Venue name')}
          {field('suburb', 'Suburb')}
          {field('state', 'State')}
          {field('address', 'Full address (shared with attendees)')}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Event start</span>
            <input type="datetime-local" className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3" value={form.event_start} onChange={(e) => setForm({ ...form, event_start: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-foreground">Event end</span>
            <input type="datetime-local" className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3" value={form.event_end} onChange={(e) => setForm({ ...form, event_end: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Inspection times (one per line, e.g. 2026-10-20T10:00)</span>
          <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" rows={3} value={form.inspection_times} onChange={(e) => setForm({ ...form, inspection_times: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Collection instructions</span>
          <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" rows={2} value={form.collection_instructions} onChange={(e) => setForm({ ...form, collection_instructions: e.target.value })} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Image URLs (one per line)</span>
          <textarea className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2" rows={2} value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} />
        </label>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <Button type="submit" disabled={saving} className="w-full">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editId ? 'Save changes' : 'Create event'}</Button>
      </form>
    </div>
  );
}