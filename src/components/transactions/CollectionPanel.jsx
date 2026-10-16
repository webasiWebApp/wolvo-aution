import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useCollectionInfo } from '@/lib/transactionQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, Calendar, MapPin, Ticket, Loader2, CheckCircle2, XCircle, Plus } from 'lucide-react';

function fmt(dt) { return dt ? new Date(dt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }) : '—'; }

export default function CollectionPanel({ tx, role }) {
  const { data: info } = useCollectionInfo(tx.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [party, setParty] = useState({});
  const [busy, setBusy] = useState(null);
  const [slotForm, setSlotForm] = useState({ scheduled_at: '', duration_minutes: 30, capacity: 1, location: '', deadline: '' });
  const [slotBusy, setSlotBusy] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['collection-info', tx.id] });
    queryClient.invalidateQueries({ queryKey: ['transaction', tx.id] });
  };

  const book = async (slotId) => {
    setBusy(slotId);
    const res = await invokeFunction('bookCollection', { transaction_id: tx.id, slot_id: slotId, party_size: Number(party[slotId]) || 1 });
    if (res.status >= 400) toast({ title: 'Could not book', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Collection booked', description: `Code ${res.data.appointment.collection_code}` }); invalidate(); }
    setBusy(null);
  };

  const cancel = async (id) => {
    const res = await invokeFunction('cancelCollection', { appointment_id: id });
    if (res.status >= 400) toast({ title: 'Could not cancel', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Booking cancelled' }); invalidate(); }
  };

  const collect = async (id) => {
    const res = await invokeFunction('markCollected', { appointment_id: id });
    if (res.status >= 400) toast({ title: 'Could not mark collected', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Item marked as collected' }); invalidate(); }
  };

  const saveSlot = async (e) => {
    e.preventDefault();
    if (!slotForm.scheduled_at) { toast({ title: 'Choose a date/time', variant: 'destructive' }); return; }
    setSlotBusy(true);
    const res = await invokeFunction('saveCollectionSlot', {
      auction_id: tx.auction_id, ...slotForm,
      capacity: Number(slotForm.capacity), duration_minutes: Number(slotForm.duration_minutes),
      deadline: slotForm.deadline ? new Date(slotForm.deadline).toISOString() : null
    });
    if (res.status >= 400) toast({ title: 'Could not save slot', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Collection slot added' }); setSlotForm({ scheduled_at: '', duration_minutes: 30, capacity: 1, location: '', deadline: '' }); invalidate(); }
    setSlotBusy(false);
  };

  const appt = info?.my_appointment;
  const canBook = info?.can_book && !appt;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3"><Package className="h-5 w-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Collection</h2></div>
      {tx.collection_deadline && <p className="text-sm text-muted-foreground mb-3">Collection deadline: {new Date(tx.collection_deadline).toLocaleDateString('en-AU')}</p>}

      {appt && (
        <div className="rounded-lg border border-border p-3 bg-muted/20 mb-3">
          <div className="flex items-center justify-between"><span className="text-sm font-medium text-foreground">{fmt(appt.scheduled_at)}</span><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${appt.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : appt.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>{appt.status}</span></div>
          {appt.location && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {appt.location}</p>}
          {appt.collection_code && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /> Confirmation code: <strong className="text-foreground">{appt.collection_code}</strong></p>}
          {appt.status === 'scheduled' && role.isBuyer && <Button size="sm" variant="ghost" className="mt-2 text-red-600" onClick={() => cancel(appt.id)}><XCircle className="h-4 w-4 mr-1" /> Cancel booking</Button>}
          {appt.status === 'scheduled' && (role.isSeller || role.isAdmin) && <Button size="sm" className="mt-2" onClick={() => collect(appt.id)}><CheckCircle2 className="h-4 w-4 mr-1" /> Mark collected</Button>}
        </div>
      )}

      {canBook && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Choose a collection slot</p>
          {(info?.slots || []).length === 0 && <p className="text-xs text-muted-foreground">No collection slots available yet.</p>}
          {info?.slots?.map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-sm"><p className="font-medium text-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {fmt(s.scheduled_at)}</p><p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {s.location} · {s.booked}/{s.capacity} booked</p></div>
              <div className="flex items-center gap-2"><Input type="number" min="1" max="10" value={party[s.id] ?? 1} onChange={(e) => setParty((p) => ({ ...p, [s.id]: e.target.value }))} className="w-16 h-9" /><Button size="sm" disabled={busy === s.id || s.booked >= s.capacity} onClick={() => book(s.id)}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Book'}</Button></div>
            </div>
          ))}
        </div>
      )}

      {(role.isSeller || role.isAdmin) && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm font-medium text-foreground mb-2">Add a collection slot</p>
          <form onSubmit={saveSlot} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <div><Label className="text-xs">Date & time</Label><Input type="datetime-local" value={slotForm.scheduled_at} onChange={(e) => setSlotForm((f) => ({ ...f, scheduled_at: e.target.value }))} /></div>
            <div><Label className="text-xs">Duration (min)</Label><Input type="number" min="15" value={slotForm.duration_minutes} onChange={(e) => setSlotForm((f) => ({ ...f, duration_minutes: e.target.value }))} /></div>
            <div><Label className="text-xs">Capacity</Label><Input type="number" min="1" value={slotForm.capacity} onChange={(e) => setSlotForm((f) => ({ ...f, capacity: e.target.value }))} /></div>
            <div><Label className="text-xs">Location</Label><Input value={slotForm.location} onChange={(e) => setSlotForm((f) => ({ ...f, location: e.target.value }))} /></div>
            <div><Label className="text-xs">Booking deadline</Label><Input type="datetime-local" value={slotForm.deadline} onChange={(e) => setSlotForm((f) => ({ ...f, deadline: e.target.value }))} /></div>
            <div className="flex items-end"><Button type="submit" size="sm" disabled={slotBusy}><Plus className="h-4 w-4 mr-1" /> Add slot</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}