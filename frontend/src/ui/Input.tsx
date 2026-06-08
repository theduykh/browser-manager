import { useState, type CSSProperties, type InputHTMLAttributes } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> {
  mono?: boolean;
  style?: CSSProperties;
}

export function Input({ mono, style, ...rest }: Props) {
  const [f, setF] = useState(false);
  return (
    <input
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
      style={{
        background: 'var(--surface)', border: `1px solid ${f ? 'var(--accent-line)' : 'var(--border-2)'}`,
        boxShadow: f ? '0 0 0 3px var(--accent-tint)' : 'none',
        color: 'var(--text)', borderRadius: 'var(--r-sm)', padding: '8px 10px', fontSize: 13,
        fontFamily: mono ? 'var(--font-mono)' : 'inherit', outline: 'none', width: '100%',
        transition: 'border-color var(--fast), box-shadow var(--fast)', ...style,
      }}
      {...rest}
    />
  );
}
