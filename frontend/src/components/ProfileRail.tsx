import { useMemo, useState } from 'react';
import type { Group, Profile } from '../api/types';
import { Icon, StatusDot, TagChip, Button, IconButton, Input, CapacityMeter, type UiStatus } from '../ui';
import type { GroupFilter, OpenFn, StatusFilter } from './profiles.types';

export interface Filters {
  group: GroupFilter;
  tags: string[];
  q: string;
}

interface Props {
  profiles: Profile[];
  list: Profile[];
  groups: Group[];
  filters: Filters;
  setFilters: (fn: (f: Filters) => Filters) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  selectedId: number | null;
  allocatingId: number | null;
  capacity: { used: number; total: number } | null;
  onOpen: OpenFn;
  onNew: () => void;
  onManageGroups: () => void;
}

const STATUS_CHIPS: { k: StatusFilter; label: string }[] = [
  { k: 'all', label: 'All' },
  { k: 'IN_USE', label: 'Live' },
  { k: 'IDLE', label: 'Idle' },
  { k: 'CORRUPT', label: 'Bad' },
];

function ListItem({ p, active, allocating, onOpen }: { p: Profile; active: boolean; allocating: boolean; onOpen: OpenFn }) {
  const [h, setH] = useState(false);
  const status: UiStatus = allocating ? 'ALLOCATING' : p.status;
  return (
    <button
      type="button"
      onClick={() => onOpen(p.id)}
      title={p.profile_name}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative', display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left',
        padding: '7px 10px 7px 11px', borderRadius: 'var(--r-sm)',
        background: active ? 'var(--accent-tint)' : (h ? 'var(--surface-2)' : 'transparent'),
        border: `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`,
        cursor: 'pointer', transition: 'background var(--fast), border-color var(--fast)',
      }}
    >
      {active && <span style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 2.5, borderRadius: 2, background: 'var(--accent)' }} />}
      <StatusDot status={status} size={8} />
      <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: active ? 600 : 460, letterSpacing: '-.02em', color: active ? 'var(--text)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.profile_name}</span>
      {status === 'IN_USE' && p.slot_id != null && <span className="mono" style={{ fontSize: 10.5, color: 'var(--inuse-text)' }}>#{p.slot_id}</span>}
      {status === 'CORRUPT' && <Icon name="alert" size={12} style={{ color: 'var(--corrupt-text)' }} />}
      {status === 'ALLOCATING' && <StatusDot status="ALLOCATING" size={11} />}
    </button>
  );
}

