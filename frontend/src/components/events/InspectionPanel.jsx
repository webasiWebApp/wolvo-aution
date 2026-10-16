import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useInspectionInfo, useMyViewings } from '@/lib/eventQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, Calendar, Users, XCircle, Loader2, LogIn, MapPin, Ticket } from 'lucide-react';

function fmt(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_STYLE = {
  requested: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-200 text-slate-700',
  completed: 'bg-emerald-100 text-emerald-800'
};

export default function InspectionPanel({ auctionId }) {
  const { user, isAuthenticated } = useAuth();
  const { data: info } = useInspectionInfo(auctionId);
  const { data: mine = [] } = useMyViewings(auctionId, user?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [party, setParty] = useState({});
  const [busy, setBusy] = useState(null);

  if (!info || !info.inspections_available) return null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inspection-info', auctionId] });
    queryClient.invalidateQueries({ queryKey: ['my-viewings', auctionId, user?.id] });
  };

  const request = async (slotId) => {
    setBusy(slotId);
    try {
      const res = await invokeFunction('requestViewing', {
        auction_id: auctionId, slot_id: slotId,
        party_size: Number(party[slotId]) || 1
      });
      if (res.status >= 400) {
        toast({ title: 'Could not request viewing', description: res.data?.error, variant: 'destructive' });
      } else {
        toast({ title: 'Viewing requested', description: 'The seller will review your request and release the address on approval.' });
        invalidate();
      }
    } catch (e) {
      toast({ title: 'Could not request viewing', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (id) => {
    const res = await invokeFunction('cancelBooking', { type: 'viewing', id });
    if (res.status >= 400) toast({ title: 'Could not cancel', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Viewing cancelled' }); invalidate(); }
  };

  const stats = info.stats || { interested: 0, confirmed: 0, completed: 0 };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Eye className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Inspect this item</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">Book a viewing slot. The exact property address is kept private and shared only once the seller approves your request.</p>

      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold text-foreground">{stats.interested}</p>
          <p className="text-xs text-muted-foreground">Interested</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold text-foreground">{stats.confirmed}</p>
          <p className="text-xs text-muted-foreground">Confirmed</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-lg font-bold text-foreground">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Checked in</p>
        </div>
      </div>

      {info.slots?.length === 0 && <p className="text-sm text-muted-foreground">No inspection slots are configured yet. Please check back.</p>}

      <div className="space-y-2">
        {info.slots?.map((s) => (
          <div key={s.id} className="rounded-lg border border-border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-sm">
              <p className="font-medium text-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4" /> {fmt(s.scheduled_at)}</p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> {s.duration_minutes} min · capacity {s.capacity}
                {s.location_hint && <><MapPin className="h-3.5 w-3.5 ml-1" /> {s.location_hint}</>}
              </p>
            </div>
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Input type="number" min="1" max="10" value={party[s.id] ?? 1} onChange={(e) => setParty((p) => ({ ...p, [s.id]: e.target.value }))} className="w-16 h-9" aria-label="Party size" />
                <Button size="sm" disabled={busy === s.id || s.status !== 'open'} onClick={() => request(s.id)}>
                  {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Request'}
                </Button>
              </div>
            ) : (
              <Link to="/login"><Button size="sm" variant="outline"><LogIn className="h-4 w-4 mr-1" /> Sign in to book</Button></Link>
            )}
          </div>
        ))}
      </div>

      {isAuthenticated && mine.length > 0 && (
        <div className="mt-5 pt-4 border-t border-border">
          <h3 className="text-sm font-semibold text-foreground mb-2">Your viewings</h3>
          <div className="space-y-2">
            {mine.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{fmt(a.requested_slot)}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                </div>
                {a.booking_code && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Ticket className="h-3.5 w-3.5" /> Booking code: <strong className="text-foreground">{a.booking_code}</strong></p>}
                {a.address_released && <p className="text-xs text-emerald-700 mt-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Address released — see notification</p>}
                {['requested', 'confirmed'].includes(a.status) && (
                  <Button size="sm" variant="ghost" className="mt-2 text-red-600 hover:text-red-700" onClick={() => cancel(a.id)}><XCircle className="h-4 w-4 mr-1" /> Cancel</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}