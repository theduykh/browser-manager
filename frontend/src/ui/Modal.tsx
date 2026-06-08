import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  icon?: IconName;
}

export function Modal({ title, subtitle, onClose, children, footer, width = 560, icon }: Props) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'var(--scrim)', backdropFilter: 'blur(3px)', zIndex: 200,
        display: 'grid', placeItems: 'center', padding: 24, animation: 'fadeup var(--fast) var(--ease)',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width, maxWidth: '100%', maxHeight: '88vh', background: 'var(--surface)', border: '1px solid var(--border-2)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-pop)', display: 'flex', flexDirection: 'column',
          animation: 'fadeup var(--med) var(--ease)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          {icon && (
            <div style={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 'var(--r-sm)', background: 'var(--accent-tint)', color: 'var(--accent)', flex: 'none' }}>
              <Icon name={icon} size={18} />
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <IconButton name="x" size={17} onClick={onClose} title="Close" />
        </div>
        <div style={{ padding: 20, overflow: 'auto' }}>{children}</div>
        {footer && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', borderRadius: '0 0 var(--r-lg) var(--r-lg)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
