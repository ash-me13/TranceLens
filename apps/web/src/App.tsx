import { useState, useEffect } from 'react';
import Header from './components/Header';
import { Dashboard } from './components/Dashboard';
import { InvestigationWorkspace } from './components/InvestigationWorkspace';
import { Settings } from './components/Settings';
import { DemoLab } from '../../../demo-app/DemoLab';
import { StandaloneTab } from '../../../demo-app/StandaloneTab';
import { NewInvestigationModal } from './components/NewInvestigationModal';
import type { Mode } from '@stateghost/shared';

type View = 'dashboard' | 'investigation' | 'settings' | 'demo';

function App() {
  const [currentView, setCurrentView] = useState<View>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#inv-')) return 'investigation';
    return 'dashboard';
  });
  const [activeInvestigationId, setActiveInvestigationId] = useState<string | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#inv-')) return window.location.hash.replace('#inv-', '');
    return null;
  });
  const [showNewModal, setShowNewModal] = useState(false);
  const [standaloneTab, setStandaloneTab] = useState<'Tab A' | 'Tab B' | null>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#demo-tab-a') return 'Tab A';
      if (window.location.hash === '#demo-tab-b') return 'Tab B';
    }
    return null;
  });

  // Check URL hash for dedicated tab windows or active investigation
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash === '#demo-tab-a') {
        setStandaloneTab('Tab A');
      } else if (hash === '#demo-tab-b') {
        setStandaloneTab('Tab B');
      } else if (hash.startsWith('#inv-')) {
        const id = hash.replace('#inv-', '');
        setActiveInvestigationId(id);
        setCurrentView('investigation');
      } else {
        setStandaloneTab(null);
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // If running in a popup standalone window for Tab A or Tab B:
  if (standaloneTab) {
    return <StandaloneTab tab={standaloneTab} />;
  }

  const navigate = (view: View) => {
    if (view === 'dashboard') {
      window.location.hash = '';
    }
    setCurrentView(view);
  };

  const handleOpenInvestigation = (id: string) => {
    setActiveInvestigationId(id);
    setCurrentView('investigation');
    window.location.hash = `inv-${id}`;
  };

  const handleCreateInvestigation = async (title: string, mode: Mode) => {
    const res = await fetch('/api/investigations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, mode })
    });
    const inv = await res.json();
    handleOpenInvestigation(inv.id);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500/30 selection:text-teal-200">
      <Header
        currentView={currentView}
        onNavigate={navigate}
        onNewInvestigation={() => setShowNewModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12">
        {currentView === 'dashboard' && (
          <Dashboard
            onOpenInvestigation={handleOpenInvestigation}
            onOpenDemoLab={() => setCurrentView('demo')}
            onOpenSettings={() => setCurrentView('settings')}
          />
        )}

        {currentView === 'investigation' && activeInvestigationId && (
          <InvestigationWorkspace
            investigationId={activeInvestigationId}
            onBack={() => {
              window.location.hash = '';
              setCurrentView('dashboard');
            }}
          />
        )}

        {currentView === 'settings' && <Settings />}

        {currentView === 'demo' && (
          <DemoLab onOpenInvestigation={handleOpenInvestigation} />
        )}
      </main>

      {showNewModal && (
        <NewInvestigationModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreateInvestigation}
        />
      )}
    </div>
  );
}

export default App;