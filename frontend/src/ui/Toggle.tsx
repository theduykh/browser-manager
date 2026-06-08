interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, size = 'md' }: Props) {
  const w = size === 'sm' ? 30 : 36;
  const h = size === 'sm' ? 17 : 20;
  const k = h - 4;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: w, height: h, borderRadius: 99, padding: 2,
        border: `1px solid ${checked ? 'transparent' : 'var(--border-2)'}`,
        background: checked ? 'var(--accent)' : 'var(--surface-3)', position: 'relative',
        transition: 'all var(--med) var(--ease)', flex: 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: checked ? w - k - 3 : 2, width: k, height: k, borderRadius: '50%',
        background: checked ? '#fff' : 'var(--text-3)', transition: 'all var(--med) var(--ease)',
        boxShadow: '0 1px 2px rgba(0,0,0,.3)',
      }} />
    </button>
  );
}
