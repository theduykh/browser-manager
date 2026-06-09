import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCapacity } from './api/capacity';
import { listProfiles } from './api/profiles';
import { Dashboard } from './pages/Dashboard';
import { Scripts } from './pages/Scripts';
import { TopBar, type Tab } from './components/TopBar';
import { LiveWall } from './components/LiveWall';

export function App() {
  const [tab, setTab] = useState<Tab>('profiles');
  const [focusProfileId, setFocusProfileId] = useState<number | null>(null);

  const capacityQ = useQuery({ queryKey: ['capacity'], queryFn: getCapacity, refetchInterval: 3000 });
  const capacity = capacityQ.data ?? null;

  const profilesQ = useQuery({ queryKey: ['profiles'], queryFn: listProfiles, refetchInterval: 3000 });
  const liveCount = (profilesQ.data ?? []).filter((p) => p.status === 'IN_USE').length;

  const openFromWall = (profileId: number) => {
    setFocusProfileId(profileId);
    setTab('profiles');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar tab={tab} setTab={setTab} capacity={capacity} liveCount={liveCount} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {tab === 'profiles' && (
          <Dashboard
            focusProfileId={focusProfileId}
            onFocusConsumed={() => setFocusProfileId(null)}
          />
        )}
        {tab === 'scripts' && <Scripts />}
        {tab === 'livewall' && <LiveWall capacity={capacity} onOpen={openFromWall} />}
      </div>
    </div>
  );
}
