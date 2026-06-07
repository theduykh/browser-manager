import { useState } from 'react';
import { Dashboard } from './pages/Dashboard';
import { Scripts } from './pages/Scripts';

type View = 'profiles' | 'scripts';

export function App() {
  const [view, setView] = useState<View>('profiles');
  return (
    <div className="app-root">
      <nav className="top-nav">
        <span className="brand">Browser Manager</span>
        <button
          className={`nav-link ${view === 'profiles' ? 'is-active' : ''}`}
          onClick={() => setView('profiles')}
        >
          Profiles
        </button>
        <button
          className={`nav-link ${view === 'scripts' ? 'is-active' : ''}`}
          onClick={() => setView('scripts')}
        >
          Scripts
        </button>
      </nav>
      <div className="view-host">
        {view === 'profiles' ? <Dashboard /> : <Scripts />}
      </div>
    </div>
  );
}
