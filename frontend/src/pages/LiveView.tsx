import { useEffect, useRef, useState } from 'react';
// @ts-ignore — @novnc/novnc exports RFB as its root entry ("exports": "./core/rfb.js").
import RFB from '@novnc/novnc';
import { useHeartbeat } from '../lib/heartbeat';

interface Props {
  profileId: number;
  wsPort: number;
  windowWidth: number;
  windowHeight: number;
}

export function LiveView({ profileId, wsPort, windowWidth, windowHeight }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);   // fullscreen target
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<unknown>(null);
  const [connState, setConnState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useHeartbeat(profileId);

  // Mount RFB
  useEffect(() => {
    if (!canvasHostRef.current) return;
    setConnState('connecting');
    setError(null);
    const host = window.location.hostname;
    const url = `ws://${host}:${wsPort}/`;
    const rfb = new RFB(canvasHostRef.current, url, {});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rfb as any).scaleViewport = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rfb as any).resizeSession = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rfb as any).addEventListener('connect', () => setConnState('connected'));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rfb as any).addEventListener('disconnect', (e: { detail: { clean: boolean } }) => {
      setConnState('disconnected');
      if (!e.detail?.clean) setError('VNC disconnected unexpectedly');
    });
    rfbRef.current = rfb;

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { (rfb as any).disconnect(); } catch { /* ignore */ }
      rfbRef.current = null;
    };
  }, [profileId, wsPort]);

  // Track native fullscreen state (Esc, F11, OS-level changes)
  useEffect(() => {
    const onChange = () => {
      const fs = document.fullscreenElement === wrapperRef.current;
      setIsFullscreen(fs);
      // Force noVNC to recompute scale after container size changes.
      const rfb = rfbRef.current as { scaleViewport?: boolean } | null;
      if (rfb) setTimeout(() => { rfb.scaleViewport = true; }, 50);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (wrapperRef.current?.requestFullscreen) {
        await wrapperRef.current.requestFullscreen();
      }
    } catch (err) {
      setError(`Fullscreen failed: ${String(err)}`);
    }
  };

  // Match the profile's aspect ratio. We constrain BOTH width and aspect so the
  // canvas fills the detail column when viewport-height is not the bottleneck,
  // and shrinks proportionally when it is (no letterboxing inside the box).
  const aspectRatio = `${windowWidth} / ${windowHeight}`;
  const ratio = windowWidth / windowHeight;
  const maxWidthByHeight = `calc((100vh - 220px) * ${ratio.toFixed(4)})`;

  return (
    <div
      ref={wrapperRef}
      className={`live-view-embed${isFullscreen ? ' is-fullscreen' : ''}`}
    >
      <div className="live-view-status">
        <span className={`conn-dot conn-${connState}`} />
        <span>{connState}</span>
        <span className="ws-url">ws://{window.location.hostname}:{wsPort}/</span>
        <button
          className="ghost"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
        >
          {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        </button>
      </div>
      {error && <div className="error-banner" style={{ marginBottom: 8 }}>{error}</div>}
      <div
        ref={canvasHostRef}
        className="canvas-host"
        style={isFullscreen ? undefined : { aspectRatio, maxWidth: maxWidthByHeight }}
      />
    </div>
  );
}
