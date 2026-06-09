import { useState, type CSSProperties, type MouseEventHandler } from 'react';
import { Icon, type IconName } from './Icon';

interface Props {
  name: IconName;
  size?: number;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
}

export function IconButton({ name, size = 16, title, active, disabled, danger, onClick, style }: Props) {
  const [h, setH] = useState(false);

  let color = active ? 'var(--text)' : 'var(--text-2)';
  let background = active ? 'var(--accent-tint)' : (h ? 'var(--surface-2)' : 'transparent');
  let border = `1px solid ${active ? 'var(--accent-line)' : 'transparent'}`;

  if (danger) {
    color = 'var(--corrupt-text)';
    background = h ? 'var(--corrupt-tint)' : 'transparent';
    border = `1px solid ${h ? 'var(--corrupt-line)' : 'transparent'}`;
  }

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        // Reset the legacy base `button { padding: 6px 12px }` rule, which otherwise
        // shrinks the content box below the icon and shoves it off-center.
        padding: 0,
        display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 'var(--r-sm)',
        background,
        border,
        color,
        opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all var(--fast) var(--ease)', ...style,
      }}
    >
      <Icon name={name} size={size} />
    </button>
  );
}
