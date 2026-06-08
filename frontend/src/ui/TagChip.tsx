import { useState, type MouseEventHandler, type ReactNode } from 'react';
import { Icon } from './Icon';

interface Props {
  children: ReactNode;
  active?: boolean;
  onClick?: MouseEventHandler<HTMLSpanElement>;
  removable?: boolean;
  onRemove?: () => void;
  small?: boolean;
}

export function TagChip({ children, active, onClick, removable, onRemove, small }: Props) {
  const [h, setH] = useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, cursor: onClick ? 'pointer' : 'default',
        padding: small ? '1px 7px' : '3px 9px', borderRadius: 'var(--r-pill)', fontSize: small ? 11 : 12,
        fontWeight: 500, fontFamily: 'var(--font-mono)', letterSpacing: '-.01em',
        background: active ? 'var(--accent-tint)' : (h && onClick ? 'var(--surface-3)' : 'var(--surface-2)'),
        border: `1px solid ${active ? 'var(--accent-line)' : 'var(--border)'}`,
        color: active ? 'var(--text)' : 'var(--text-2)', transition: 'all var(--fast) var(--ease)', whiteSpace: 'nowrap',
      }}
    >
      {children}
      {removable && (
        <Icon
          name="x"
          size={11}
          style={{ marginRight: -2, opacity: 0.7 }}
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
        />
      )}
    </span>
  );
}
