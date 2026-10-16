import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44, invokeFunction } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLiveStream } from '@/lib/liveQueries';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Radio, Camera, Link2, Boxes, Gavel, Square } from 'lucide-react';
import CameraBroadcaster from '@/components/live/CameraBroadcaster';

// Auctioneer/admin console to start a Go Live broadcast on one of their open
// auctions or garage sale / house clearance events. Two sources: an external
// embed URL (YouTube/Facebook/custom) or the device camera (peer-to-peer via
// the LiveRoom actor). Lists the targets the user owns, lets them configure and
// start, and stop an active broadcast.
export default function GoLive() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: auctions = [], isLoading: aLoading } = useQuery({
    queryKey: ['golive-auctions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const q = isAdmin
        ? { status: 'open' }
        : { status: 'open', $or: [{ seller_id: user.id }, { created_by_id: user.id }, { auctioneer_id: user.id }] };
      const page = await base44.entities.Auction.filter(q, { sort: '-created_date', limit: 100 });
      return page.items || [];
    },
    enabled: !!user
  });

  const { data: events = [], isLoading: eLoading } = useQuery({
    queryKey: ['golive-events', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const q = isAdmin ? { status: 'open' } : { status: 'open', created_by_id: user.id };
      const page = await base44.entities.GarageSaleEvent.filter(q, { sort: '-created_date', limit: 100 });
      return page.items || [];
    },
    enabled: !!user
  });

  if (aLoading || eLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-2 mb-1">
        <Radio className="h-6 w-6 text-red-600" />
        <h1 className="text-2xl font-bold text-foreground">Go Live</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Broadcast an auction or garage sale event live. Bidders watch and bid in real time. Pick an external stream (YouTube/Facebook) for big crowds, or your device camera for small audiences.
      </p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1"><Gavel className="h-4 w-4" /> Your open auctions</h2>
        {auctions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open auctions to broadcast.</p>
        ) : (
          <div className="space-y-3">
            {auctions.map((a) => <LiveTargetCard key={a.id} type="auction" item={a} />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1"><Boxes className="h-4 w-4" /> Your garage sale events</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open events to broadcast.</p>
        ) : (
          <div className="space-y-3">
            {events.map((e) => <LiveTargetCard key={e.id} type="event" item={e} />)}
          </div>
        )}
      </section>
    </div>
  );
}

function LiveTargetCard({ type, item }) {
  const { data: live } = useLiveStream(type, item.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(null); // 'embed' | 'camera' | null
  const [embedUrl, setEmbedUrl] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [busy, setBusy] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['live-stream', type, item.id] });

  const startEmbed = async () => {
    if (!embedUrl.trim()) { toast({ title: 'Paste a stream URL', variant: 'destructive' }); return; }
    setBusy(true);
    const res = await invokeFunction('goLive', { action: 'start', target_type: type, target_id: item.id, source: 'embed', embed_url: embedUrl.trim() });
    setBusy(false);
    if (res.status >= 400) toast({ title: 'Could not go live', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'You are live' }); setMode(null); invalidate(); }
  };

  const stop = async () => {
    setBusy(true);
    const res = await invokeFunction('goLive', { action: 'stop', target_type: type, target_id: item.id });
    setBusy(false);
    setStreaming(false);
    setMode(null);
    if (res.status >= 400) toast({ title: 'Could not stop', description: res.data?.error, variant: 'destructive' });
    else { toast({ title: 'Broadcast ended' }); }
    invalidate();
  };

  const onCameraStarted = async () => {
    const res = await invokeFunction('goLive', { action: 'start', target_type: type, target_id: item.id, source: 'camera' });
    if (res.status >= 400) toast({ title: 'Could not go live', description: res.data?.error, variant: 'destructive' });
    else invalidate();
  };

  const isLive = !!live?.live;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{item.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{type === 'auction' ? 'Auction' : 'Garage sale event'}</p>
        </div>
        {isLive && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> LIVE · {live.source}
          </span>
        )}
      </div>

      {streaming && mode === 'camera' ? (
        <div className="mt-3">
          <CameraBroadcaster
            targetType={type}
            targetId={item.id}
            onStarted={onCameraStarted}
            onStopped={stop}
          />
        </div>
      ) : isLive ? (
        <div className="mt-3">
          <Button variant="destructive" onClick={stop} disabled={busy} className="w-full">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Square className="h-4 w-4 mr-1" /> Stop broadcast</>}
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          {!mode ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode('embed')}><Link2 className="h-4 w-4 mr-1" /> External stream URL</Button>
              <Button variant="outline" size="sm" onClick={() => { setMode('camera'); setStreaming(true); }}><Camera className="h-4 w-4 mr-1" /> Device camera</Button>
            </div>
          ) : mode === 'embed' ? (
            <div className="space-y-2">
              <div>
                <Label className="text-xs">Stream embed URL (YouTube/Facebook/Vimeo)</Label>
                <Input value={embedUrl} onChange={(e) => setEmbedUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={startEmbed} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Go live'}</Button>
                <Button size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}