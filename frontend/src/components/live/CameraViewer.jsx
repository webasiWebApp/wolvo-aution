import React, { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

// Viewer side of a Go Live camera broadcast. Connects to the LiveRoom actor as
// a viewer, learns the broadcaster's seat, creates a WebRTC PeerConnection, and
// sends an offer; the broadcaster answers and media flows peer-to-peer. Renders
// the remote stream in a <video>. Falls back to status messages if the
// broadcaster left or the connection failed.
export default function CameraViewer({ targetType, targetId }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('connecting');

  useEffect(() => {
    const roomId = `live_${targetType}_${targetId}`;
    let connId = sessionStorage.getItem('wolvo_live_conn');
    if (!connId) { connId = crypto.randomUUID(); sessionStorage.setItem('wolvo_live_conn', connId); }
    const room = base44.actors.LiveRoom(roomId).connect({ id: connId });
    let pc = null;

    const sub = room.subscribe(async (msg) => {
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'broadcaster' && !pc) {
        try {
          pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
          pc.ontrack = (e) => {
            if (videoRef.current && e.streams && e.streams[0]) videoRef.current.srcObject = e.streams[0];
            setStatus('live');
          };
          pc.oniceconnectionstatechange = () => {
            if (pc && pc.iceConnectionState === 'failed') setStatus('error');
          };
          pc.onicecandidate = (e) => {
            if (e.candidate) room.send({ type: 'ice', to: msg.seat, candidate: e.candidate });
          };
          const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          room.send({ type: 'offer', to: msg.seat, sdp: offer.sdp });
        } catch (err) {
          setStatus('error');
        }
      } else if (msg.type === 'answer' && pc) {
        try { await pc.setRemoteDescription({ type: 'answer', sdp: msg.sdp }); } catch (e) {}
      } else if (msg.type === 'ice' && pc) {
        try { await pc.addIceCandidate(msg.candidate); } catch (e) {}
      } else if (msg.type === 'broadcaster_left') {
        setStatus('ended');
        if (pc) { pc.close(); pc = null; }
      }
    });

    room.send({ type: 'viewer_join' });

    return () => {
      sub.unsubscribe();
      room.close();
      if (pc) pc.close();
    };
  }, [targetType, targetId]);

  return (
    <div className="w-full h-full relative bg-black flex items-center justify-center">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      {status !== 'live' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white/80">
          {status === 'ended' ? (
            <span className="text-sm">Broadcast ended</span>
          ) : status === 'error' ? (
            <span className="text-sm">Could not connect to the live camera</span>
          ) : (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-xs mt-2">Connecting to live camera…</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}