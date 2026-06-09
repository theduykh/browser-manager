import { Icon, StatusDot, IconButton, Button, type UiStatus } from '../ui';
import type { Density, Sort, SortKey, StatusFilter, ViewMode } from './profiles.types';

interface Props {
  count: number;
  total: number;
  view: ViewMode;
  setView: (v: ViewMode) => void;
  density: Density;
  setDensity: (d: Density) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
  sort: Sort;
  setSort: (fn: (s: Sort) => Sort) => void;
  liveCount: number;
  onLiveWall: () => void;
}

const CHIPS: { k: StatusFilter; label: string }[] = [
  { k: 'all', label: 'All' },
  { k: 'IN_USE', label: 'In use' },
  { k: 'IDLE', label: 'Idle' },
  { k: 'CORRUPT', label: 'Corrupt' },
];

const SORTS: { k: SortKey; label: string }[] = [
  { k: 'status', label: 'Status' },
  { k: 'name', label: 'Name' },
  { k: 'group', label: 'Group' },
  { k: 'lastUsed', label: 'Last used' },
];

export function ProfilesToolbar({ count, total, view, setView, density, setDensity, statusFilter, setStatusFilter, sort, setSort, liveCount, onLiveWall }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', gap: 6, padding: 3, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
        {CHIPS.map((c) => {
          const active = statusFilter === c.k;
          return (
            <button
              key={c.k}
              type="button"
              onClick={() => setStatusFilter(c.k)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 'var(--r-xs)', fontSize: 12.5, fontWeight: active ? 550 : 450, cursor: 'pointer', background: active ? 'var(--surface)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-2)', border: `1px solid ${active ? 'var(--border-2)' : 'transparent'}`, boxShadow: active ? 'var(--shadow-sm)' : 'none', transition: 'all var(--fast)' }}
            >
              {c.k !== 'all' && <StatusDot status={c.k as UiStatus} size={7} pulse={false} />}{c.label}
            </button>
          );
        })}
      </div>

      <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}><b style={{ color: 'var(--text-2)', fontWeight: 600 }}>{count}</b> of {total}</span>

      <div style={{ flex: 1 }} />

      {/* Right controls stay together on one row (no wrap) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Button variant="outline" size="sm" icon="monitor" onClick={onLiveWall}>
          Live Wall
          {liveCount > 0 && <span className="mono" style={{ color: 'var(--inuse-text)', marginLeft: 2 }}>{liveCount}</span>}
        </Button>

        <div style={{ position: 'relative', display: 'inline-flex' }} title="Sort by">
          <Icon name="sort" size={13} style={{ position: 'absolute', left: 8, top: 7, color: 'var(--text-3)', pointerEvents: 'none' }} />
          <select
            value={sort.key}
            onChange={(e) => setSort((s) => ({ ...s, key: e.target.value as SortKey }))}
            style={{ appearance: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 'var(--r-sm)', padding: '6px 22px 6px 26px', fontSize: 12.5, cursor: 'pointer' }}
          >
            {SORTS.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
          </select>
          <Icon name="chevDown" size={12} style={{ position: 'absolute', right: 7, top: 8, color: 'var(--text-3)', pointerEvents: 'none' }} />
        </div>

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }} title="Density">
          <IconButton name="list" size={15} active={density === 'comfortable'} onClick={() => setDensity('comfortable')} style={{ width: 28, height: 26 }} title="Comfortable" />
          <IconButton name="sliders" size={15} active={density === 'compact'} onClick={() => setDensity('compact')} style={{ width: 28, height: 26 }} title="Compact" />
        </div>

        <div style={{ display: 'flex', gap: 2, padding: 3, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
          <IconButton name="grid" size={15} active={view === 'grid'} onClick={() => setView('grid')} style={{ width: 28, height: 26 }} title="Grid" />
          <IconButton name="table" size={15} active={view === 'table'} onClick={() => setView('table')} style={{ width: 28, height: 26 }} title="Table" />
        </div>
      </div>
    </div>
  );
}
