import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCapacity } from './api/capacity';
import { Dashboard } from './pages/Dashboard';
import { Scripts } from './pages/Scripts';
import { TopBar, type Tab } from './components/TopBar';
import { LiveWall } from './components/LiveWall';

export function App() {
  const [tab, setTab] = useState<Tab>('profiles');
  const [liveWall, setLiveWall] = useState(false);
  const [focusProfileId, setFocusProfileId] = useState<number | null>(null);

  const capacityQ = useQuery({ queryKey: ['capacity'], queryFn: getCapacity, refetchInterval: 3000 });
  const capacity = capacityQ.data ?? null;

  const openFromWall = (profileId: number) => {
    setFocusProfileId(profileId);
    setTab('profiles');
    setLiveWall(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <TopBar tab={tab} setTab={setTab} capacity={capacity} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {tab === 'profiles'
          ? (
            <Dashboard
              focusProfileId={focusProfileId}
              onFocusConsumed={() => setFocusProfileId(null)}
              onOpenLiveWall={() => setLiveWall(true)}
            />
          )
          : <Scripts />}
      </div>
      {liveWall && <LiveWall capacity={capacity} onOpen={openFromWall} onClose={() => setLiveWall(false)} />}
    </div>
  );
}
