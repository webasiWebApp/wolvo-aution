import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useEventAttendance } from '@/lib/eventAttendanceQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarClock, Users, Ticket, XCircle, Loader2, LogIn, Plus, Ban, CheckCircle2, MapPin } from 'lucide-react';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

const EMPTY_SLOT = { scheduled_at: '', duration_minutes: 60, capacity: 5, label: '' };

export default function EventAttendancePanel({ eventId, isOwner }) {
  const { user, isAuthenticated } = useAuth();
  const { data: att, isLoading } = useEventAttendance(eventId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_SLOT);
  const [rsvp, setRsvp] = useState({ slot_id: '', full_name: '', email: '', phone: '', party_size: 1 });
  const [busy, setBusy] = useState(false);

  if (isLoading) {
    return <div className="rounded-xl border border-border bg-card p-5"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!att || !att.enabled) return null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['event-attendance', eventId] });

  const addSlot = async (e) => {
    e.preventDefault();
    if (!form.scheduled_at || !form.capacity) {
      toast({ title: 'Start time and capacity are required', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await invokeFunction('manageAttendanceSlot', {
        action: 'create', event_id: eventId,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: Number(form.duration_minutes) || 60,
        capacity: Number(form.capacity), label: form.label
      });
      if (res.status >= 400) {
        toast({ title: 'Could not add slot', description: res.data?.error, variant: 'destructive' });
      } else {
        toast({ title: 'Time slot added' });
        setForm(EMPTY_SLOT);
        invalidate();
      }
    } catch (err) {
      toast({ title: 'Could not add slot', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const cancelSlot = async (slotId) => {
    if (!confirm('Cancel this time slot? Everyone RSVP\'d to it will be notified and their RSVPs cancelled.')) return;
    const res = await invokeFunction('manageAttendanceSlot', { action: 'cancel', slot_id: slotId });
    if (res.status >= 400) toast({ title: 'Could not cancel slot', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Slot cancelled' }); invalidate(); }
  };

  const submitRsvp = async (e) => {
    e.preventDefault();
    if (!rsvp.slot_id) { toast({ title: 'Pick a time slot', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      const res = await invokeFunction('registerEventAttendance', {
        event_id: eventId, slot_id: rsvp.slot_id,
        full_name: rsvp.full_name, email: rsvp.email, phone: rsvp.phone,
        party_size: Number(rsvp.party_size) || 1
      });
      if (res.status >= 400) {
        toast({ title: 'Could not RSVP', description: res.data?.error, variant: 'destructive' });
      } else {
        toast({ title: 'You are registered', description: 'A booking code has been issued.' });
        setRsvp({ slot_id: '', full_name: '', email: '', phone: '', party_size: 1 });
        invalidate();
      }
    } catch (err) {
      toast({ title: 'Could not RSVP', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const cancelRsvp = async (id) => {
    const res = await invokeFunction('cancelEventAttendance', { registration_id: id });
    if (res.status >= 400) toast({ title: 'Could not cancel', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'RSVP cancelled' }); invalidate(); }
  };

  const slots = att.slots || [];
  const openSlots = slots.filter((s) => s.status === 'open');
  const myReg = att.mine;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Attend in person — book a time slot</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        To keep crowd numbers manageable at this house clearance, pick a time window to attend. Registration is free and never a charge.
      </p>

      {att.address && (
        <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {att.address}</p>
      )}

      <div className="rounded-lg bg-muted/40 p-2 mb-4 text-center">
        <p className="text-lg font-bold text-foreground">{att.total_booked}</p>
        <p className="text-xs text-muted-foreground">RSVPs across all slots</p>
      </div>

      {/* Organiser: manage slots */}
      {isOwner && (
        <div className="mb-5 border border-dashed border-border rounded-lg p-3">
          <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-1"><Plus className="h-4 w-4" /> Add a time slot</p>
          <form onSubmit={addSlot} className="grid sm:grid-cols-4 gap-2">
            <div><Label className="text-xs">Start</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} required /></div>
            <div><Label className="text-xs">Duration (min)</Label><Input type="number" min="5" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
            <div><Label className="text-xs">Capacity</Label><Input type="number" min="1" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required /></div>
            <div><Label className="text-xs">Label (optional)</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Morning" /></div>
            <div className="sm:col-span-4"><Button type="submit" disabled={busy} size="sm">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add slot'}</Button></div>
          </form>
        </div>
      )}

      {slots.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No attendance time slots have been published yet.
        </div>
      ) : (
        <ul className="space-y-2 mb-4">
          {slots.map((s) => {
            const past = new Date(s.scheduled_at).getTime() < Date.now();
            const full = s.remaining <= 0;
            const cancelled = s.status === 'cancelled';
            const closed = s.status === 'closed' || past;
            const selectable = !cancelled && !closed && !full && !myReg;
            return (
              <li key={s.id} className={`rounded-lg border p-3 flex flex-wrap items-center justify-between gap-2 ${cancelled ? 'border-border bg-muted/30 opacity-60' : 'border-border'}`}>
                <div className="text-sm">
                  <p className="font-medium text-foreground">{s.label ? `${s.label} — ` : ''}{fmt(s.scheduled_at)}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {s.booked}/{s.capacity} booked · {s.remaining} remaining {cancelled && '· cancelled'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectable ? (
                    <Button size="sm" variant="outline" onClick={() => setRsvp({ ...rsvp, slot_id: s.id })}>Choose</Button>
                  ) : myReg ? (
                    <span className="text-xs text-muted-foreground">One RSVP per event</span>
                  ) : full ? (
                    <span className="text-xs text-red-600">Full</span>
                  ) : closed ? (
                    <span className="text-xs text-muted-foreground">{past ? 'Past' : 'Closed'}</span>
                  ) : null}
                  {isOwner && !cancelled && <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => cancelSlot(s.id)}><Ban className="h-4 w-4" /></Button>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Attendee: RSVP form or my registration */}
      {isAuthenticated ? (
        myReg ? (
          <div className="rounded-lg border border-border p-3 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Your RSVP</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">{myReg.status}</span>
            </div>
            {myReg.booking_code && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /> Booking code: <strong className="text-foreground">{myReg.booking_code}</strong></p>}
            {myReg.check_in_status === 'checked_in' && <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Checked in</p>}
            <Button size="sm" variant="ghost" className="mt-2 text-red-600 hover:text-red-700" onClick={() => cancelRsvp(myReg.id)}><XCircle className="h-4 w-4 mr-1" /> Cancel RSVP</Button>
          </div>
        ) : (
          rsvp.slot_id && (
            <form onSubmit={submitRsvp} className="space-y-2 border-t border-border pt-3">
              <p className="text-sm font-medium text-foreground">RSVP for the selected slot</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <div><Label className="text-xs">Full name</Label><Input value={rsvp.full_name} onChange={(e) => setRsvp({ ...rsvp, full_name: e.target.value })} placeholder={user?.full_name || ''} required /></div>
                <div><Label className="text-xs">Email</Label><Input type="email" value={rsvp.email} onChange={(e) => setRsvp({ ...rsvp, email: e.target.value })} placeholder={user?.email || ''} required /></div>
                <div><Label className="text-xs">Phone</Label><Input value={rsvp.phone} onChange={(e) => setRsvp({ ...rsvp, phone: e.target.value })} /></div>
                <div><Label className="text-xs">Party size</Label><Input type="number" min="1" max="20" value={rsvp.party_size} onChange={(e) => setRsvp({ ...rsvp, party_size: Number(e.target.value) || 1 })} required /></div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm RSVP'}</Button>
                <Button type="button" variant="ghost" onClick={() => setRsvp({ ...rsvp, slot_id: '' })}>Cancel</Button>
              </div>
            </form>
          )
        )
      ) : (
        <Link to="/login"><Button className="w-full"><LogIn className="h-4 w-4 mr-2" /> Sign in to book a slot</Button></Link>
      )}

      {/* Per-item flows already live on each item's detail page */}
      <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
        Looking at a specific item? Open it to book a per-item inspection/viewing slot, or — once you've won — a collection pickup slot.
      </p>
    </div>
  );
}