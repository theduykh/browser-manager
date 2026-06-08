import { StatusDot } from './StatusDot';
import { STATUS, type UiStatus } from './status';

interface Props {
  status: UiStatus;
  size?: 'sm' | 'md';
}

export function StatusPill({ status, size = 'md' }: Props) {
  const m = STATUS[status] ?? STATUS.IDLE;
  const sm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: sm ? '2px 7px 2px 6px' : '3px 9px 3px 7px',
      borderRadius: 'var(--r-pill)', background: m.tint, border: `1px solid ${m.line}`,
      color: m.text, fontSize: sm ? 11 : 12, fontWeight: 550, letterSpacing: '.01em', whiteSpace: 'nowrap',
    }}>
      <StatusDot status={status} size={sm ? 6 : 7} />
      {m.label}
    </span>
  );
}
