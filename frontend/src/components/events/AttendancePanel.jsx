import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useAttendanceInfo, useMyAttendance } from '@/lib/eventQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AttendanceStatusBadge from '@/components/events/AttendanceStatusBadge';
import { Building2, Users, CheckCircle2, Calendar, LogIn, Ticket, XCircle, Loader2, Monitor, ShieldCheck } from 'lucide-react';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AttendancePanel({ auctionId }) {
  const { user, isAuthenticated } = useAuth();
  const { data: att } = useAttendanceInfo(auctionId);
  const { data: mine } = useMyAttendance(auctionId, user?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', party_size: 1 });
  const [busy, setBusy] = useState(false);

  if (!att || !att.enabled) return null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance-info', auctionId] });
    queryClient.invalidateQueries({ queryKey: ['my-attendance', auctionId, user?.id] });
  };

  const register = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await invokeFunction('registerAttendance', { auction_id: auctionId, ...form });
      if (res.status >= 400) {
        toast({ title: 'Could not register', description: res.data?.error, variant: 'destructive' });
      } else {
        toast({ title: res.data.auto_confirmed ? 'You are registered and confirmed' : 'Registration submitted', description: res.data.auto_confirmed ? 'A booking code has been issued.' : 'The seller will review your registration.' });
        invalidate();
      }
    } catch (err) {
      toast({ title: 'Could not register', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id) => {
    const res = await invokeFunction('cancelBooking', { type: 'attendance', id });
    if (res.status >= 400) toast({ title: 'Could not cancel', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Registration cancelled' }); invalidate(); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Attend in person</h2>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <AttendanceStatusBadge status={att.attendance_status} />
        {att.online_bidding_enabled && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary"><Monitor className="h-3.5 w-3.5" /> Online bidding also available</span>}
      </div>
      <p className="text-sm text-muted-foreground mb-4">Register your intention to attend. Registration is free, does not guarantee the auction will proceed, and is never a charge.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-center">
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold text-foreground">{att.confirmed}</p>
          <p className="text-xs text-muted-foreground">Confirmed</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold text-foreground">{att.registered}</p>
          <p className="text-xs text-muted-foreground">Pending</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold text-foreground">{att.checked_in}</p>
          <p className="text-xs text-muted-foreground">Checked in</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold text-foreground">{att.min_confirmed_attendees || 0}</p>
          <p className="text-xs text-muted-foreground">Min required</p>
        </div>
      </div>

      <dl className="text-sm space-y-1 mb-4">
        <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Event</dt><dd className="font-medium text-foreground">{fmt(att.physical_date)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Registration window</dt><dd className="font-medium text-foreground">{fmt(att.registration_open_time)} – {fmt(att.registration_close_time)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Venue capacity</dt><dd className="font-medium text-foreground">{att.max_venue_capacity || 'Unlimited'}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Approval</dt><dd className="font-medium text-foreground">{att.requires_approval ? 'Required' : 'Automatic'}</dd></div>
      </dl>

      {isAuthenticated ? (
        mine && mine.status && !['cancelled', 'declined'].includes(mine.status) ? (
          <div className="rounded-lg border border-border p-3 bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Your registration</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${mine.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{mine.status}</span>
            </div>
            {mine.booking_code && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /> Booking code: <strong className="text-foreground">{mine.booking_code}</strong></p>}
            {mine.check_in_status === 'checked_in' && <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Checked in</p>}
            <Button size="sm" variant="ghost" className="mt-2 text-red-600 hover:text-red-700" onClick={() => cancel(mine.id)}><XCircle className="h-4 w-4 mr-1" /> Cancel registration</Button>
          </div>
        ) : (
          <form onSubmit={register} className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium text-foreground">Register to attend</p>
            <div className="grid sm:grid-cols-2 gap-2">
              <div><Label className="text-xs">Full name</Label><Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder={user?.full_name || ''} required /></div>
              <div><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder={user?.email || ''} required /></div>
              <div><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
              <div><Label className="text-xs">Party size</Label><Input type="number" min="1" max="20" value={form.party_size} onChange={(e) => setForm((f) => ({ ...f, party_size: Number(e.target.value) || 1 }))} required /></div>
            </div>
            <Button type="submit" disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Register attendance'}</Button>
          </form>
        )
      ) : (
        <Link to="/login"><Button className="w-full"><LogIn className="h-4 w-4 mr-2" /> Sign in to register</Button></Link>
      )}
    </div>
  );
}