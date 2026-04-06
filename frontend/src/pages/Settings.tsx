import React, { useState, useEffect } from 'react';
import { Card } from '@/components/UI';
import { cn } from '@/lib/utils';

type Section = 'general' | 'api' | 'notifications' | 'appearance' | 'security' | 'agents' | 'wallet' | 'about';

const SECTIONS: { id: Section; label: string; icon: string; badge?: string }[] = [
  { id: 'general',       label: 'General',       icon: '⚙️' },
  { id: 'agents',        label: 'AI Agents',      icon: '🤖', badge: '4' },
  { id: 'wallet',        label: 'Wallet',         icon: '🔗' },
  { id: 'api',           label: 'API Keys',       icon: '🔑' },
  { id: 'notifications', label: 'Notifications',  icon: '🔔' },
  { id: 'appearance',    label: 'Appearance',     icon: '🎨' },
  { id: 'security',      label: 'Security',       icon: '🛡' },
  { id: 'about',         label: 'About',          icon: 'ℹ️' },
];

const Toggle: React.FC<{ val: boolean; on: () => void; color?: string }> = ({ val, on, color = 'bg-c1' }) => (
  <button onClick={on}
    className={cn('w-10 h-5 rounded-full transition-all duration-200 relative shrink-0', val ? color : 'bg-[rgba(255,255,255,0.08)]')}>
    <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200', val ? 'left-5' : 'left-0.5')} />
  </button>
);

