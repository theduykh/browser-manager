import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listProfiles } from '../api/profiles';
import { Icon, IconButton, StatusDot, CapacityMeter } from '../ui';
import { LiveStream } from './LiveStream';

interface Props {
  capacity: { used: number; total: number } | null;
  onOpen: (profileId: number) => void;
  onClose: () => void;
}

export function LiveWall({ capacity, onOpen, onClose }: Props) {
  const [cols, setCols] = useState(3);
  const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, refetchInterval: 3000 });
  const live = (profilesQ.data ?? []).filter((p) => p.status === 'IN_USE' && p.ws_port);
  const tileHeight = cols === 4 ? 200 : cols === 3 ? 250 : 320;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'var(--bg)', display: 'flex', flexDirection: 'column', animation: 'fadeup var(--fast) var(--ease)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <Icon name="monitor" size={20} style={{ color: 'var(--accent)' }} />
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Live Wall</h2>
        <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{live.length} active stream{live.length !== 1 ? 's' : ''}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--inuse-text)' }}><StatusDot status="IN_USE" size={7} />polling 3s</span>
        <div style={{ flex: 1 }} />
        {capacity && <CapacityMeter used={capacity.used} total={capacity.total} compact />}
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginLeft: 8 }}>
          {[2, 3, 4].map((n) => (
            <IconButton key={n} name="grid" size={n === 2 ? 13 : n === 3 ? 15 : 17} active={cols === n} onClick={() => setCols(n)} style={{ width: 28, height: 26 }} title={`${n} columns`} />
          ))}
        </div>
        <IconButton name="x" size={18} onClick={onClose} title="Close" />
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {live.length === 0 ? (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
            No active streams. Allocate a profile to watch it here.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 16 }}>
            {live.map((p) => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div onClick={() => onOpen(p.id)} style={{ cursor: 'pointer', height: tileHeight }}>
                  <LiveStream profileId={p.id} wsPort={p.ws_port!} windowWidth={p.window_width} windowHeight={p.window_height} compact />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 4px 2px' }}>
                  <StatusDot status="IN_USE" size={8} />
                  <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.profile_name}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>:{p.cdp_port}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
