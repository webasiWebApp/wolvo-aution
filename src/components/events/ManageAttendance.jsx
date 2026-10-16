import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useAllAttendance, useAttendanceInfo } from '@/lib/eventQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AttendanceStatusBadge from '@/components/events/AttendanceStatusBadge';
import { CheckCircle2, XCircle, CalendarCheck, CalendarX, RotateCcw, Flag } from 'lucide-react';

export default function ManageAttendance({ auctionId }) {
  const { data: att } = useAttendanceInfo(auctionId);
  const { data: regs = [] } = useAllAttendance(auctionId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rescheduleAt, setRescheduleAt] = useState('');
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance-info', auctionId] });
    queryClient.invalidateQueries({ queryKey: ['all-attendance', auctionId] });
  };

  const decide = async (id, decision) => {
    const res = await invokeFunction('decideAttendance', { registration_id: id, decision });
    if (res.status >= 400) toast({ title: 'Could not decide', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: decision === 'approve' ? 'Attendee confirmed — code issued' : 'Registration declined' }); invalidate(); }
  };

  const manage = async (action, payload = {}) => {
    setBusy(true);
    try {
      const res = await invokeFunction('manageAuctionEvent', { auction_id: auctionId, action, ...payload });
      if (res.status >= 400) toast({ title: 'Could not update event', description: res.data?.error, variant: 'destructive' });
      else { toast({ title: `Event ${action}d` }); setRescheduleAt(''); invalidate(); }
    } catch (e) { toast({ title: 'Could not update event', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  const terminal = ['AUCTION_CONFIRMED', 'AUCTION_CANCELLED', 'AUCTION_COMPLETED'];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border p-4 bg-muted/20">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <AttendanceStatusBadge status={att?.attendance_status} />
          <span className="text-sm text-muted-foreground">{att?.confirmed || 0} confirmed · {att?.registered || 0} pending · min {att?.min_confirmed_attendees || 0}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={busy || !['MINIMUM_ATTENDANCE_REACHED', 'AWAITING_SELLER_CONFIRMATION', 'AWAITING_MINIMUM_ATTENDANCE', 'AUCTION_RESCHEDULED'].includes(att?.attendance_status)} onClick={() => manage('confirm')}><CalendarCheck className="h-4 w-4 mr-1" /> Confirm event</Button>
          <span className="flex items-center gap-1">
            <Input type="datetime-local" value={rescheduleAt} onChange={(e) => setRescheduleAt(e.target.value)} className="h-9 w-44" />
            <Button size="sm" variant="outline" disabled={busy || !rescheduleAt} onClick={() => manage('reschedule', { new_physical_date: rescheduleAt ? new Date(rescheduleAt).toISOString() : undefined })}><RotateCcw className="h-4 w-4 mr-1" /> Reschedule</Button>
          </span>
          <Button size="sm" variant="outline" disabled={busy || terminal.includes(att?.attendance_status)} onClick={() => manage('complete')}><Flag className="h-4 w-4 mr-1" /> Mark completed</Button>
          <Button size="sm" variant="destructive" disabled={busy || att?.attendance_status === 'AUCTION_CANCELLED'} onClick={() => manage('cancel')}><CalendarX className="h-4 w-4 mr-1" /> Cancel event</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Reaching the minimum does not confirm the event — confirm it explicitly. Cancelling frees all capacity and notifies attendees.</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-2">Registrations</h3>
        {regs.length === 0 && <p className="text-xs text-muted-foreground">No registrations.</p>}
        <div className="space-y-2">
          {regs.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3 text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{r.full_name || r.email || 'Attendee'} · party {r.party_size || 1}</p>
                <p className="text-xs text-muted-foreground">{r.email} {r.phone ? `· ${r.phone}` : ''}{r.booking_code ? ` · code ${r.booking_code}` : ''} · status {r.status}{r.check_in_status !== 'pending' ? ` · ${r.check_in_status}` : ''}</p>
              </div>
              <div className="flex gap-2">
                {r.status === 'registered' && (<>
                  <Button size="sm" onClick={() => decide(r.id, 'approve')}><CheckCircle2 className="h-4 w-4 mr-1" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => decide(r.id, 'decline')}><XCircle className="h-4 w-4 mr-1" /> Decline</Button>
                </>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}