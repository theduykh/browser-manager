import { useState, type ReactNode } from 'react';
import { IconButton } from './IconButton';

interface Props {
  k: string;
  v: ReactNode;
  mono?: boolean;
  copyable?: boolean;
}

export function KV({ k, v, mono = true, copyable }: Props) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{k}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text)', fontFamily: mono ? 'var(--font-mono)' : 'inherit' }}>{v}</span>
        {copyable && (
          <IconButton
            name={copied ? 'check' : 'copy'}
            size={13}
            style={{ width: 22, height: 22 }}
            title="Copy"
            onClick={() => {
              navigator.clipboard?.writeText(String(v));
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          />
        )}
      </span>
    </div>
  );
}
