import type { ReactNode } from 'react';

interface Props {
  label?: string;
  hint?: string;
  mono?: boolean;
  children: ReactNode;
}

export function Field({ label, hint, mono, children }: Props) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && <span style={{ fontSize: 12, fontWeight: 550, color: 'var(--text-2)', letterSpacing: '.005em' }}>{label}</span>}
      {children}
      {hint && <span style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{hint}</span>}
    </label>
  );
}
