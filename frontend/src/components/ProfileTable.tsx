import { useState, type MouseEvent, type ReactNode } from 'react';
import type { Profile } from '../api/types';
import { Icon, StatusPill, TagChip, IconButton, timeAgo, type UiStatus } from '../ui';
import type { ActionFn, GroupNameFn, OpenFn, Sort, SortKey } from './profiles.types';

interface Props {
  profiles: Profile[];
  allocatingId: number | null;
  groupName: GroupNameFn;
  onOpen: OpenFn;
  onAction: ActionFn;
  sort: Sort;
  setSort: (fn: (s: Sort) => Sort) => void;
}

export function ProfileTable({ profiles, allocatingId, groupName, onOpen, onAction, sort, setSort }: Props) {
  const Th = ({ k, children, w, alignR }: { k?: SortKey; children?: ReactNode; w?: number; alignR?: boolean }) => (
    <th
      onClick={k ? () => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' })) : undefined}
      style={{ textAlign: alignR ? 'right' : 'left', padding: '9px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.05em', textTransform: 'uppercase', cursor: k ? 'pointer' : 'default', whiteSpace: 'nowrap', width: w, userSelect: 'none' }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: alignR ? 'flex-end' : 'flex-start' }}>
        {children}{k && sort.key === k && <Icon name="chevDown" size={12} style={{ transform: sort.dir === 'asc' ? 'rotate(180deg)' : 'none', color: 'var(--accent)' }} />}
      </span>
    </th>
  );
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden', background: 'var(--surface)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          <tr>
            <Th k="status" w={120}>Status</Th>
            <Th k="name">Profile</Th>
            <Th k="group" w={170}>Group</Th>
            <Th>Tags</Th>
            <Th k="slot" w={90} alignR>Slot</Th>
            <Th k="lastUsed" w={120} alignR>Last used</Th>
            <Th w={44} />
          </tr>
        </thead>
        <tbody>
          {profiles.map((p, i) => (
            <Row key={p.id} p={p} allocatingId={allocatingId} groupName={groupName} onOpen={onOpen} onAction={onAction} last={i === profiles.length - 1} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ p, allocatingId, groupName, onOpen, onAction, last }: {
  p: Profile; allocatingId: number | null; groupName: GroupNameFn; onOpen: OpenFn; onAction: ActionFn; last: boolean;
}) {
  const [h, setH] = useState(false);
  const status: UiStatus = allocatingId === p.id ? 'ALLOCATING' : p.status;
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <tr
      onClick={() => onOpen(p.id)}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ cursor: 'pointer', background: h ? 'var(--surface-2)' : 'transparent', borderBottom: last ? 'none' : '1px solid var(--border)', transition: 'background var(--fast)' }}
    >
      <td style={{ padding: '9px 14px' }}><StatusPill status={status} size="sm" /></td>
      <td style={{ padding: '9px 14px', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500, letterSpacing: '-.02em' }}>{p.profile_name}</td>
      <td style={{ padding: '9px 14px', fontSize: 12.5, color: 'var(--text-2)' }}>{groupName(p.group_id)}</td>
      <td style={{ padding: '9px 14px' }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {p.tags.slice(0, 3).map((t) => <TagChip key={t} small>{t}</TagChip>)}
          {p.tags.length > 3 && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>+{p.tags.length - 3}</span>}
        </div>
      </td>
      <td className="mono" style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-2)', textAlign: 'right' }}>{p.slot_id ?? '—'}</td>
      <td style={{ padding: '9px 14px', fontSize: 12, color: 'var(--text-3)', textAlign: 'right', whiteSpace: 'nowrap' }}>{timeAgo(p.last_active)}</td>
      <td style={{ padding: '9px 8px', textAlign: 'right' }}>
        <span style={{ opacity: h ? 1 : 0, transition: 'opacity var(--fast)' }}>
          {status === 'IDLE' && <IconButton name="bolt" size={15} title="Allocate" onClick={(e) => { stop(e); onAction('allocate', p); }} />}
          {status === 'IN_USE' && <IconButton name="monitor" size={15} title="Watch" onClick={(e) => { stop(e); onOpen(p.id); }} />}
          {status === 'CORRUPT' && <IconButton name="refresh" size={15} title="Reset" onClick={(e) => { stop(e); onAction('reset', p); }} />}
        </span>
      </td>
    </tr>
  );
}
