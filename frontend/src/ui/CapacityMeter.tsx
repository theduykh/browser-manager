import { Icon } from './Icon';

interface Props {
  used: number;
  total: number;
  compact?: boolean;
}

export function CapacityMeter({ used, total, compact }: Props) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  const hue = pct > 85 ? 'var(--c-corrupt)' : pct > 60 ? 'var(--c-alloc)' : 'var(--c-inuse)';
  if (compact) {
    return (
      <div title={`${used} of ${total} slots in use`} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Icon name="server" size={15} style={{ color: 'var(--text-3)' }} />
        <div style={{ width: 64, height: 6, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: hue, transition: 'width var(--med) var(--ease)' }} />
        </div>
        <span className="mono" style={{ fontSize: 12, color: 'var(--text-2)' }}>{used}<span style={{ color: 'var(--text-faint)' }}>/{total}</span></span>
      </div>
    );
  }
  return (
    <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 9 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 550, display: 'inline-flex', gap: 6, alignItems: 'center' }}><Icon name="server" size={14} />Capacity</span>
        <span className="mono" style={{ fontSize: 12.5, color: 'var(--text)' }}>{used}<span style={{ color: 'var(--text-faint)' }}> / {total}</span> slots</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: 'var(--surface-3)', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: `${pct}%`, background: hue, transition: 'width var(--med) var(--ease)' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>{total - used} free · {pct}% utilized</div>
    </div>
  );
}