export function ProfileRail({
  profiles, list, groups, filters, setFilters, statusFilter, setStatusFilter,
  selectedId, allocatingId, capacity, onOpen, onNew, onManageGroups,
}: Props) {
  const [tagsOpen, setTagsOpen] = useState(false);
  const tagCounts = useMemo(() => {
    const m: Record<string, number> = {};
    profiles.forEach((p) => p.tags.forEach((t) => { m[t] = (m[t] ?? 0) + 1; }));
    return m;
  }, [profiles]);
  const allTags = useMemo(() => Object.keys(tagCounts).sort(), [tagCounts]);

  const groupCount = (id: GroupFilter) =>
    id === 'all' ? profiles.length
      : id === 'ungrouped' ? profiles.filter((p) => p.group_id === null).length
        : profiles.filter((p) => p.group_id === id).length;

  const groupValue = filters.group === 'all' || filters.group === 'ungrouped' ? filters.group : String(filters.group);

  return (
    <aside style={{ width: 268, flex: 'none', borderRight: '1px solid var(--border)', background: 'var(--rail)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 12px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Button variant="primary" icon="plus" onClick={onNew} style={{ width: '100%', padding: '9px', fontSize: 13.5, justifyContent: 'center' }}>
          Create Profile
        </Button>
        <div style={{ position: 'relative', width: '100%' }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-3)' }} />
          <Input placeholder="Search…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} style={{ padding: '7px 10px 7px 30px', width: '100%', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ padding: '0 12px 8px', display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <Icon name="grid" size={13} style={{ position: 'absolute', left: 9, top: 8, color: 'var(--text-3)', pointerEvents: 'none' }} />
          <select
            value={groupValue}
            onChange={(e) => {
              const val = e.target.value;
              setFilters((f) => ({ ...f, group: val === 'all' || val === 'ungrouped' ? val : Number(val) }));
            }}
            style={{ width: '100%', appearance: 'none', background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', borderRadius: 'var(--r-sm)', padding: '7px 22px 7px 28px', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}
          >
            <option value="all">All groups ({groupCount('all')})</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({groupCount(g.id)})</option>)}
            <option value="ungrouped">Ungrouped ({groupCount('ungrouped')})</option>
          </select>
          <Icon name="chevDown" size={13} style={{ position: 'absolute', right: 8, top: 8, color: 'var(--text-3)', pointerEvents: 'none' }} />
        </div>
        <button
          type="button"
          onClick={() => setTagsOpen((o) => !o)}
          title="Filter by tags"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', borderRadius: 'var(--r-sm)', flex: 'none', cursor: 'pointer',
            background: (tagsOpen || filters.tags.length) ? 'var(--accent-tint)' : 'var(--surface-2)',
            border: `1px solid ${(tagsOpen || filters.tags.length) ? 'var(--accent-line)' : 'var(--border-2)'}`,
            color: filters.tags.length ? 'var(--text)' : 'var(--text-2)', fontSize: 12.5, fontWeight: 500,
          }}
        >
          <Icon name="filter" size={13} />Tags
          {filters.tags.length > 0 && <span className="mono" style={{ fontSize: 10.5, color: 'var(--accent)', background: 'var(--surface)', borderRadius: 99, padding: '0 5px' }}>{filters.tags.length}</span>}
        </button>
      </div>

      {tagsOpen && (
        <div style={{ padding: '0 12px 10px', animation: 'fadeup var(--fast) var(--ease)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, padding: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            {allTags.length === 0 && <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>No tags yet</span>}
            {allTags.map((t) => (
              <TagChip key={t} small active={filters.tags.includes(t)} onClick={() => setFilters((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] }))}>
                {t}<span style={{ color: 'var(--text-faint)', marginLeft: 2 }}>{tagCounts[t]}</span>
              </TagChip>
            ))}
            {filters.tags.length > 0 && <button type="button" onClick={() => setFilters((f) => ({ ...f, tags: [] }))} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11.5, fontWeight: 500, cursor: 'pointer', padding: '1px 4px' }}>Clear all</button>}
          </div>
        </div>
      )}

      <div style={{ padding: '0 12px 8px' }}>
        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
          {STATUS_CHIPS.map((c) => {
            const active = statusFilter === c.k;
            return (
              <button
                key={c.k}
                type="button"
                onClick={() => setStatusFilter(c.k)}
                style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '4px', borderRadius: 'var(--r-xs)', fontSize: 11.5, fontWeight: active ? 600 : 450, cursor: 'pointer', background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-3)', border: `1px solid ${active ? 'var(--border-2)' : 'transparent'}`, boxShadow: active ? 'var(--shadow-sm)' : 'none', transition: 'all var(--fast)' }}
              >
                {c.k !== 'all' && <StatusDot status={c.k as UiStatus} size={6} pulse={false} />}{c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px 6px 14px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.07em', textTransform: 'uppercase' }}>
          Profiles <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 4 }}>({list.length})</span>
        </span>
        <button
          type="button"
          className="ghost"
          onClick={onManageGroups}
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            textTransform: 'uppercase',
            letterSpacing: '.03em',
          }}
        >
          Manage groups
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {list.length === 0
          ? <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No profiles match</div>
          : list.map((p) => <ListItem key={p.id} p={p} active={p.id === selectedId} allocating={allocatingId === p.id} onOpen={onOpen} />)}
      </div>

      {capacity && (
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <CapacityMeter used={capacity.used} total={capacity.total} compact />
        </div>
      )}
    </aside>
  );
}
