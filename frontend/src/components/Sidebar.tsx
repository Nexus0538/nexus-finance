import React from 'react';
import { 
  LayoutDashboard, 
  Bot, 
  TrendingUp, 
  Waypoints, 
  Building2, 
  Radio, 
  PieChart, 
  Bell, 
  Target,
  Hexagon,
  LogIn
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Page } from '@/types';
import { supabase } from '@/lib/supabase';

interface SidebarProps {
  activePage: Page;
  setActivePage: (page: Page) => void;
  isOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isOpen }) => {
  const navItems = [
    { id: 'dashboard',   label: 'Dashboard',      icon: () => <span>⬡</span>,        section: 'Command Center' },
    { id: 'agent',       label: 'Agent OS',        icon: () => <span>🤖</span>,        section: 'Command Center', badge: 'ARIA' },
    { id: 'defi',        label: 'DeFi Matrix',     icon: () => <span>📈</span>,        section: 'Finance Modules' },
    { id: 'bridge',      label: 'Cross-Chain',     icon: () => <span>🌉</span>,        section: 'Finance Modules' },
    { id: 'rwa',         label: 'RWA Studio',      icon: () => <span>🏦</span>,        section: 'Finance Modules' },
    { id: 'rwainvestor', label: 'RWA Investor',    icon: () => <span>💎</span>,        section: 'Finance Modules' },
    { id: 'scanner',     label: 'Market Scanner',  icon: () => <span>📡</span>,        section: 'Intelligence' },
    { id: 'portfolio',   label: 'Portfolio AI',    icon: () => <span>📊</span>,        section: 'Intelligence' },
    { id: 'alerts',      label: 'Smart Alerts',    icon: () => <span>🔔</span>,        section: 'Intelligence', badge: '3' },
    { id: 'txhistory',   label: 'Tx History',      icon: () => <span>🗂</span>,         section: 'Activity' },
    { id: 'agentpolicy', label: 'Agent Policy',    icon: () => <span>⚙️</span>,        section: 'Activity' },
    { id: 'pitch',       label: 'Pitch Deck',      icon: () => <span>🎯</span>,        section: 'System' },
    { id: 'livetx',      label: 'Live TX Demo',    icon: () => <span>⚡</span>,        section: 'System', badge: 'JURY' },
    { id: 'settings',    label: 'Settings',        icon: () => <span>🔧</span>,        section: 'System' },
  ];

  const sections = Array.from(new Set(navItems.map(item => item.section)));

  return (
    <aside className={`${isOpen ? 'w-[220px]' : 'w-[64px]'} flex-shrink-0 bg-[rgba(5,10,18,0.95)] border-r border-border-custom flex flex-col fixed top-0 left-0 bottom-0 z-50 backdrop-blur-[20px] transition-all duration-300 overflow-hidden`}>
      <div className="p-6 pb-5 border-b border-border-custom">
        <div className={`flex items-center gap-2.5 mb-1.5 ${!isOpen && 'justify-center'}`}>
          <div className="w-[38px] h-[38px] relative flex items-center justify-center shrink-0">
            <div className="absolute inset-0 flex items-center justify-center font-display text-[38px] bg-gradient-to-br from-c1 to-g1 bg-clip-text text-transparent drop-shadow-[0_0_8px_var(--color-c1)]">⬡</div>
          </div>
          {isOpen && <span className="font-display text-[22px] font-bold tracking-[2px] text-wh whitespace-nowrap">NEXUS</span>}
        </div>
        {isOpen && <div className="font-mono text-[10px] text-t3 tracking-[2px]">FINANCE OS v2.0 · AGENTIC</div>}
      </div>

      {isOpen && (
        <div className="flex items-center gap-1.5 px-5 py-2 bg-[rgba(0,255,157,0.04)] border-b border-border-custom font-mono text-[10px] text-g1">
          <div className="w-[5px] h-[5px] rounded-full bg-g1 animate-pulse shadow-[0_0_0_0_rgba(0,255,157,0.4)]" />
          ALL SYSTEMS OPERATIONAL
        </div>
      )}
      {!isOpen && <div className="border-b border-border-custom py-1.5 flex justify-center"><div className="w-[5px] h-[5px] rounded-full bg-g1 animate-pulse"/></div>}

      <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
        {sections.map(section => (
          <React.Fragment key={section}>
            {isOpen && (
              <div className="px-3 py-3 font-mono text-[9px] text-t3 tracking-[2px] uppercase">
                {section}
              </div>
            )}
            {!isOpen && <div className="py-1.5 border-t border-border-custom mx-2 mt-1"/>}
            {navItems.filter(item => item.section === section).map(item => (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id as Page)}
                title={!isOpen ? item.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 py-2.5 px-3 mx-2 rounded-md cursor-pointer transition-all duration-150 text-[13px] font-medium relative group w-[calc(100%-16px)] text-left",
                  !isOpen && 'justify-center px-0',
                  activePage === item.id
                    ? "bg-[rgba(0,229,255,0.08)] text-c1 border border-[rgba(0,229,255,0.12)]"
                    : "text-t2 hover:bg-[rgba(0,229,255,0.06)] hover:text-t1"
                )}
              >
                {activePage === item.id && (
                  <div className="absolute left-[-8px] top-1/2 -translate-y-1/2 w-[3px] h-5 bg-c1 rounded-r-sm" />
                )}
                <item.icon />
                {isOpen && <span className="truncate">{item.label}</span>}
                {isOpen && item.badge && (
                  <span className="ml-auto bg-[rgba(255,107,0,0.15)] border border-[rgba(255,107,0,0.3)] text-o1 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                    {item.badge}
                  </span>
                )}
                {!isOpen && item.badge && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-o1 rounded-full text-[7px] text-black flex items-center justify-center font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-auto p-3 border-t border-border-custom">
        {isOpen ? (
          <div className="flex items-center gap-2 bg-[rgba(0,229,255,0.05)] border border-[rgba(0,229,255,0.12)] rounded-lg p-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-c1 to-p2 flex items-center justify-center text-sm shrink-0">🤖</div>
            <div>
              <div className="text-[12px] font-semibold text-white">ARIA Agent</div>
              <div className="text-[10px] text-green font-mono">● AUTONOMOUS</div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="ARIA Agent">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-c1 to-p2 flex items-center justify-center text-base">🤖</div>
          </div>
        )}
      </div>
    </aside>
  );
};
