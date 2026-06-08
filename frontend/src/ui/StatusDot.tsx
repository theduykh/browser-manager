import { Icon } from './Icon';
import { STATUS, type UiStatus } from './status';

interface Props {
  status: UiStatus;
  size?: number;
  pulse?: boolean;
}

export function StatusDot({ status, size = 8, pulse }: Props) {
  const m = STATUS[status] ?? STATUS.IDLE;
  const live = status === 'IN_USE' && pulse !== false;
  if (status === 'ALLOCATING') {
    return (
      <span style={{ width: size + 4, height: size + 4, display: 'inline-block', position: 'relative' }}>
        <Icon name="refresh" size={size + 4} style={{ color: m.color, animation: 'spin 1s linear infinite' }} />
      </span>
    );
  }
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', background: m.color, flex: 'none',
      display: 'inline-block', animation: live ? 'livepulse 1.8s var(--ease) infinite' : 'none',
    }} />
  );
}
