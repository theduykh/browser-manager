import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
// @ts-ignore — @novnc/novnc exports RFB as its root entry ("exports": "./core/rfb.js").
import RFB from '@novnc/novnc';
import { useHeartbeat } from '../lib/heartbeat';
import { Icon } from '../ui/Icon';
import { Button } from '../ui/Button';

type ConnState = 'connecting' | 'connected' | 'disconnected';

interface Props {
  profileId: number;
  wsPort: number;
  windowWidth: number;
  windowHeight: number;
  /** Hide the faux browser-chrome bar and the fullscreen control (used by Live Wall tiles). */
  compact?: boolean;
}

const BADGE: Record<ConnState, { label: string; dot: string }> = {
  connected:    { label: 'LIVE',       dot: '#ff4757' },
  connecting:   { label: 'CONNECTING', dot: '#fbbf24' },
  disconnected: { label: 'OFFLINE',    dot: '#8b8f9a' },
};

export interface LiveStreamHandle {
  requestFullscreen: () => void;
}

export const LiveStream = forwardRef<LiveStreamHandle, Props>(function LiveStream(
  { profileId, wsPort, windowWidth, windowHeight, compact },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);          // fullscreen target
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<unknown>(null);
  const [conn, setConn] = useState<ConnState>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nonce, setNonce] = useState(0);                  // bump to force a reconnect

  useHeartbeat(profileId);

  useEffect(() => {
    if (!canvasHostRef.current) return;
    // `disposed` guards against React StrictMode's mount→cleanup→remount: the torn-down
    // RFB fires a (non-clean) disconnect that must not clobber the fresh connection's state.
    let disposed = false;
    setConn('connecting');
    setError(null);
    const host = window.location.hostname;
    const url = `ws://${host}:${wsPort}/`;
    const rfb = new RFB(canvasHostRef.current, url, {});
    // RFB has no bundled types; cast to drive the few properties/events we use.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rfb as any;
    r.scaleViewport = true;
    r.resizeSession = false;
    r.addEventListener('connect', () => { if (!disposed) setConn('connected'); });
    r.addEventListener('disconnect', (e: { detail: { clean: boolean } }) => {
      if (disposed) return;
      setConn('disconnected');
      if (!e.detail?.clean) setError('VNC disconnected unexpectedly');
    });
    rfbRef.current = rfb;
    return () => {
      disposed = true;
      try { r.disconnect(); } catch { /* ignore */ }
      rfbRef.current = null;
    };
  }, [profileId, wsPort, nonce]);

  useEffect(() => {
    const onChange = () => {
      const fs = document.fullscreenElement === wrapRef.current;
      setIsFullscreen(fs);
      const rfb = rfbRef.current as { scaleViewport?: boolean } | null;
      if (rfb) setTimeout(() => { rfb.scaleViewport = true; }, 50);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await wrapRef.current?.requestFullscreen();
    } catch (err) {
      setError(`Fullscreen failed: ${String(err)}`);
    }
  };

  useImperativeHandle(ref, () => ({
    requestFullscreen: () => { if (!document.fullscreenElement) void wrapRef.current?.requestFullscreen?.(); },
  }));

  const badge = BADGE[conn];
  const overlayPill: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '4px 9px', borderRadius: 'var(--r-pill)',
    background: 'rgba(8,11,18,.7)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,.1)',
  };

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative', borderRadius: compact ? 'var(--r-md)' : 'var(--r-lg)', overflow: 'hidden',
        border: '1px solid var(--border-2)', background: '#0a0d14',
        boxShadow: compact ? 'none' : 'var(--shadow-md)', height: '100%', display: 'flex', flexDirection: 'column',
      }}
    >
      {!compact && !isFullscreen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c, opacity: 0.9 }} />)}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-pill)', padding: '5px 12px', minWidth: 0 }}>
            <Icon name="globe" size={13} style={{ color: 'var(--text-3)' }} />
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ws://{window.location.hostname}:{wsPort}/
            </span>
          </div>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{windowWidth}×{windowHeight}</span>
        </div>
      )}

      <div style={{ position: 'relative', flex: 1, overflow: 'hidden', background: '#0a0d14' }}>
        <div ref={canvasHostRef} style={{ width: '100%', height: '100%' }} />

        {conn === 'connecting' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#0a0d14' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(100deg, transparent 30%, rgba(255,255,255,.04) 50%, transparent 70%)', backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' }} />
            <div style={{ textAlign: 'center', zIndex: 2 }}>
              <Icon name="refresh" size={26} style={{ color: 'var(--c-info)', animation: 'spin 1s linear infinite' }} />
              <div style={{ marginTop: 14, fontSize: 13, color: 'var(--text-2)' }}>Connecting to stream…</div>
              <div className="mono" style={{ marginTop: 5, fontSize: 11, color: 'var(--text-3)' }}>noVNC · :{wsPort}</div>
            </div>
          </div>
        )}

        {conn === 'disconnected' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#0a0d14' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'grid', placeItems: 'center', width: 46, height: 46, borderRadius: '50%', background: 'var(--corrupt-tint)', border: '1px solid var(--corrupt-line)', margin: '0 auto' }}>
                <Icon name="power" size={22} style={{ color: 'var(--corrupt-text)' }} />
              </div>
              <div style={{ marginTop: 14, fontSize: 13.5, color: 'var(--text)', fontWeight: 550 }}>Stream disconnected</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-3)' }}>{error ?? 'The remote display dropped the connection.'}</div>
              <div style={{ marginTop: 14 }}><Button variant="default" size="sm" icon="refresh" onClick={() => setNonce((n) => n + 1)}>Reconnect</Button></div>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 6, pointerEvents: 'none' }}>
          <div style={overlayPill}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: badge.dot, animation: conn === 'connected' ? 'dotpulse 1.4s infinite' : 'none' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', color: conn === 'connected' ? '#fff' : 'rgba(255,255,255,.8)' }}>{badge.label}</span>
          </div>
          {!compact && (
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
              style={{ ...overlayPill, pointerEvents: 'auto', width: 30, height: 30, padding: 0, display: 'grid', placeItems: 'center', color: '#fff' }}
            >
              <Icon name={isFullscreen ? 'minimize' : 'maximize'} size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
