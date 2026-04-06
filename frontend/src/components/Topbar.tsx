import React, { useState, useEffect } from 'react';
import { LogOut, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Page, SimMode } from '@/types';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { PeraWalletConnect } from '@perawallet/connect';

const peraWallet = new PeraWalletConnect();
// Store globally so other components reuse the SAME instance
(window as any).__nexusPeraWallet = peraWallet;

interface TopbarProps {
  activePage: Page;
  session: Session | null;
  sidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  simMode?: SimMode;
  onToggleSim?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({ activePage, session, sidebarOpen, onToggleSidebar, simMode = 'SIM', onToggleSim }) => {

  const [accountAddress, setAccountAddress] = useState<string | null>(null);

  useEffect(() => {
    // Reconnect to the session when the component is mounted
    peraWallet.reconnectSession().then((accounts) => {
      peraWallet.connector?.on("disconnect", handleDisconnectWalletClick);
      if (accounts.length) {
        setAccountAddress(accounts[0]);
        localStorage.setItem('nexus_algo_address', accounts[0]);
      }
    }).catch((e) => console.log(e));


  }, []);

  const handleConnectWalletClick = () => {
    peraWallet.connect()
      .then((newAccounts) => {
        peraWallet.connector?.on("disconnect", handleDisconnectWalletClick);
        setAccountAddress(newAccounts[0]);
        localStorage.setItem('nexus_algo_address', newAccounts[0]);
      })
      .catch((error) => {
        if (error?.data?.type !== "CONNECT_MODAL_CLOSED") {
          console.log(error);
        }
      });
  };

  const handleDisconnectWalletClick = () => {
    peraWallet.disconnect();
    setAccountAddress(null);
    localStorage.removeItem('nexus_algo_address');
  };

  const handleSignOut = async () => {
    localStorage.removeItem('nexus_demo_mode');
    await supabase.auth.signOut();
    window.location.reload(); // Force reload to clear state
  };

  return (
    <div className="sticky top-0 z-40 bg-[rgba(2,4,8,0.9)] backdrop-blur-[20px] border-b border-border-custom px-4 h-14 flex items-center gap-3">
      {/* Hamburger */}
      <button
        onClick={onToggleSidebar}
        className="flex flex-col justify-center items-center w-8 h-8 rounded-md border border-border-custom hover:border-border3 hover:bg-[rgba(0,229,255,0.06)] transition-all shrink-0 group"
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        aria-label="Toggle sidebar"
      >
        <span className={`block w-4 h-[1.5px] bg-t2 group-hover:bg-c1 transition-all duration-300 ${!sidebarOpen ? 'translate-y-[3px] rotate-0' : ''}`}/>
        <span className={`block w-4 h-[1.5px] bg-t2 group-hover:bg-c1 transition-all duration-300 my-[3px] ${!sidebarOpen ? 'opacity-100' : ''}`}/>
        <span className={`block w-4 h-[1.5px] bg-t2 group-hover:bg-c1 transition-all duration-300 ${!sidebarOpen ? '-translate-y-[3px] rotate-0' : ''}`}/>
      </button>

      <div className="font-mono text-[11px] text-t3">
        NEXUS / <span className="text-c1 uppercase">{activePage}</span>
      </div>
      
      {/* SIM/LIVE toggle */}
      <button
        onClick={onToggleSim}
        className={cn(
          'px-2.5 py-1 rounded-md border text-[10px] font-bold font-mono transition-all flex items-center gap-1.5 shrink-0',
          simMode === 'LIVE'
            ? 'border-[rgba(255,34,85,0.4)] bg-[rgba(255,34,85,0.12)] text-r1 animate-pulse'
            : 'border-[rgba(255,214,0,0.3)] bg-[rgba(255,214,0,0.07)] text-gold'
        )}
        title={simMode === 'SIM' ? 'Click to switch to LIVE mode' : 'Click to switch to SIM mode'}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full inline-block', simMode==='LIVE'?'bg-r1':'bg-gold')}/>
        {simMode}
      </button>

      <div className="flex-1" />



      <div className="flex items-center gap-2">
        <div className="w-[7px] h-[7px] rounded-full bg-g1 shadow-[0_0_6px_var(--color-g1)]" />
        <span className="font-mono text-[10px] text-g1 uppercase">BASE SEPOLIA</span>
        
        {session && (
          <div className="flex items-center gap-2">
            {!accountAddress ? (
              <button onClick={handleConnectWalletClick} className="px-3 py-1.5 rounded-md border border-border3 bg-[rgba(0,229,255,0.15)] text-c1 font-semibold text-[11px] flex items-center cursor-pointer gap-2 hover:border-c1 transition-all">
                🔗 Connect Pera
              </button>
            ) : (
              <button onClick={handleDisconnectWalletClick} className="px-3 py-1.5 rounded-md border border-c1 bg-[rgba(0,229,255,0.1)] text-c1 font-bold text-[11px] flex items-center cursor-pointer gap-2 hover:bg-[rgba(0,229,255,0.2)] transition-all">
                🟢 {accountAddress.slice(0, 4)}...{accountAddress.slice(-4)}
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[rgba(255,255,255,0.05)] border border-border2 rounded-md">
              <User className="w-3 h-3 text-c1" />
              <span className="text-[11px] text-white font-medium truncate max-w-[100px]">
                {session.user.email}
              </span>
            </div>
            <button 
              onClick={handleSignOut}
              className="p-1.5 rounded-md border border-border-custom text-muted hover:text-red hover:border-red transition-all cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
