import React from 'react';
import { useLiveStream } from '@/lib/liveQueries';
import { Radio } from 'lucide-react';
import CameraViewer from './CameraViewer';

// Normalise common share URLs (YouTube watch, youtu.be, Vimeo) into embeddable
// player URLs. Other https URLs are returned as-is (assumed already embeddable,
// eg a Facebook embed URL or a direct HLS page). Anything that is not https
// (for example a javascript: URL) is rejected so it can never run in the page.
function toEmbed(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return '';
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      const m = u.pathname.match(/\/(?:live|embed)\/([^/?]+)/);
      if (m) return `https://www.youtube.com/embed/${m[1]}`;
    }
    if (u.hostname === 'youtu.be') return `https://www.youtube.com/embed${u.pathname}`;
    if (u.hostname.includes('vimeo.com')) {
      const m = u.pathname.match(/\/(\d+)/);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
    }
    return u.toString();
  } catch (e) {
    return '';
  }
}

// Viewer-facing live broadcast. Renders nothing when the target is not live.
// Embed source shows the external player in an iframe; camera source connects
// to the LiveRoom actor and plays the peer-to-peer WebRTC stream.
export default function LiveStreamPanel({ targetType, targetId }) {
  const { data } = useLiveStream(targetType, targetId);
  if (!data || !data.live) return null;
  const embedSrc = data.source === 'embed' ? toEmbed(data.embed_url) : '';

  return (
    <div className="rounded-xl border border-red-300 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
        </span>
        <Radio className="h-4 w-4" />
        <span className="font-semibold text-sm tracking-wide">LIVE NOW</span>
      </div>
      <div className="aspect-video bg-black">
        {data.source !== 'embed' ? (
          <CameraViewer targetType={targetType} targetId={targetId} />
        ) : embedSrc ? (
          <iframe
            src={embedSrc}
            className="w-full h-full"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
            frameBorder="0"
            title="Live broadcast"
          />
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-white/70">This stream link cannot be played.</p>
        )}
      </div>
    </div>
  );
}