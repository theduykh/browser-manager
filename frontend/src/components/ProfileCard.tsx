import { useState, type MouseEvent } from 'react';
import type { Profile } from '../api/types';
import { Icon, StatusDot, TagChip, Button, STATUS, type UiStatus } from '../ui';
import type { ActionFn, Density, GroupNameFn, OpenFn } from './profiles.types';

interface Props {
  p: Profile;
  density: Density;
  allocatingId: number | null;
  groupName: GroupNameFn;
  onOpen: OpenFn;
  onAction: ActionFn;
}

export function ProfileCard({ p, density, allocatingId, groupName, onOpen, onAction }: Props) {
  const [h, setH] = useState(false);
  const status: UiStatus = allocatingId === p.id ? 'ALLOCATING' : p.status;
  const m = STATUS[status];
  const compact = density === 'compact';
  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      onClick={() => onOpen(p.id)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative', cursor: 'pointer', borderRadius: 'var(--r-md)', overflow: 'hidden',
        border: `1px solid ${h ? 'var(--border-2)' : 'var(--border)'}`,
        background: 'var(--surface)', transition: 'all var(--fast) var(--ease)',
        transform: h ? 'translateY(-1px)' : 'none', boxShadow: h ? 'var(--shadow-md)' : 'none',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: m.color, opacity: status === 'IDLE' ? 0.35 : 1 }} />
      <div style={{ padding: compact ? '11px 13px 11px 15px' : '13px 15px 13px 17px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: compact ? 8 : 10 }}>
          <StatusDot status={status} size={9} />
          <span style={{ flex: 1, minWidth: 0, fontSize: compact ? 13 : 13.5, fontWeight: 550, fontFamily: 'var(--font-mono)', letterSpacing: '-.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.profile_name}</span>
          {status === 'IN_USE' && <Icon name="monitor" size={14} style={{ color: 'var(--inuse-text)' }} />}
          {status === 'CORRUPT' && <Icon name="alert" size={14} style={{ color: 'var(--corrupt-text)' }} />}
        </div>
        {!compact && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="grid" size={11} />{groupName(p.group_id)}
            </span>
            {p.slot_id != null && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>· slot {p.slot_id}</span>}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, minHeight: compact ? 0 : 20, alignItems: 'center' }}>
          {p.tags.slice(0, compact ? 2 : 3).map((t) => <TagChip key={t} small>{t}</TagChip>)}
          {p.tags.length > (compact ? 2 : 3) && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>+{p.tags.length - (compact ? 2 : 3)}</span>}
          {p.tags.length === 0 && !compact && <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>no tags</span>}
        </div>
      </div>
      <div style={{
        display: 'flex', gap: 6, padding: h ? '0 12px 12px' : '0 12px',
        maxHeight: h ? 44 : 0, opacity: h ? 1 : 0, overflow: 'hidden', transition: 'all var(--med) var(--ease)',
      }}>
        {status === 'IDLE' && <Button size="sm" variant="primary" icon="bolt" full onClick={(e) => { stop(e); onAction('allocate', p); }}>Allocate</Button>}
        {status === 'IN_USE' && (
          <>
            <Button size="sm" variant="default" icon="monitor" full onClick={(e) => { stop(e); onOpen(p.id); }}>Watch</Button>
            <Button size="sm" variant="ghost" icon="stop" onClick={(e) => { stop(e); onAction('release', p); }} />
          </>
        )}
        {status === 'CORRUPT' && <Button size="sm" variant="default" danger icon="refresh" full onClick={(e) => { stop(e); onAction('reset', p); }}>Reset profile</Button>}
        {status === 'ALLOCATING' && <Button size="sm" variant="default" full disabled style={{ opacity: 0.7, cursor: 'wait' }}><StatusDot status="ALLOCATING" />Allocating…</Button>}
      </div>
    </div>
  );
}
