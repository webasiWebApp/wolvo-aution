import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useInspectionSlotsAdmin, useAllViewings } from '@/lib/eventQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, MapPin, Plus, Loader2, Trash2 } from 'lucide-react';

function fmt(dt) { return dt ? new Date(dt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }

export default function ManageInspections({ auctionId }) {
  const { data: slots = [] } = useInspectionSlotsAdmin(auctionId);
  const { data: viewings = [] } = useAllViewings(auctionId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ scheduled_at: '', duration_minutes: 60, capacity: 1, location_hint: '', full_address: '' });
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inspection-slots-admin', auctionId] });
    queryClient.invalidateQueries({ queryKey: ['all-viewings', auctionId] });
    queryClient.invalidateQueries({ queryKey: ['inspection-info', auctionId] });
  };

  const saveSlot = async (e) => {
    e.preventDefault();
    if (!form.scheduled_at) { toast({ title: 'Choose a date and time', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const res = await invokeFunction('saveInspectionSlot', { auction_id: auctionId, ...form, capacity: Number(form.capacity), duration_minutes: Number(form.duration_minutes) });
      if (res.status >= 400) toast({ title: 'Could not save slot', description: res.data?.error, variant: 'destructive' });
      else { toast({ title: 'Inspection slot saved' }); setForm({ scheduled_at: '', duration_minutes: 60, capacity: 1, location_hint: '', full_address: '' }); invalidate(); }
    } catch (err) { toast({ title: 'Could not save slot', description: err.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const decide = async (id, decision) => {
    const res = await invokeFunction('decideViewing', { appointment_id: id, decision });
    if (res.status >= 400) toast({ title: 'Could not decide', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: decision === 'approve' ? 'Viewing approved — address released' : 'Viewing declined' }); invalidate(); }
  };

  const cancelViewing = async (id) => {
    const res = await invokeFunction('cancelBooking', { type: 'viewing', id });
    if (res.status >= 400) toast({ title: 'Could not cancel', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Viewing cancelled' }); invalidate(); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Inspection slots</h3>
        <form onSubmit={saveSlot} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 rounded-lg border border-border p-3 bg-muted/20">
          <div><Label className="text-xs">Date & time</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))} /></div>
          <div><Label className="text-xs">Duration (min)</Label><Input type="number" min="15" value={form.duration_minutes} onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))} /></div>
          <div><Label className="text-xs">Capacity</Label><Input type="number" min="1" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} /></div>
          <div><Label className="text-xs">Location hint (public)</Label><Input value={form.location_hint} onChange={(e) => setForm((f) => ({ ...f, location_hint: e.target.value }))} placeholder="Perth CBD" /></div>
          <div className="sm:col-span-2 lg:col-span-1"><Label className="text-xs">Full address (private)</Label><Input value={form.full_address} onChange={(e) => setForm((f) => ({ ...f, full_address: e.target.value }))} placeholder="Released on approval" /></div>
          <div className="sm:col-span-2 lg:col-span-3"><Button type="submit" disabled={busy} size="sm">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Add slot</Button></div>
        </form>
        <div className="mt-2 space-y-2">
          {slots.length === 0 && <p className="text-xs text-muted-foreground">No slots yet.</p>}
          {slots.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{fmt(s.scheduled_at)} · {s.duration_minutes} min · cap {s.capacity}</span>
                <span className="text-xs text-muted-foreground">{s.status}</span>
              </div>
              {s.location_hint && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {s.location_hint}</p>}
              {s.full_address && <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Private: {s.full_address}</p>}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Viewing requests</h3>
        {viewings.length === 0 && <p className="text-xs text-muted-foreground">No requests.</p>}
        <div className="space-y-2">
          {viewings.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{fmt(a.requested_slot)} · party {a.party_size || 1}</p>
                <p className="text-xs text-muted-foreground">Code {a.booking_code} · status {a.status}{a.address_released ? ' · address released' : ''}{a.check_in_status !== 'pending' ? ` · ${a.check_in_status}` : ''}</p>
              </div>
              <div className="flex gap-2">
                {a.status === 'requested' && (<>
                  <Button size="sm" onClick={() => decide(a.id, 'approve')}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(a.id, 'decline')}><XCircle className="h-4 w-4 mr-1" /> Decline</Button>
                </>)}
                {['requested', 'confirmed'].includes(a.status) && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => cancelViewing(a.id)}><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}