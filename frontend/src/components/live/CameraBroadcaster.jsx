import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Users } from 'lucide-react';

// Broadcaster side of a Go Live camera broadcast. Captures the auctioneer's
// camera and microphone, joins the LiveRoom actor as the broadcaster, and for
// each viewer that sends a WebRTC offer, creates a PeerConnection, adds the
// local tracks, and answers — so each viewer receives the stream peer-to-peer.
// onStarted fires after the camera is acquired (the parent then marks the
// target live via the goLive function); onStopped fires when the auctioneer
// presses Stop (the parent stops the broadcast via goLive). A mesh: upload
// bandwidth scales with viewer count, so this suits small audiences; for large
// crowds the auctioneer should use an external embed instead.
export default function CameraBroadcaster({ targetType, targetId, onStarted, onStopped }) {
  const videoRef = useRef(null);
  const roomRef = useRef(null);
  const pcs = useRef(new Map());
  const streamRef = useRef(null);
  const [viewers, setViewers] = useState(0);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let connId = sessionStorage.getItem('wolvo_live_conn');
    if (!connId) { connId = crypto.randomUUID(); sessionStorage.setItem('wolvo_live_conn', connId); }
    const roomId = `live_${targetType}_${targetId}`;
    const room = base44.actors.LiveRoom(roomId).connect({ id: connId });
    roomRef.current = room;

    const handleOffer = async (viewerSeat, sdp) => {
      const stream = streamRef.current;
      if (!stream) return;
      try {
        const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
        pcs.current.set(viewerSeat, pc);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        pc.onicecandidate = (e) => {
          if (e.candidate) room.send({ type: 'ice', to: viewerSeat, candidate: e.candidate });
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
            pcs.current.delete(viewerSeat);
            setViewers(pcs.current.size);
          }
        };
        await pc.setRemoteDescription({ type: 'offer', sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        room.send({ type: 'answer', to: viewerSeat, sdp: answer.sdp });
      } catch (e) {
        // ignore a single failed negotiation; viewer will retry by reconnecting
      }
    };

    const sub = room.subscribe(async (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'offer') {
        await handleOffer(msg.from, msg.sdp);
        setViewers(pcs.current.size);
      } else if (msg.type === 'viewer_left') {
        const pc = pcs.current.get(msg.seat);
        if (pc) { pc.close(); pcs.current.delete(msg.seat); }
        setViewers(pcs.current.size);
      } else if (msg.type === 'ice') {
        const pc = pcs.current.get(msg.from);
        if (pc) { try { await pc.addIceCandidate(msg.candidate); } catch (e) {} }
      }
    });

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 } }, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        room.send({ type: 'broadcaster_join' });
        setReady(true);
        if (onStarted) onStarted();
      } catch (e) {
        setErr(e.message || 'Camera unavailable. Check browser permissions.');
      }
    })();

    return () => {
      cancelled = true;
      sub.unsubscribe();
      room.close();
      pcs.current.forEach((pc) => pc.close());
      pcs.current.clear();
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [targetType, targetId]);

  const stop = async () => {
    if (roomRef.current) roomRef.current.send({ type: 'end' });
    if (onStopped) await onStopped();
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="aspect-video bg-black relative">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {!ready && !err && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {ready && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-semibold">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" /> LIVE
          </span>
        )}
        {ready && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs">
            <Users className="h-3.5 w-3.5" /> {viewers}
          </span>
        )}
      </div>
      {err && <p className="p-3 text-sm text-red-600">{err}</p>}
      <div className="p-3">
        <button onClick={stop} disabled={!ready} className="w-full h-10 rounded-md bg-red-600 text-white text-sm font-medium disabled:opacity-50">
          Stop broadcast
        </button>
        <p className="text-xs text-muted-foreground mt-2">
          Camera streams peer-to-peer to viewers. Best for small audiences; for large crowds, use an external embed (YouTube/Facebook) instead.
        </p>
      </div>
    </div>
  );
}