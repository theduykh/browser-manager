import { useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'default' | 'ghost' | 'outline' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  full?: boolean;
  danger?: boolean;
  active?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

export function Button({
  variant = 'default', size = 'md', icon, iconRight, children, full, danger, active, style, ...rest
}: Props) {
  const [h, setH] = useState(false);
  const pad = size === 'sm' ? '5px 9px' : size === 'lg' ? '9px 16px' : '7px 12px';
  const fs = size === 'sm' ? 12.5 : size === 'lg' ? 14 : 13;
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    padding: children ? pad : (size === 'sm' ? 6 : 7), borderRadius: 'var(--r-sm)',
    fontSize: fs, fontWeight: 540, lineHeight: 1, letterSpacing: '-.01em',
    border: '1px solid transparent', transition: 'all var(--fast) var(--ease)',
    width: full ? '100%' : 'auto', whiteSpace: 'nowrap', userSelect: 'none',
  };
  const variants: Record<Variant, CSSProperties> = {
    primary: { background: h ? 'var(--accent-hover)' : 'var(--accent)', color: 'var(--accent-fg)', borderColor: 'transparent', boxShadow: '0 1px 0 rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.12)' },
    default: { background: h ? 'var(--surface-hover)' : 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--border-2)' },
    ghost:   { background: h ? 'var(--surface-2)' : 'transparent', color: 'var(--text-2)', borderColor: 'transparent' },
    outline: { background: h ? 'var(--surface-2)' : 'transparent', color: 'var(--text)', borderColor: 'var(--border-2)' },
    subtle:  { background: active ? 'var(--accent-tint)' : (h ? 'var(--surface-2)' : 'transparent'), color: active ? 'var(--text)' : 'var(--text-2)', borderColor: active ? 'var(--accent-line)' : 'transparent' },
  };
  let v: CSSProperties = { ...variants[variant] };
  if (danger) {
    v = { background: h ? 'var(--corrupt-tint)' : 'transparent', color: 'var(--corrupt-text)', borderColor: h ? 'var(--corrupt-line)' : 'var(--border-2)' };
    if (variant === 'primary') v = { background: h ? '#e11d48' : '#f43f5e', color: '#fff', borderColor: 'transparent' };
  }
  return (
    <button
      type="button"
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ ...base, ...v, ...style }}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 15} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 15} />}
    </button>
  );
}