const SettingRow: React.FC<{ label: string; desc?: string; children: React.ReactNode; danger?: boolean }> = ({ label, desc, children, danger }) => (
  <div className={cn('flex items-center justify-between gap-4 py-3.5 border-b border-border-custom last:border-none', danger && 'opacity-90')}>
    <div className="flex-1 min-w-0">
      <div className={cn('text-[13px] font-semibold', danger ? 'text-r1' : 'text-wh')}>{label}</div>
      {desc && <div className="text-[11px] text-t3 mt-0.5 leading-relaxed">{desc}</div>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const StatusBadge: React.FC<{ status: 'ok' | 'warn' | 'error' | 'info'; label: string }> = ({ status, label }) => {
  const styles = { ok: 'text-g1 bg-[rgba(0,255,157,0.08)] border-[rgba(0,255,157,0.25)]', warn: 'text-gold bg-[rgba(255,214,0,0.08)] border-[rgba(255,214,0,0.25)]', error: 'text-r1 bg-[rgba(255,34,85,0.08)] border-[rgba(255,34,85,0.25)]', info: 'text-c1 bg-[rgba(0,229,255,0.08)] border-[rgba(0,229,255,0.25)]' };
  return <span className={cn('font-mono text-[9px] px-2 py-0.5 rounded-md border', styles[status])}>{label}</span>;
};

export const Settings: React.FC = () => {
  const [section, setSection] = useState<Section>('general');
  const [saved, setSaved]     = useState(false);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState('');
  const [testingApi, setTestingApi] = useState('');

  const [env, setEnv] = useState({
    GEMINI_API_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_ANON_KEY: '',
    ALCHEMY_RPC_URL: '',
    PERA_NETWORK: 'testnet',
    ALGORAND_NODE: 'https://testnet-api.algonode.cloud',
    ALGORAND_INDEXER: 'https://testnet-idx.algonode.cloud',
  });

  const [prefs, setPrefs] = useState({
    simMode: 'SIM',
    theme: 'dark',
    accentColor: '#00e5ff',
    currency: 'USD',
    language: 'en',
    timezone: 'UTC',
    autoConnect: true,
    debugMode: false,
    analytics: true,
    compactView: false,
    refreshInterval: 15,
    maxAlerts: 50,
    soundAlerts: false,
    desktopNotifications: true,
    emailDigest: false,
    priceAlertThreshold: 5,
    txApprovalThreshold: 100,
    sessionTimeout: 60,
    twoFactor: false,
    apiRateLimit: 60,
    // Agent prefs
    ariaEnabled: true, ariaAutoExec: true,
    deltaEnabled: true, deltaAutoExec: false,
    kappaEnabled: true, kappaAutoExec: false,
    sigmaEnabled: true, sigmaAutoExec: false,
    globalAgentPause: false,
    agentLogRetention: 30,
    // Wallet
    walletAutoReconnect: true,
    confirmAllTx: true,
    gasBuffer: 20,
    slippageTolerance: 0.5,
  });

  useEffect(() => {
    const s = localStorage.getItem('nexus_settings');
    if (s) { try { setPrefs(p => ({ ...p, ...JSON.parse(s) })); } catch {} }
    const e = localStorage.getItem('nexus_env');
    if (e) { try { setEnv(p => ({ ...p, ...JSON.parse(e) })); } catch {} }
  }, []);

  const saveAll = () => {
    localStorage.setItem('nexus_settings', JSON.stringify(prefs));
    localStorage.setItem('nexus_env', JSON.stringify(env));
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  };

  const up = (k: string, v: any) => setPrefs(p => ({ ...p, [k]: v }));

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key); setTimeout(() => setCopiedKey(''), 2000);
  };

  const testApiKey = async (key: string) => {
    setTestingApi(key);
    await new Promise(r => setTimeout(r, 1500));
    setTestingApi('');
  };

  const notifStatus = typeof window !== 'undefined' && 'Notification' in window
    ? Notification.permission === 'granted' ? 'ok' : Notification.permission === 'denied' ? 'error' : 'warn'
    : 'error';

  const AGENTS = [
    { key: 'aria',  name: 'ARIA',  icon: '🤖', role: 'Market Intelligence',    color: 'text-c1', dot: 'bg-c1', desc: 'Price alerts, market scans, risk reports' },
    { key: 'delta', name: 'DELTA', icon: '⚡', role: 'DeFi Execution',          color: 'text-g1', dot: 'bg-g1', desc: 'Yield harvest, liquidity, protocol swaps' },
    { key: 'kappa', name: 'KAPPA', icon: '🌉', role: 'Cross-Chain Bridge',      color: 'text-p2', dot: 'bg-p2', desc: 'Wormhole bridges, route optimization' },
    { key: 'sigma', name: 'SIGMA', icon: '📊', role: 'RWA Underwriting',        color: 'text-o1', dot: 'bg-o1', desc: 'ASA minting, credit scoring, doc verify' },
  ];

  const ACCENT_COLORS = [
    { c: '#00e5ff', l: 'Cyan' }, { c: '#00ff9d', l: 'Emerald' }, { c: '#a855f7', l: 'Purple' },
    { c: '#ff6b00', l: 'Orange' }, { c: '#ffd600', l: 'Gold' }, { c: '#ff2255', l: 'Rose' },
    { c: '#3b82f6', l: 'Blue' }, { c: '#10b981', l: 'Green' },
  ];

  return (
    <div className="p-5 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="font-display text-[28px] font-bold text-wh tracking-[1px]">Settings</div>
            <span className="px-2 py-0.5 rounded-md border border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.05)] font-mono text-[9px] text-c1 tracking-widest">NEXUS OS v2.0</span>
          </div>
          <p className="text-[12px] text-t2 font-mono">// Configure AI agents · API keys · wallet · appearance · security</p>
        </div>
        <button onClick={saveAll}
          className={cn('px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all duration-200 hover:scale-105 flex items-center gap-2',
            saved ? 'bg-[rgba(0,255,157,0.12)] border border-g1 text-g1 shadow-[0_0_20px_rgba(0,255,157,0.12)]'
                  : 'bg-gradient-to-r from-c2 to-p1 text-white shadow-[0_0_20px_rgba(0,229,255,0.15)] hover:opacity-90')}>
          {saved ? '✅ Saved!' : '💾 Save All Settings'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* Sidebar nav */}
        <div className="lg:w-[210px] flex lg:flex-col gap-1 flex-wrap shrink-0">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left w-full relative',
                section === s.id
                  ? 'bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.15)] text-c1 shadow-[0_0_12px_rgba(0,229,255,0.05)]'
                  : 'text-t2 hover:text-t1 hover:bg-[rgba(255,255,255,0.03)]'
              )}>
              {section === s.id && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-c1 rounded-r-sm" />}
              <span className="text-base">{s.icon}</span>
              <span className="flex-1">{s.label}</span>
              {s.badge && (
                <span className="text-[9px] font-mono bg-[rgba(0,229,255,0.15)] text-c1 px-1.5 py-0.5 rounded-full">{s.badge}</span>
              )}
            </button>
          ))}

          {/* System status mini card */}
          <div className="mt-3 p-3 rounded-xl border border-border-custom bg-[rgba(0,0,0,0.2)] hidden lg:block">
            <div className="text-[9px] font-mono text-t3 uppercase tracking-widest mb-2">System Status</div>
            {[
              { l: 'Gemini API', ok: !!env.GEMINI_API_KEY },
              { l: 'Supabase', ok: !!env.SUPABASE_URL },
              { l: 'Algorand Node', ok: true },
              { l: 'Pera Wallet', ok: prefs.walletAutoReconnect },
            ].map(x => (
              <div key={x.l} className="flex items-center justify-between text-[10px] py-1">
                <span className="text-t3">{x.l}</span>
                <span className={x.ok ? 'text-g1 font-mono' : 'text-r1 font-mono'}>{x.ok ? '● OK' : '● OFF'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ── GENERAL ── */}
          {section === 'general' && (
            <div className="flex flex-col gap-4">
              <Card title="⚙️ General Preferences">
                {/* SIM/LIVE mode */}
                <div className="mb-5">
                  <div className="font-semibold text-wh text-[13px] mb-1">Execution Mode</div>
                  <div className="text-[11px] text-t3 mb-3">SIM uses safe simulations. LIVE executes real blockchain transactions.</div>
                  <div className="flex gap-2">
                    {(['SIM', 'LIVE'] as const).map(m => (
                      <button key={m} onClick={() => up('simMode', m)}
                        className={cn(
                          'flex-1 py-3 rounded-xl border text-[13px] font-bold transition-all duration-200',
                          prefs.simMode === m
                            ? m === 'SIM' ? 'border-gold text-gold bg-[rgba(255,214,0,0.1)] shadow-[0_0_16px_rgba(255,214,0,0.1)]'
                                          : 'border-r1 text-r1 bg-[rgba(255,34,85,0.1)] shadow-[0_0_16px_rgba(255,34,85,0.1)]'
                            : 'border-border-custom text-t3 hover:text-t2'
                        )}>
                        {m === 'SIM' ? '🧪 Simulation' : '⚡ Live Execution'}
                        {prefs.simMode === m && <div className="text-[9px] font-mono opacity-70 mt-0.5">{m === 'SIM' ? 'SAFE MODE' : '⚠️ REAL FUNDS'}</div>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border-custom pt-4 flex flex-col">
                  {/* Dropdowns */}
                  {[
                    { k: 'currency', l: 'Display Currency', desc: 'Fiat currency for value display', opts: ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD'] },
                    { k: 'language', l: 'Interface Language', desc: 'UI language', opts: ['en', 'hi', 'ja', 'zh', 'de', 'fr'] },
                    { k: 'timezone', l: 'Timezone', desc: 'Data timestamps reference', opts: ['UTC', 'IST', 'EST', 'PST', 'CET', 'JST'] },
                  ].map(f => (
                    <SettingRow key={f.k} label={f.l} desc={f.desc}>
                      <select value={(prefs as any)[f.k]} onChange={e => up(f.k, e.target.value)}
                        className="bg-[rgba(0,0,0,0.4)] border border-border-custom rounded-lg px-2.5 py-1.5 text-[12px] text-wh outline-none focus:border-c1 font-mono cursor-pointer">
                        {f.opts.map(o => <option key={o} className="bg-[#05101e]">{o}</option>)}
                      </select>
                    </SettingRow>
                  ))}

                  {/* Number inputs */}
                  {[
                    { k: 'refreshInterval', l: 'Price Refresh (seconds)', desc: 'How often to poll live prices', min: 5, max: 120 },
                    { k: 'maxAlerts', l: 'Max Alerts in Feed', desc: 'Maximum alerts kept in history', min: 10, max: 500 },
                  ].map(f => (
                    <SettingRow key={f.k} label={f.l} desc={f.desc}>
                      <div className="flex items-center gap-2">
                        <button onClick={() => up(f.k, Math.max(f.min, (prefs as any)[f.k] - 1))}
                          className="w-7 h-7 rounded-lg border border-border-custom text-t2 hover:text-wh hover:border-border3 transition-all flex items-center justify-center text-lg">−</button>
                        <span className="font-mono text-[13px] text-c1 w-10 text-center">{(prefs as any)[f.k]}</span>
                        <button onClick={() => up(f.k, Math.min(f.max, (prefs as any)[f.k] + 1))}
                          className="w-7 h-7 rounded-lg border border-border-custom text-t2 hover:text-wh hover:border-border3 transition-all flex items-center justify-center text-lg">+</button>
                      </div>
                    </SettingRow>
                  ))}

                  {/* Toggles */}
                  {[
                    { k: 'autoConnect', l: 'Auto-connect Pera Wallet', desc: 'Reconnect wallet session on page load' },
                    { k: 'compactView', l: 'Compact View', desc: 'Reduce padding for more data density' },
                    { k: 'debugMode',   l: 'Debug Mode', desc: 'Show verbose logs in browser console' },
                    { k: 'analytics',   l: 'Usage Analytics', desc: 'Anonymous telemetry to improve NEXUS' },
                  ].map(f => (
                    <SettingRow key={f.k} label={f.l} desc={f.desc}>
                      <Toggle val={(prefs as any)[f.k]} on={() => up(f.k, !(prefs as any)[f.k])} />
                    </SettingRow>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ── AI AGENTS ── */}
          {section === 'agents' && (
            <div className="flex flex-col gap-4">
              {/* Global kill switch */}
              <div className={cn('rounded-2xl border p-4 transition-all', prefs.globalAgentPause
                ? 'border-[rgba(255,34,85,0.3)] bg-[rgba(255,34,85,0.05)]'
                : 'border-border-custom bg-[rgba(0,0,0,0.15)]')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚨</span>
                    <div>
                      <div className="font-bold text-[14px] text-wh">Global Agent Pause</div>
                      <div className="text-[11px] text-t3">Immediately suspend ALL agents from executing any transactions</div>
                    </div>
                  </div>
                  <Toggle val={prefs.globalAgentPause} on={() => up('globalAgentPause', !prefs.globalAgentPause)} color="bg-r1" />
                </div>
              </div>

              {/* Per-agent cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AGENTS.map(ag => {
                  const enKey = `${ag.key}Enabled` as keyof typeof prefs;
                  const exKey = `${ag.key}AutoExec` as keyof typeof prefs;
                  const isOn  = prefs[enKey] as boolean;
                  return (
                    <div key={ag.key}
                      className={cn('rounded-2xl border p-4 transition-all duration-200',
                        isOn && !prefs.globalAgentPause
                          ? `border-[${ag.color.replace('text-', 'rgba(')}]`
                          : 'border-border-custom bg-[rgba(0,0,0,0.15)] opacity-75')}
                      style={isOn && !prefs.globalAgentPause ? { borderColor: `${ag.dot.replace('bg-', '')}33` } : {}}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center text-xl',
                            isOn ? `border-[rgba(255,255,255,0.1)]` : 'border-border-custom opacity-50')}>
                            {ag.icon}
                          </div>
                          <div>
                            <div className={cn('font-display text-[15px] font-bold', isOn ? ag.color : 'text-t3')}>{ag.name}</div>
                            <div className="text-[10px] text-t3 font-mono">{ag.role}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn('w-1.5 h-1.5 rounded-full', isOn && !prefs.globalAgentPause ? ag.dot + ' animate-pulse' : 'bg-t3')} />
                          <Toggle val={isOn} on={() => up(enKey as string, !isOn)} color={ag.dot} />
                        </div>
                      </div>
                      <div className="text-[10px] text-t3 mb-3">{ag.desc}</div>
                      <div className="flex items-center justify-between py-2 border-t border-border-custom">
                        <div>
                          <div className="text-[12px] text-t1">Auto-Execute</div>
                          <div className="text-[9px] text-t3 font-mono">Skip manual approval</div>
                        </div>
                        <Toggle val={(prefs[exKey] as boolean) && isOn} on={() => up(exKey as string, !(prefs[exKey] as boolean))} color="bg-c1" />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Card title="📋 Agent Logging">
                <SettingRow label="Log Retention" desc="Days to keep agent activity logs in storage">
                  <div className="flex items-center gap-2">
                    <button onClick={() => up('agentLogRetention', Math.max(1, prefs.agentLogRetention - 1))}
                      className="w-7 h-7 rounded-lg border border-border-custom text-t2 hover:text-wh transition-all flex items-center justify-center">−</button>
                    <span className="font-mono text-[13px] text-c1 w-12 text-center">{prefs.agentLogRetention}d</span>
                    <button onClick={() => up('agentLogRetention', Math.min(365, prefs.agentLogRetention + 1))}
                      className="w-7 h-7 rounded-lg border border-border-custom text-t2 hover:text-wh transition-all flex items-center justify-center">+</button>
                  </div>
                </SettingRow>
                <SettingRow label="Export Agent Logs" desc="Download full activity log as JSON">
                  <button onClick={() => {
                    const data = JSON.stringify({ logs: [], exportedAt: new Date().toISOString() }, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const u = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = u; a.download = 'nexus_agent_logs.json'; a.click();
                  }} className="px-3 py-1.5 rounded-lg border border-c1 text-c1 text-[11px] font-bold hover:bg-[rgba(0,229,255,0.08)] transition-all">
                    ⬇ Export
                  </button>
                </SettingRow>
                <SettingRow label="Clear Logs" desc="Permanently delete all stored agent logs">
                  <button onClick={() => localStorage.removeItem('nexus_agent_logs')}
                    className="px-3 py-1.5 rounded-lg border border-r1 text-r1 text-[11px] font-bold hover:bg-[rgba(255,34,85,0.08)] transition-all">
                    🗑 Clear
                  </button>
                </SettingRow>
              </Card>
            </div>
          )}

          {/* ── WALLET ── */}
          {section === 'wallet' && (
            <div className="flex flex-col gap-4">
              <Card title="🔗 Pera Wallet & Algorand">
                <div className="flex items-center gap-4 p-4 bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.12)] rounded-xl mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-c1 to-p2 flex items-center justify-center text-2xl">🦋</div>
                  <div className="flex-1">
                    <div className="font-bold text-wh text-[14px]">Pera Wallet</div>
                    <div className="font-mono text-[10px] text-t3 mt-0.5">Algorand native · Self-custody · WalletConnect 2.0</div>
                  </div>
                  <StatusBadge status="ok" label="CONNECTED" />
                </div>

                {[
                  { k: 'walletAutoReconnect', l: 'Auto-Reconnect', desc: 'Restore wallet session on page load without prompt' },
                  { k: 'confirmAllTx', l: 'Confirm All Transactions', desc: 'Show Pera confirmation for every agent TX' },
                ].map(f => (
                  <SettingRow key={f.k} label={f.l} desc={f.desc}>
                    <Toggle val={(prefs as any)[f.k]} on={() => up(f.k, !(prefs as any)[f.k])} />
                  </SettingRow>
                ))}

                <SettingRow label="Gas Buffer %" desc="Extra microALGO buffer added to estimated transaction fees">
                  <div className="flex items-center gap-2">
                    <input type="range" min={0} max={100} value={prefs.gasBuffer} onChange={e => up('gasBuffer', +e.target.value)}
                      className="w-24 h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-border-custom" />
                    <span className="font-mono text-[12px] text-c1 w-8 text-right">{prefs.gasBuffer}%</span>
                  </div>
                </SettingRow>

                <SettingRow label="Slippage Tolerance" desc="Max acceptable price slippage for DEX transactions">
                  <div className="flex gap-1.5">
                    {[0.1, 0.5, 1.0, 3.0].map(v => (
                      <button key={v} onClick={() => up('slippageTolerance', v)}
                        className={cn('px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-all',
                          prefs.slippageTolerance === v ? 'border-c1 text-c1 bg-[rgba(0,229,255,0.08)]' : 'border-border-custom text-t3 hover:text-t2')}>
                        {v}%
                      </button>
                    ))}
                  </div>
                </SettingRow>
              </Card>

              <Card title="⛓ Network Configuration">
                {[
                  { k: 'PERA_NETWORK', l: 'Algorand Network', desc: 'Active network for all transactions', opts: ['testnet', 'mainnet', 'betanet'] },
                ].map(f => (
                  <SettingRow key={f.k} label={f.l} desc={f.desc}>
                    <select value={env[f.k as keyof typeof env]} onChange={e => setEnv(p => ({ ...p, [f.k]: e.target.value }))}
                      className="bg-[rgba(0,0,0,0.4)] border border-border-custom rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-wh outline-none focus:border-c1 cursor-pointer">
                      {f.opts.map(o => <option key={o} className="bg-[#05101e]">{o}</option>)}
                    </select>
                  </SettingRow>
                ))}
                {[
                  { k: 'ALGORAND_NODE', l: 'Algorand Node URL', ph: 'https://testnet-api.algonode.cloud' },
                  { k: 'ALGORAND_INDEXER', l: 'Algorand Indexer URL', ph: 'https://testnet-idx.algonode.cloud' },
                ].map(f => (
                  <SettingRow key={f.k} label={f.l} desc="Custom node endpoint">
                    <input value={env[f.k as keyof typeof env]} onChange={e => setEnv(p => ({ ...p, [f.k]: e.target.value }))}
                      placeholder={f.ph}
                      className="w-64 bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-wh placeholder:text-t3 outline-none focus:border-c1 transition-colors" />
                  </SettingRow>
                ))}
                <div className="mt-3 p-3 bg-[rgba(0,0,0,0.2)] rounded-xl border border-border-custom">
                  <div className="text-[9px] font-mono text-t3 uppercase tracking-widest mb-2">Network Stats</div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { l: 'Block Time', v: '< 4s' }, { l: 'Network', v: env.PERA_NETWORK.toUpperCase() }, { l: 'Consensus', v: 'Pure PoS' },
                    ].map(s => (
                      <div key={s.l} className="bg-[rgba(0,229,255,0.04)] rounded-lg p-2">
                        <div className="font-mono text-[12px] font-bold text-c1">{s.v}</div>
                        <div className="font-mono text-[8px] text-t3 uppercase">{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── API KEYS ── */}
          {section === 'api' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 p-4 bg-[rgba(255,107,0,0.04)] border border-[rgba(255,107,0,0.15)] rounded-2xl">
                <span className="text-xl mt-0.5">⚠️</span>
                <div>
                  <div className="font-mono text-[11px] text-o1 font-bold mb-1">Security Notice</div>
                  <div className="text-[11px] text-t2 leading-relaxed">API keys stored here are saved to localStorage. For production, use a secure backend proxy with environment variables. Never commit keys to source control.</div>
                </div>
              </div>

              <Card title="🔑 Service API Keys">
                <div className="flex flex-col gap-5">
                  {[
                    { k: 'GEMINI_API_KEY', l: 'Gemini API Key', desc: 'Powers all 4 AI agents · Get from Google AI Studio', ph: 'AIzaSy...', status: 'ok' as const, required: true, link: 'https://aistudio.google.com' },
                    { k: 'SUPABASE_URL',   l: 'Supabase Project URL', desc: 'Database & Auth · From your Supabase dashboard', ph: 'https://xxxx.supabase.co', status: 'ok' as const, required: true, link: 'https://supabase.com/dashboard' },
                    { k: 'SUPABASE_ANON_KEY', l: 'Supabase Anon Key', desc: 'Public client key · Settings → API in Supabase', ph: 'eyJh...', status: 'ok' as const, required: true },
                    { k: 'ALCHEMY_RPC_URL', l: 'Alchemy RPC URL', desc: 'EVM chains node (Base, Arbitrum) · Optional for Algorand-only', ph: 'https://...alchemyapi.io', status: 'info' as const, required: false, link: 'https://alchemy.com' },
                  ].map(f => (
                    <div key={f.k} className="rounded-xl border border-border-custom p-4 hover:border-border2 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px] text-wh font-bold">{f.l}</span>
                          {f.required ? <StatusBadge status="warn" label="REQUIRED" /> : <StatusBadge status="info" label="OPTIONAL" />}
                          {env[f.k as keyof typeof env] && <StatusBadge status="ok" label="SET" />}
                        </div>
                        {'link' in f && (
                          <a href={(f as any).link} target="_blank" rel="noreferrer"
                            className="text-[10px] font-mono text-c1 hover:underline">↗ Get key</a>
                        )}
                      </div>
                      <div className="text-[10px] text-t3 mb-2">{f.desc}</div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showKey[f.k] ? 'text' : 'password'}
                            value={env[f.k as keyof typeof env]}
                            onChange={e => setEnv(p => ({ ...p, [f.k]: e.target.value }))}
                            placeholder={f.ph}
                            className="w-full bg-[rgba(0,0,0,0.4)] border border-border-custom rounded-lg px-3 py-2 text-[12px] text-wh placeholder:text-t3 outline-none focus:border-c1 font-mono pr-10 transition-colors" />
                          <button onClick={() => setShowKey(p => ({ ...p, [f.k]: !p[f.k] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-t3 hover:text-wh transition-colors text-[13px]">
                            {showKey[f.k] ? '🙈' : '👁'}
                          </button>
                        </div>
                        <button onClick={() => copyToClipboard(env[f.k as keyof typeof env], f.k)}
                          className="px-2.5 rounded-lg border border-border-custom text-t3 hover:text-c1 hover:border-[rgba(0,229,255,0.3)] transition-all text-[12px]">
                          {copiedKey === f.k ? '✅' : '⎘'}
                        </button>
                        <button onClick={() => testApiKey(f.k)}
                          disabled={!env[f.k as keyof typeof env] || testingApi === f.k}
                          className="px-3 rounded-lg border border-border-custom text-[11px] font-mono text-t2 hover:text-g1 hover:border-g1/30 transition-all disabled:opacity-40">
                          {testingApi === f.k ? <div className="w-3 h-3 border border-g1 border-t-transparent rounded-full animate-spin" /> : 'Test'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="⚡ Rate Limits">
                <SettingRow label="Max API calls / minute" desc="Gemini free tier allows 60/min · Pro allows 1000+/min">
                  <div className="flex items-center gap-3">
                    <input type="range" min={10} max={200} value={prefs.apiRateLimit} onChange={e => up('apiRateLimit', +e.target.value)}
                      className="w-28 h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-border-custom" />
                    <span className="font-mono text-[13px] text-c1 w-12">{prefs.apiRateLimit}/min</span>
                  </div>
                </SettingRow>
              </Card>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {section === 'notifications' && (
            <div className="flex flex-col gap-4">
              <Card title="🔔 Notification Channels">
                <div className="flex items-center gap-3 p-3 bg-[rgba(0,0,0,0.2)] rounded-xl border border-border-custom mb-4">
                  <div className="flex-1">
                    <div className="text-[12px] text-t1 font-semibold">Browser Notification Status</div>
                    <div className="text-[10px] text-t3 font-mono mt-0.5">
                      {'Notification' in window ? Notification.permission : 'Not supported'}
                    </div>
                  </div>
                  <StatusBadge status={notifStatus} label={notifStatus === 'ok' ? 'GRANTED' : notifStatus === 'error' ? 'BLOCKED' : 'PENDING'} />
                  {notifStatus !== 'ok' && (
                    <button onClick={() => { if ('Notification' in window) Notification.requestPermission(); }}
                      className="px-3 py-1.5 rounded-lg border border-c1 text-c1 text-[11px] font-bold hover:bg-[rgba(0,229,255,0.08)] transition-all">
                      Enable
                    </button>
                  )}
                </div>

                {[
                  { k: 'desktopNotifications', l: 'Browser Push Alerts', desc: 'Pop-up notifications when price targets are hit', icon: '🖥' },
                  { k: 'soundAlerts',          l: 'Sound Alerts',        desc: 'Audio chime for HIGH priority alerts', icon: '🔊' },
                  { k: 'emailDigest',          l: 'Email Daily Digest',  desc: 'AI-generated portfolio summary sent to email', icon: '📧' },
                ].map(f => (
                  <SettingRow key={f.k} label={`${f.icon} ${f.l}`} desc={f.desc}>
                    <Toggle val={(prefs as any)[f.k]} on={() => up(f.k, !(prefs as any)[f.k])} />
                  </SettingRow>
                ))}
              </Card>

              <Card title="📊 Alert Thresholds">
                <SettingRow label="Price Alert Threshold %" desc="Minimum price move to trigger a notification">
                  <div className="flex items-center gap-3">
                    <input type="range" min={0.5} max={20} step={0.5} value={prefs.priceAlertThreshold}
                      onChange={e => up('priceAlertThreshold', +e.target.value)}
                      className="w-28 h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-border-custom" />
                    <span className="font-mono text-[13px] text-c1 w-10">{prefs.priceAlertThreshold}%</span>
                  </div>
                </SettingRow>

                {/* Alert types */}
                <div className="mt-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-t3 mb-2">Alert Event Types</div>
                  <div className="grid grid-cols-2 gap-2">
                    {['Price Target Hit', 'Agent TX Complete', 'Portfolio Rebalance', 'Risk Score Change', 'New RWA Asset', 'Bridge Completion'].map(label => (
                      <div key={label} className="flex items-center gap-2 p-2.5 rounded-lg border border-border-custom hover:border-border2 transition-all">
                        <div className="w-1.5 h-1.5 rounded-full bg-g1 animate-pulse" />
                        <span className="text-[11px] text-t1">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── APPEARANCE ── */}
          {section === 'appearance' && (
            <div className="flex flex-col gap-4">
              <Card title="🎨 Theme & Colors">
                <div className="mb-5">
                  <div className="font-semibold text-wh text-[13px] mb-3">Theme Preset</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'dark',     label: 'Dark',     icon: '🌑', desc: 'Default dark mode' },
                      { id: 'darker',   label: 'Darker',   icon: '⚫', desc: 'Pure black OLED' },
                      { id: 'midnight', label: 'Midnight', icon: '🌌', desc: 'Deep navy blue' },
                    ].map(t => (
                      <button key={t.id} onClick={() => up('theme', t.id)}
                        className={cn('py-3 rounded-xl border text-center transition-all duration-200 hover:scale-[1.02]',
                          prefs.theme === t.id ? 'border-c1 bg-[rgba(0,229,255,0.08)] shadow-[0_0_16px_rgba(0,229,255,0.08)]' : 'border-border-custom hover:border-border2')}>
                        <div className="text-2xl mb-1">{t.icon}</div>
                        <div className={cn('text-[12px] font-bold', prefs.theme === t.id ? 'text-c1' : 'text-t1')}>{t.label}</div>
                        <div className="text-[9px] text-t3">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border-custom pt-4">
                  <div className="font-semibold text-wh text-[13px] mb-3">Accent Color</div>
                  <div className="flex flex-wrap gap-3">
                    {ACCENT_COLORS.map(col => (
                      <button key={col.c} onClick={() => up('accentColor', col.c)}
                        className="flex flex-col items-center gap-1.5 group transition-transform hover:scale-110">
                        <div className={cn('w-9 h-9 rounded-xl border-2 transition-all', prefs.accentColor === col.c ? 'border-white scale-110' : 'border-transparent')}
                          style={{ backgroundColor: col.c, boxShadow: prefs.accentColor === col.c ? `0 0 16px ${col.c}` : 'none' }} />
                        <span className="font-mono text-[8px] text-t3">{col.l}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              <Card title="📐 Layout & Density">
                <SettingRow label="Compact View" desc="Reduce padding and spacing for more data per screen">
                  <Toggle val={prefs.compactView} on={() => up('compactView', !prefs.compactView)} />
                </SettingRow>
                <div className="mt-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-t3 mb-3">Color Palette Preview</div>
                  <div className="grid grid-cols-6 gap-2">
                    {[
                      { c: '#00e5ff', l: 'Cyan' }, { c: '#00ff9d', l: 'Green' }, { c: '#a855f7', l: 'Purple' },
                      { c: '#ff6b00', l: 'Orange' }, { c: '#ffd600', l: 'Gold' }, { c: '#ff2255', l: 'Red' },
                    ].map(col => (
                      <div key={col.l} className="flex flex-col items-center gap-1">
                        <div className="w-full h-8 rounded-lg" style={{ backgroundColor: col.c, boxShadow: `0 0 12px ${col.c}40` }} />
                        <span className="font-mono text-[8px] text-t3">{col.l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ── SECURITY ── */}
          {section === 'security' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 p-4 bg-[rgba(255,34,85,0.04)] border border-[rgba(255,34,85,0.15)] rounded-2xl">
                <span className="text-xl">🔴</span>
                <div>
                  <div className="font-mono text-[11px] text-r1 font-bold mb-1">TESTNET MODE – No real funds at risk</div>
                  <div className="text-[11px] text-t2">All transactions execute on Algorand Testnet. Switch to LIVE + mainnet only when ready for production.</div>
                </div>
              </div>

              <Card title="🛡 Access Control">
                {[
                  { k: 'twoFactor', l: 'Two-Factor Authentication', desc: 'Require 2FA for transactions above approval threshold', icon: '🔐' },
                  { k: 'confirmAllTx', l: 'Confirm All Agent Transactions', desc: 'Pera Wallet prompt for every agent action', icon: '✅' },
                  { k: 'desktopNotifications', l: 'Notify on Each TX', desc: 'Browser push for every transaction submitted', icon: '🔔' },
                ].map(f => (
                  <SettingRow key={f.k} label={`${f.icon} ${f.l}`} desc={f.desc}>
                    <Toggle val={(prefs as any)[f.k]} on={() => up(f.k, !(prefs as any)[f.k])} />
                  </SettingRow>
                ))}

                {[
                  { k: 'txApprovalThreshold', l: 'Manual Approval Above ($)', desc: 'Require human approval for TXs over this value', min: 0, max: 100000, step: 10, unit: '$' },
                  { k: 'sessionTimeout', l: 'Session Timeout (minutes)', desc: 'Auto-logout after inactivity', min: 5, max: 480, step: 5, unit: 'min' },
                ].map(f => (
                  <div key={f.k} className="py-3.5 border-b border-border-custom last:border-none">
                    <div className="flex justify-between mb-2">
                      <div>
                        <div className="text-[13px] font-semibold text-wh">{f.l}</div>
                        <div className="text-[11px] text-t3">{f.desc}</div>
                      </div>
                      <span className="font-mono font-bold text-c1 text-[14px]">{f.unit}{(prefs as any)[f.k].toLocaleString()}</span>
                    </div>
                    <input type="range" min={f.min} max={f.max} step={f.step} value={(prefs as any)[f.k]}
                      onChange={e => up(f.k, +e.target.value)}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-border-custom" />
                  </div>
                ))}
              </Card>

              <Card title="🔧 Danger Zone">
                <div className="flex flex-col gap-2">
                  {[
                    { l: 'Export All Data', desc: 'Download your settings, policies & logs as JSON', col: 'border-c1 text-c1', action: () => {
                      const data = JSON.stringify({ prefs, exportedAt: new Date().toISOString() }, null, 2);
                      const blob = new Blob([data], { type: 'application/json' });
                      const u = URL.createObjectURL(blob); const a = document.createElement('a');
                      a.href = u; a.download = 'nexus_data_export.json'; a.click();
                    }},
                    { l: 'Clear Local Cache', desc: 'Remove all locally stored settings and policies', col: 'border-o1 text-o1', action: () => localStorage.clear() },
                    { l: 'Revoke All Sessions', desc: 'Disconnect wallet and invalidate all active sessions', col: 'border-r1 text-r1', action: () => {} },
                    { l: 'Reset to Defaults', desc: 'Restore all settings to factory defaults', col: 'border-r1 text-r1', action: () => localStorage.clear() },
                  ].map(b => (
                    <div key={b.l} className="flex items-center justify-between p-3 rounded-xl border border-border-custom hover:border-border2 transition-all">
                      <div>
                        <div className="text-[12px] font-semibold text-t1">{b.l}</div>
                        <div className="text-[10px] text-t3">{b.desc}</div>
                      </div>
                      <button onClick={b.action}
                        className={cn('px-3 py-1.5 rounded-lg border text-[11px] font-bold hover:opacity-80 transition-all', b.col)}>
                        {b.l.split(' ')[0]}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ── ABOUT ── */}
          {section === 'about' && (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.03)] p-6 text-center">
                <div className="font-display text-[42px] font-bold bg-gradient-to-r from-c1 via-p2 to-g1 bg-clip-text text-transparent pb-1">⬡ NEXUS</div>
                <div className="font-mono text-[11px] text-t3 tracking-[3px] mb-4">FINANCE OS v2.0 · AGENTIC PLATFORM</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { l: 'Version', v: 'v2.0.0' }, { l: 'Build', v: '2026.04' }, { l: 'Network', v: 'Algorand' },
                  ].map(s => (
                    <div key={s.l} className="bg-[rgba(0,0,0,0.3)] rounded-xl py-3">
                      <div className="font-mono text-[14px] font-bold text-c1">{s.v}</div>
                      <div className="text-[9px] text-t3 font-mono uppercase">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              <Card title="🤖 AI Agent Versions">
                {AGENTS.map(ag => (
                  <div key={ag.key} className="flex items-center gap-3 py-3 border-b border-border-custom last:border-none">
                    <span className="text-xl">{ag.icon}</span>
                    <div className="flex-1">
                      <div className={cn('font-bold text-[13px]', ag.color)}>{ag.name}</div>
                      <div className="text-[10px] text-t3">{ag.role}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[11px] text-t1">Gemini 2.0 Flash</div>
                      <StatusBadge status="ok" label="ACTIVE" />
                    </div>
                  </div>
                ))}
              </Card>

              <Card title="🔗 Resources & Links">
                {[
                  { l: 'AlgoBharat Hackathon', url: 'https://algobharat.in', icon: '🏆' },
                  { l: 'Algorand Developer Portal', url: 'https://developer.algorand.org', icon: '📖' },
                  { l: 'Google AI Studio (Gemini)', url: 'https://aistudio.google.com', icon: '🤖' },
                  { l: 'Supabase Dashboard', url: 'https://supabase.com/dashboard', icon: '🗄' },
                  { l: 'Pera Wallet', url: 'https://perawallet.app', icon: '🦋' },
                  { l: 'GitHub Repository', url: '#', icon: '⭐' },
                ].map(r => (
                  <a key={r.l} href={r.url} target="_blank" rel="noreferrer"
                    className="flex items-center gap-3 py-2.5 border-b border-border-custom last:border-none hover:text-c1 transition-colors group">
                    <span className="text-base">{r.icon}</span>
                    <span className="text-[12px] text-t1 group-hover:text-c1 flex-1 transition-colors">{r.l}</span>
                    <span className="text-t3 group-hover:text-c1 transition-colors text-[11px]">↗</span>
                  </a>
                ))}
              </Card>

              <div className="text-center text-[10px] font-mono text-t3 pb-2">
                Built for AlgoBharat Hackathon · Powered by Algorand + Gemini AI · &copy; 2026 NEXUS Finance
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
