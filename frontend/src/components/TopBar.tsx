import { Icon, type IconName, IconButton, CapacityMeter } from '../ui';
import { useTheme } from '../theme/ThemeProvider';

export type Tab = 'profiles' | 'scripts';

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  capacity: { used: number; total: number } | null;
}

const NAV: [Tab, string, IconName][] = [
  ['profiles', 'Profiles', 'layers'],
  ['scripts', 'Scripts', 'play'],
];

export function TopBar({ tab, setTab, capacity }: Props) {
  const { theme, toggleTheme } = useTheme();
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '0 18px', height: 54, borderBottom: '1px solid var(--border)', background: 'var(--surface)', flex: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', boxShadow: '0 2px 8px var(--accent-tint)' }}>
          <Icon name="chrome" size={18} style={{ color: '#fff' }} />
        </div>
        <div style={{ lineHeight: 1.1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 650, letterSpacing: '-.01em' }}>Browser Manager</div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{window.location.host}</div>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: 2, marginLeft: 10 }}>
        {NAV.map(([k, label, ic]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 'var(--r-sm)',
                fontSize: 13.5, fontWeight: active ? 600 : 480, cursor: 'pointer',
                background: active ? 'var(--surface-3)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-2)',
                border: 'none', transition: 'all var(--fast)',
              }}
            >
              <Icon name={ic} size={15} style={{ color: active ? 'var(--accent)' : 'var(--text-3)' }} />{label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {capacity && <CapacityMeter used={capacity.used} total={capacity.total} compact />}
      <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
      <IconButton name={theme === 'dark' ? 'sun' : 'moon'} size={17} title="Toggle theme" onClick={toggleTheme} />
    </header>
  );
}
