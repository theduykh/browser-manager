import { useState } from 'react';
import type { Script } from '../api/types';
import { Icon, Button, Input, IconButton } from '../ui';

interface Props {
  scripts: Script[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
  onNew: () => void;
}

function ListItem({ s, active, onSelect }: { s: Script; active: boolean; onSelect: (id: number) => void }) {
  const [h, setH] = useState(false);
  const statusColor = s.last_run?.status === 'passed' ? 'var(--idle-text)' : s.last_run?.status === 'failed' ? 'var(--corrupt-text)' : 'var(--text-3)';
  return (
    <button
      type="button"
      onClick={() => onSelect(s.id)}
      title={s.name}
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
      <Icon name="play" size={14} style={{ color: active ? 'var(--accent)' : 'var(--text-3)', flex: 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: active ? 600 : 460, letterSpacing: '-.02em', color: active ? 'var(--text)' : 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {s.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.steps.length} step{s.steps.length !== 1 ? 's' : ''}</span>
          {s.last_run && (
            <span style={{ fontSize: 10.5, fontWeight: 550, color: statusColor, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              {s.last_run.status}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function ScriptRail({ scripts, selectedId, loading, onSelect, onNew }: Props) {
  const [q, setQ] = useState('');

  const filtered = q
    ? scripts.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
    : scripts;

  return (
    <aside style={{ width: 268, flex: 'none', borderRight: '1px solid var(--border)', background: 'var(--rail)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '12px 12px 8px', display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon name="search" size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-3)' }} />
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '7px 10px 7px 30px' }} />
        </div>
        <Button variant="primary" icon="plus" onClick={onNew} title="New script" style={{ flex: 'none' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px 6px 14px', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '.07em', textTransform: 'uppercase' }}>Scripts</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{filtered.length}</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {filtered.length === 0
          ? <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>{loading ? 'Loading…' : scripts.length === 0 ? 'No scripts yet' : 'No scripts match'}</div>
          : filtered.map((s) => <ListItem key={s.id} s={s} active={s.id === selectedId} onSelect={onSelect} />)}
      </div>

      <div style={{ padding: 12, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-3)', textAlign: 'center' }}>
        {scripts.length} script{scripts.length !== 1 ? 's' : ''}
      </div>
    </aside>
  );
}
