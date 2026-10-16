import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { invokeFunction } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ticket, UserX, Loader2 } from 'lucide-react';

export default function CheckInConsole({ auctionId }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['all-viewings', auctionId] });
    queryClient.invalidateQueries({ queryKey: ['all-attendance', auctionId] });
    queryClient.invalidateQueries({ queryKey: ['inspection-info', auctionId] });
    queryClient.invalidateQueries({ queryKey: ['attendance-info', auctionId] });
  };

  const run = async (action) => {
    if (!code.trim()) { toast({ title: 'Enter a booking code', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      // Try attendance first (booking code is the primary identifier); if not
      // found, fall back to a viewing lookup by code.
      let res = await invokeFunction('recordCheckIn', { type: 'attendance', booking_code: code.trim().toUpperCase(), auction_id: auctionId, action });
      if (res.status === 404) {
        res = await invokeFunction('recordCheckIn', { type: 'viewing', booking_code: code.trim().toUpperCase(), auction_id: auctionId, action });
      }
      if (res.status >= 400) toast({ title: 'Check-in failed', description: res.data?.error, variant: 'destructive' });
      else { toast({ title: action === 'check_in' ? 'Arrival recorded' : 'No-show recorded' }); setCode(''); invalidate(); }
    } catch (e) { toast({ title: 'Check-in failed', description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-lg border border-border p-4 bg-muted/20">
      <h3 className="text-sm font-semibold text-foreground mb-2">On-site check-in</h3>
      <p className="text-xs text-muted-foreground mb-3">Enter the attendee's booking code to record arrival. No-shows are logged without penalty.</p>
      <div className="flex flex-col sm:flex-row gap-2 items-end">
        <div className="flex-1 w-full">
          <Label className="text-xs">Booking code</Label>
          <div className="relative">
            <Ticket className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="AT-XXXXXX or WV-XXXXXX" className="pl-8 uppercase" />
          </div>
        </div>
        <Button disabled={busy} onClick={() => run('check_in')}><Loader2 className={busy ? 'h-4 w-4 animate-spin' : 'hidden'} /> <Ticket className="h-4 w-4 mr-1" /> Check in</Button>
        <Button variant="outline" disabled={busy} onClick={() => run('no_show')}><UserX className="h-4 w-4 mr-1" /> No-show</Button>
      </div>
    </div>
  );
}