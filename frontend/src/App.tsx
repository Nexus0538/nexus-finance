import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { LandingPage } from '@/pages/LandingPage';
import { Dashboard } from '@/pages/Dashboard';
import { AgentOS } from '@/pages/AgentOS';
import { DeFiMatrix } from '@/pages/DeFiMatrix';
import { Bridge } from '@/pages/Bridge';
import { RWAStudio } from '@/pages/RWAStudio';
import { Scanner } from '@/pages/Scanner';
import { Portfolio } from '@/pages/Portfolio';
import { Alerts } from '@/pages/Alerts';
import { PitchDeck } from '@/pages/PitchDeck';
import { TxHistory } from '@/pages/TxHistory';
import { AgentPolicy } from '@/pages/AgentPolicy';
import { RWAInvestor } from '@/pages/RWAInvestor';
import { Settings } from '@/pages/Settings';
import { LiveTxDemo } from '@/pages/LiveTxDemo';
import { CookieConsent } from '@/components/CookieConsent';
import { Page, SimMode } from '@/types';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

export default function App() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [simMode, setSimMode] = useState<SimMode>('SIM');

  useEffect(() => {
    console.log('App: Initializing auth check...');
    
    // Check for demo mode first
    const isDemoMode = localStorage.getItem('nexus_demo_mode') === 'true';
    if (isDemoMode) {
      console.log('App: Demo mode detected');
      // Create a fake session object
      setSession({
        user: { email: 'nexus.demo@gmail.com', id: 'demo-user-id' }
      } as any);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('App: Initial session:', session?.user?.email || 'none');
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('App: Auth state change:', event, session?.user?.email || 'none');
      setSession(session);
      if (event === 'SIGNED_IN') {
        setLoading(false);
      }
    });

    return () => {
      console.log('App: Cleaning up auth subscription');
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-c1 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LandingPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':  return <Dashboard setActivePage={(p) => setActivePage(p as Page)} />;
      case 'agent':      return <AgentOS />;
      case 'defi':       return <DeFiMatrix />;
      case 'bridge':     return <Bridge />;
      case 'rwa':        return <RWAStudio />;
      case 'scanner':    return <Scanner />;
      case 'portfolio':  return <Portfolio />;
      case 'alerts':     return <Alerts />;
      case 'pitch':      return <PitchDeck />;
      case 'txhistory':  return <TxHistory />;
      case 'agentpolicy':return <AgentPolicy />;
      case 'rwainvestor':return <RWAInvestor />;
      case 'settings':   return <Settings />;
      case 'livetx':     return <LiveTxDemo />;
    }
  };

  return (
    <div className="flex min-h-screen relative z-10">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        isOpen={sidebarOpen}
      />

      <main className={`${sidebarOpen ? 'ml-[220px]' : 'ml-[64px]'} flex-1 flex flex-col min-h-screen transition-all duration-300`}>
        <Topbar
          activePage={activePage}
          session={session}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
          simMode={simMode}
          onToggleSim={() => setSimMode(m => m === 'SIM' ? 'LIVE' : 'SIM')}
        />
        <div className="flex-1 animate-in fade-in slide-in-from-bottom-1 duration-500">
          {renderPage()}
        </div>
      </main>

      {/* Cookie Consent */}
      <CookieConsent />

      {/* Toast Container */}
      <div id="toast-container" className="fixed bottom-5 right-5 z-[999] flex flex-col gap-2" />
    </div>
  );
}
