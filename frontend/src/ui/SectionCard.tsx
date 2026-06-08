import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

interface Props {
  title?: ReactNode;
  action?: ReactNode;
  icon?: IconName;
  pad?: number;
  children: ReactNode;
}

export function SectionCard({ title, action, icon, pad = 18, children }: Props) {
  return (
    <section style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', background: 'var(--surface)', overflow: 'hidden' }}>
      {title && (
        <header style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 18px', borderBottom: '1px solid var(--border)' }}>
          {icon && <Icon name={icon} size={16} style={{ color: 'var(--text-3)' }} />}
          <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, flex: 1, letterSpacing: '-.01em' }}>{title}</h3>
          {action}
        </header>
      )}
      <div style={{ padding: pad }}>{children}</div>
    </section>
  );
}
