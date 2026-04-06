import React, { useState, useEffect } from 'react';
import { Card } from '@/components/UI';
import { cn } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

interface AgentConfig {
  name: string; color: string; dotColor: string; glowColor: string; icon: string;
  enabled: boolean;
  maxTxPerDay: number; maxTxUSD: number; dailyBudgetUSD: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  allowedProtocols: string[]; allowedChains: string[];
  autoExecute: boolean; requireApprovalAbove: number;
  actions: { label: string; enabled: boolean; icon: string }[];
  txCount: number; successRate: number; lastActive: string;
  scheduleEnabled: boolean; scheduleStart: string; scheduleEnd: string;
  emergencyStop: boolean;
  threatScore: number;
  version: number;
}

const PROTOCOLS: Record<string, string[]> = {
  ARIA:  ['CoinGecko', 'DefiLlama', 'Algonode', 'Bloomberg', 'Supabase', 'Gemini', 'Alchemy'],
  DELTA: ['Folks Finance', 'Tinyman', 'Pendle', 'Vestige', 'Aave', 'Supabase', 'Gemini'],
  KAPPA: ['Wormhole', 'Chainlink CCIP', 'Messina', 'LayerZero', 'Supabase', 'Gemini'],
  SIGMA: ['Algonode ASA', 'IPFS', 'Supabase RWA', 'SEC Edgar', 'Gemini'],
};

const CHAINS = ['Algorand', 'Base', 'Polygon', 'Arbitrum', 'Ethereum', 'Avalanche'];

const RISK_CONFIG = {
  conservative: { color: 'text-g1', border: 'border-[rgba(0,255,157,0.3)]', bg: 'bg-[rgba(0,255,157,0.06)]', icon: '🛡', score: 20 },
  moderate:     { color: 'text-gold', border: 'border-[rgba(255,214,0,0.3)]', bg: 'bg-[rgba(255,214,0,0.06)]', icon: '⚖️', score: 50 },
  aggressive:   { color: 'text-r1', border: 'border-[rgba(255,34,85,0.3)]', bg: 'bg-[rgba(255,34,85,0.06)]', icon: '⚡', score: 85 },
};

const AGENT_META = [
  { color: 'text-c1', dotColor: 'bg-c1', glowColor: 'rgba(0,229,255,0.3)', borderCol: 'border-[rgba(0,229,255,0.25)]', bgCol: 'bg-[rgba(0,229,255,0.06)]' },
  { color: 'text-g1', dotColor: 'bg-g1', glowColor: 'rgba(0,255,157,0.3)', borderCol: 'border-[rgba(0,255,157,0.25)]', bgCol: 'bg-[rgba(0,255,157,0.06)]' },
  { color: 'text-p2', dotColor: 'bg-p2', glowColor: 'rgba(168,85,247,0.3)', borderCol: 'border-[rgba(168,85,247,0.25)]', bgCol: 'bg-[rgba(168,85,247,0.06)]' },
  { color: 'text-o1', dotColor: 'bg-o1', glowColor: 'rgba(255,107,0,0.3)', borderCol: 'border-[rgba(255,107,0,0.25)]', bgCol: 'bg-[rgba(255,107,0,0.06)]' },
];

const INIT: AgentConfig[] = [
  { name:'ARIA', color:'text-c1', dotColor:'bg-c1', glowColor:'rgba(0,229,255,0.3)', icon:'🤖', enabled:true,
    maxTxPerDay:200, maxTxUSD:0.01, dailyBudgetUSD:2, riskTolerance:'moderate',
    allowedProtocols:['CoinGecko','DefiLlama','Algonode'], allowedChains:['Algorand','Base'],
    autoExecute:true, requireApprovalAbove:1,
    actions:[
      {label:'Price alerts',enabled:true,icon:'📈'},{label:'Market scan',enabled:true,icon:'🔍'},
      {label:'Risk report',enabled:true,icon:'📋'},{label:'Send digest',enabled:false,icon:'📧'}
    ],
    txCount: 1847, successRate: 99.2, lastActive: '2 min ago',
    scheduleEnabled: false, scheduleStart: '09:00', scheduleEnd: '17:00',
    emergencyStop: false, threatScore: 18, version: 4 },

  { name:'DELTA', color:'text-g1', dotColor:'bg-g1', glowColor:'rgba(0,255,157,0.3)', icon:'⚡', enabled:true,
    maxTxPerDay:50, maxTxUSD:500, dailyBudgetUSD:2000, riskTolerance:'moderate',
    allowedProtocols:['Folks Finance','Tinyman','Pendle'], allowedChains:['Algorand','Arbitrum'],
    autoExecute:false, requireApprovalAbove:100,
    actions:[
      {label:'Yield harvest',enabled:true,icon:'🌾'},{label:'Auto-rebalance',enabled:false,icon:'⚖️'},
      {label:'Liquidity add',enabled:false,icon:'💧'},{label:'Protocol swap',enabled:true,icon:'🔄'}
    ],
    txCount: 234, successRate: 97.4, lastActive: '14 min ago',
    scheduleEnabled: true, scheduleStart: '08:00', scheduleEnd: '22:00',
    emergencyStop: false, threatScore: 42, version: 2 },

  { name:'KAPPA', color:'text-p2', dotColor:'bg-p2', glowColor:'rgba(168,85,247,0.3)', icon:'🌉', enabled:true,
    maxTxPerDay:20, maxTxUSD:10000, dailyBudgetUSD:50000, riskTolerance:'conservative',
    allowedProtocols:['Wormhole','Chainlink CCIP'], allowedChains:['Algorand','Base','Polygon'],
    autoExecute:false, requireApprovalAbove:500,
    actions:[
      {label:'Auto-bridge',enabled:false,icon:'🌉'},{label:'Route optimize',enabled:true,icon:'🗺'},
      {label:'Gas estimation',enabled:true,icon:'⛽'},{label:'Slippage guard',enabled:true,icon:'🛡'}
    ],
    txCount: 89, successRate: 100, lastActive: '1 hr ago',
    scheduleEnabled: false, scheduleStart: '00:00', scheduleEnd: '23:59',
    emergencyStop: false, threatScore: 12, version: 3 },

  { name:'SIGMA', color:'text-o1', dotColor:'bg-o1', glowColor:'rgba(255,107,0,0.3)', icon:'📊', enabled:true,
    maxTxPerDay:10, maxTxUSD:500000, dailyBudgetUSD:1000000, riskTolerance:'conservative',
    allowedProtocols:['Algonode ASA','IPFS','Supabase RWA'], allowedChains:['Algorand'],
    autoExecute:false, requireApprovalAbove:10000,
    actions:[
      {label:'ASA minting',enabled:true,icon:'🪙'},{label:'Credit scoring',enabled:true,icon:'📊'},
      {label:'Document verify',enabled:true,icon:'✅'},{label:'Auto-fund',enabled:false,icon:'💰'}
    ],
    txCount: 42, successRate: 100, lastActive: '3 hr ago',
    scheduleEnabled: false, scheduleStart: '09:00', scheduleEnd: '18:00',
    emergencyStop: false, threatScore: 8, version: 1 },
];

const ThreatMeter: React.FC<{ score: number }> = ({ score }) => {
  const color = score < 30 ? '#00ff9d' : score < 60 ? '#ffd600' : '#ff2255';
  const label = score < 30 ? 'LOW RISK' : score < 60 ? 'MODERATE' : 'HIGH RISK';
  const bg = score < 30 ? 'rgba(0,255,157,0.1)' : score < 60 ? 'rgba(255,214,0,0.1)' : 'rgba(255,34,85,0.1)';
  const circumference = 2 * Math.PI * 26;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" width="56" height="56" viewBox="0 0 56 56">
          <circle cx="28" cy="28" r="26" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
          <circle cx="28" cy="28" r="26" fill="none" stroke={color}
            strokeWidth="3" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease', filter: `drop-shadow(0 0 4px ${color})` }} />
        </svg>
        <span className="text-[13px] font-bold font-mono" style={{ color }}>{score}</span>
      </div>
      <div>
        <div className="text-[9px] font-mono tracking-widest text-t3 uppercase">Threat Score</div>
        <div className="text-[11px] font-bold font-mono" style={{ color }}>{label}</div>
      </div>
    </div>
  );
};

const StatBadge: React.FC<{ label: string; value: string | number; color?: string; unit?: string }> = ({ label, value, color = 'text-c1', unit }) => (
  <div className="flex flex-col gap-0.5">
    <div className="text-[9px] font-mono tracking-widest text-t3 uppercase">{label}</div>
    <div className={cn('text-[16px] font-bold font-mono', color)}>
      {value}{unit && <span className="text-[10px] text-t3 ml-0.5">{unit}</span>}
    </div>
  </div>
);

const Toggle: React.FC<{ value: boolean; onChange: () => void; color?: string; size?: 'sm' | 'md' }> = ({
  value, onChange, color = 'bg-c1', size = 'md'
}) => {
  const w = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5';
  const th = size === 'sm' ? 'w-3 h-3 top-0.5' : 'w-4 h-4 top-0.5';
  const on = size === 'sm' ? 'left-4' : 'left-5';
  return (
    <button onClick={onChange}
      className={cn('rounded-full transition-all duration-200 relative flex-shrink-0', w, value ? color : 'bg-[rgba(255,255,255,0.08)]')}>
      <div className={cn('absolute rounded-full bg-white shadow-md transition-all duration-200', th, value ? on : 'left-0.5')} />
    </button>
  );
};

export const AgentPolicy: React.FC = () => {
  const [agents, setAgents]       = useState<AgentConfig[]>(INIT);
  const [selected, setSelected]   = useState(0);
  const [aiOutput, setAiOutput]   = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [saved, setSaved]         = useState(false);
  const [tab, setTab]             = useState<'limits' | 'schedule' | 'advanced'>('limits');
  const [activityLog, setActivityLog] = useState([
    { time: '03:02', msg: 'ARIA executed price scan — 847 pairs', type: 'info' },
    { time: '02:58', msg: 'DELTA yield harvest skipped — approval required', type: 'warn' },
    { time: '02:45', msg: 'KAPPA route optimized — saved $12.40 fees', type: 'success' },
    { time: '02:31', msg: 'ARIA risk report generated', type: 'info' },
    { time: '02:10', msg: 'SIGMA ASA minting completed — TxID: 4KJ8...', type: 'success' },
  ]);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 2000);
    return () => clearInterval(t);
  }, []);

  const agent = agents[selected];
  const meta  = AGENT_META[selected];

  const update = (patch: Partial<AgentConfig>) =>
    setAgents(prev => prev.map((a, i) => i === selected ? { ...a, ...patch } : a));

  const toggleProtocol = (p: string) =>
    update({ allowedProtocols: agent.allowedProtocols.includes(p)
      ? agent.allowedProtocols.filter(x => x !== p)
      : [...agent.allowedProtocols, p] });

  const toggleChain = (c: string) =>
    update({ allowedChains: agent.allowedChains.includes(c)
      ? agent.allowedChains.filter(x => x !== c)
      : [...agent.allowedChains, c] });

  const toggleAction = (i: number) =>
    update({ actions: agent.actions.map((a, j) => j === i ? { ...a, enabled: !a.enabled } : a) });

  const analyzePolicy = async () => {
    setAiLoading(true); setAiOutput('');
    try {
      const prompt = `You are a DeFi security auditor reviewing an AI agent policy for ${agent.name}.
Threat Score: ${agent.threatScore}/100 | Risk: ${agent.riskTolerance} | Auto-execute: ${agent.autoExecute}
Max TX/day: ${agent.maxTxPerDay} | Max single TX: $${agent.maxTxUSD} | Daily budget: $${agent.dailyBudgetUSD}
Approval above: $${agent.requireApprovalAbove} | Emergency stop: ${agent.emergencyStop}
Protocols: ${agent.allowedProtocols.join(', ')} | Chains: ${agent.allowedChains.join(', ')}
Active actions: ${agent.actions.filter(a => a.enabled).map(a => a.label).join(', ')}
TX success rate: ${agent.successRate}% | Total TXs: ${agent.txCount}

Provide:
1. A 2-sentence security assessment with a risk score
2. 3 specific, actionable improvements with priority labels [HIGH/MEDIUM/LOW]
3. One compliance note for Algorand/DeFi regulations
Format with clear sections. Be concise but detailed.`;
      const r = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      setAiOutput(r.text ?? '');
      const newLog = { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), msg: `AI Security Audit completed for ${agent.name}`, type: 'info' as const };
      setActivityLog(prev => [newLog, ...prev.slice(0, 9)]);
    } catch { setAiOutput('Unable to reach Gemini. Check GEMINI_API_KEY.'); }
    setAiLoading(false);
  };

  const savePolicy = () => {
    localStorage.setItem('nexus_agent_policies', JSON.stringify(agents));
    update({ version: agent.version + 1 });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    const newLog = { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), msg: `${agent.name} policy v${agent.version + 1} saved`, type: 'success' as const };
    setActivityLog(prev => [newLog, ...prev.slice(0, 9)]);
  };

  const triggerEmergencyStop = () => {
    update({ enabled: false, emergencyStop: true, autoExecute: false });
    const newLog = { time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), msg: `🚨 EMERGENCY STOP triggered for ${agent.name}`, type: 'warn' as const };
    setActivityLog(prev => [newLog, ...prev.slice(0, 9)]);
  };

  const formatBudget = (v: number) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v.toLocaleString()}`;

  return (
    <div className="p-5 flex flex-col gap-5 min-h-full">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="font-display text-[28px] font-bold text-wh tracking-[1px]">Agent Policy Editor</div>
            <div className="px-2 py-0.5 rounded-md border border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.05)] font-mono text-[9px] text-c1 tracking-widest">
              POLICY MGMT
            </div>
          </div>
          <p className="text-[12px] text-t2 font-mono">
            // Configure spending limits · risk tolerance · protocol access · autonomous rules
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={analyzePolicy} disabled={aiLoading}
            className="px-4 py-2 rounded-xl text-[12px] font-bold bg-gradient-to-r from-c2 to-p1 text-white hover:opacity-90 hover:scale-105 disabled:opacity-60 transition-all duration-200 flex items-center gap-2 shadow-[0_0_20px_rgba(0,229,255,0.15)]">
            {aiLoading ? (
              <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/> Analyzing...</>
            ) : '🛡 AI Security Audit'}
          </button>
          <button onClick={savePolicy}
            className={cn('px-4 py-2 rounded-xl text-[12px] font-bold border transition-all duration-200 hover:scale-105',
              saved ? 'border-g1 text-g1 bg-[rgba(0,255,157,0.08)] shadow-[0_0_20px_rgba(0,255,157,0.1)]'
                    : 'border-border-custom text-t2 hover:text-wh hover:border-border3 bg-[rgba(255,255,255,0.02)]')}>
            {saved ? '✅ Saved!' : '💾 Save Policy'}
          </button>
        </div>
      </div>

      {/* Agent Selector Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((ag, i) => {
          const m = AGENT_META[i];
          const isActive = selected === i;
          return (
            <button key={ag.name} onClick={() => setSelected(i)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 group',
                isActive
                  ? `${m.borderCol} ${m.bgCol}`
                  : 'border-border-custom bg-[rgba(0,0,0,0.15)] hover:border-border2 hover:bg-[rgba(255,255,255,0.02)]'
              )}
              style={isActive ? { boxShadow: `0 0 20px ${m.glowColor}` } : {}}>
              <div className="relative flex-shrink-0">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-lg border',
                  isActive ? m.borderCol : 'border-border-custom')}>
                  {ag.icon}
                </div>
                <div className={cn('absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-bg',
                  ag.enabled ? m.dotColor : 'bg-t3', 'animate-pulse')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn('text-[13px] font-bold', isActive ? m.color : 'text-t1')}>{ag.name}</div>
                <div className="text-[10px] text-t3 font-mono truncate">
                  {ag.enabled ? (ag.emergencyStop ? '🚨 STOPPED' : `v${ag.version} · ${ag.lastActive}`) : '⏸ PAUSED'}
                </div>
              </div>
              <div className="text-[10px] font-mono text-t3 text-right">
                <div className={cn(ag.threatScore < 30 ? 'text-g1' : ag.threatScore < 60 ? 'text-gold' : 'text-r1')}>
                  {ag.threatScore}
                </div>
                <div>risk</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* AI Output */}
      {aiOutput && (
        <div className="bg-[rgba(0,229,255,0.03)] border border-[rgba(0,229,255,0.12)] rounded-2xl px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-c1 animate-pulse"/>
            <div className="font-mono text-[9px] text-c1 uppercase tracking-widest">🛡 AI Security Audit — {agent.name} · {new Date().toLocaleTimeString()}</div>
          </div>
          <div className="text-[12px] text-t1 leading-relaxed whitespace-pre-wrap scrollbar-thin overflow-y-auto max-h-48">{aiOutput}</div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">

        {/* Left: Config Panel */}
        <div className="flex flex-col gap-4">

          {/* Agent Header Card */}
          <div className={cn('rounded-2xl border p-5', meta.borderCol, meta.bgCol)}
            style={{ boxShadow: `0 0 30px ${agent.glowColor}` }}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className={cn('w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-3xl', meta.borderCol)}>
                    {agent.icon}
                  </div>
                  <div className={cn(
                    'absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-bg',
                    agent.enabled && !agent.emergencyStop ? 'bg-g1' : agent.emergencyStop ? 'bg-r1' : 'bg-t3'
                  )}>
                    <div className="w-1.5 h-1.5 rounded-full bg-black" />
                  </div>
                </div>
                <div>
                  <div className={cn('text-[22px] font-display font-bold tracking-wide', meta.color)}>{agent.name} Agent</div>
                  <div className="text-[11px] text-t3 font-mono">Policy v{agent.version} · Last active {agent.lastActive}</div>
                  {agent.emergencyStop && (
                    <div className="mt-1 px-2 py-0.5 rounded-md bg-[rgba(255,34,85,0.1)] border border-[rgba(255,34,85,0.3)] text-r1 text-[10px] font-bold font-mono inline-flex items-center gap-1">
                      🚨 EMERGENCY STOP ACTIVE
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-6">
                <ThreatMeter score={agent.threatScore} />
                <div className="flex flex-col gap-3">
                  <StatBadge label="Total TXs" value={agent.txCount.toLocaleString()} color={meta.color} />
                  <StatBadge label="Success Rate" value={`${agent.successRate}%`} color={agent.successRate > 99 ? 'text-g1' : agent.successRate > 95 ? 'text-gold' : 'text-r1'} />
                </div>
              </div>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex gap-1 p-1 bg-[rgba(0,0,0,0.3)] rounded-xl border border-border-custom w-fit">
            {(['limits', 'schedule', 'advanced'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={cn('px-4 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition-all duration-150',
                  tab === t ? 'bg-[rgba(0,229,255,0.1)] text-c1 border border-[rgba(0,229,255,0.2)]' : 'text-t3 hover:text-t2')}>
                {t === 'limits' ? '⚙️ Limits' : t === 'schedule' ? '⏰ Schedule' : '🔬 Advanced'}
              </button>
            ))}
          </div>

          {/* Tab: Limits */}
          {tab === 'limits' && (
            <Card title={`${agent.icon} ${agent.name} — Spending Limits`}>
              <div className="flex flex-col gap-5">
                {[
                  { label: 'Max TXs / Day', key: 'maxTxPerDay', unit: '', min: 1, max: 500, step: 1, format: (v: number) => v.toString() },
                  { label: 'Max Single TX (USD)', key: 'maxTxUSD', unit: '$', min: 0.001, max: 100000, step: 1, format: (v: number) => `$${v.toLocaleString()}` },
                  { label: 'Daily Budget (USD)', key: 'dailyBudgetUSD', unit: '$', min: 1, max: 1000000, step: 100, format: (v: number) => formatBudget(v) },
                  { label: 'Require Approval Above (USD)', key: 'requireApprovalAbove', unit: '$', min: 0, max: 10000, step: 10, format: (v: number) => `$${v.toLocaleString()}` },
                ].map(f => (
                  <div key={f.key}>
                    <div className="flex justify-between text-[11px] mb-2">
                      <span className="text-t2 font-mono uppercase tracking-wide text-[10px]">{f.label}</span>
                      <span className={cn('font-mono font-bold text-[13px]', meta.color)}>{f.format((agent as any)[f.key])}</span>
                    </div>
                    <div className="relative">
                      <input type="range" min={f.min} max={f.max} step={f.step} value={(agent as any)[f.key]}
                        onChange={e => update({ [f.key]: Number(e.target.value) } as any)}
                        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-cyan-400 bg-border-custom"/>
                    </div>
                  </div>
                ))}

                {/* Risk Tolerance */}
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-t3 mb-2">Risk Tolerance</div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['conservative', 'moderate', 'aggressive'] as const).map(r => {
                      const rc = RISK_CONFIG[r];
                      const isActive = agent.riskTolerance === r;
                      return (
                        <button key={r} onClick={() => update({ riskTolerance: r, threatScore: rc.score })}
                          className={cn('py-2.5 rounded-xl border text-[11px] font-bold capitalize transition-all duration-200',
                            isActive ? `${rc.color} ${rc.border} ${rc.bg}` : 'border-border-custom text-t3 hover:text-t2 hover:border-border2')}>
                          <div className="text-lg mb-0.5">{rc.icon}</div>
                          <div>{r}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex flex-col gap-3 pt-2 border-t border-border-custom">
                  {([
                    ['enabled', 'Agent Active', '🟢', 'bg-g1'],
                    ['autoExecute', 'Auto-Execute Transactions', '⚡', 'bg-c1'],
                  ] as [keyof AgentConfig, string, string, string][]).map(([k, label, icon, col]) => (
                    <div key={k} className="flex items-center justify-between group">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{icon}</span>
                        <span className="text-[12px] text-t1 font-medium">{label}</span>
                      </div>
                      <Toggle value={!!agent[k]} onChange={() => update({ [k]: !agent[k] } as any)} color={col} />
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Tab: Schedule */}
          {tab === 'schedule' && (
            <Card title="⏰ Operating Schedule">
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] text-t1 font-semibold">Enable Time-Based Execution</div>
                    <div className="text-[11px] text-t3 font-mono mt-0.5">Agent will only operate within the defined window</div>
                  </div>
                  <Toggle value={agent.scheduleEnabled} onChange={() => update({ scheduleEnabled: !agent.scheduleEnabled })} color="bg-c1" />
                </div>

                {agent.scheduleEnabled && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    {[
                      { label: 'Start Time (UTC)', key: 'scheduleStart' },
                      { label: 'End Time (UTC)', key: 'scheduleEnd' },
                    ].map(f => (
                      <div key={f.key}>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-t3 mb-1.5">{f.label}</div>
                        <input type="time" value={(agent as any)[f.key]}
                          onChange={e => update({ [f.key]: e.target.value } as any)}
                          className="w-full bg-[rgba(0,0,0,0.3)] border border-border2 rounded-lg px-3 py-2.5 text-[13px] font-mono text-c1 focus:outline-none focus:border-c1 transition-colors" />
                      </div>
                    ))}
                    <div className="col-span-2 bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.1)] rounded-xl p-3">
                      <div className="text-[10px] font-mono text-t3 mb-1 uppercase tracking-widest">Active Window</div>
                      <div className="text-[14px] font-bold text-c1 font-mono">{agent.scheduleStart} – {agent.scheduleEnd} UTC</div>
                      <div className="text-[10px] text-t3 font-mono mt-0.5">
                        {(() => {
                          const [sh, sm] = agent.scheduleStart.split(':').map(Number);
                          const [eh, em] = agent.scheduleEnd.split(':').map(Number);
                          const mins = (eh * 60 + em) - (sh * 60 + sm);
                          return mins > 0 ? `${Math.floor(mins/60)}h ${mins%60}m active window` : 'Invalid range';
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-border-custom pt-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-t3 mb-3">Execution Frequency</div>
                  <div className="grid grid-cols-4 gap-2">
                    {['Continuous', 'Hourly', 'Every 6h', 'Daily'].map(freq => (
                      <button key={freq}
                        className="py-2 rounded-lg border border-border-custom text-[10px] font-mono text-t3 hover:text-c1 hover:border-[rgba(0,229,255,0.3)] transition-all">
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tab: Advanced */}
          {tab === 'advanced' && (
            <Card title="🔬 Advanced Configuration">
              <div className="flex flex-col gap-5">
                {/* Emergency Stop */}
                <div className={cn('rounded-xl border p-4 transition-all', agent.emergencyStop
                  ? 'border-[rgba(255,34,85,0.4)] bg-[rgba(255,34,85,0.06)]'
                  : 'border-border-custom bg-[rgba(255,255,255,0.01)]')}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚨</span>
                      <div>
                        <div className="text-[13px] font-bold text-r1">Emergency Stop</div>
                        <div className="text-[10px] text-t3 font-mono">Immediately halt all agent operations</div>
                      </div>
                    </div>
                    <button onClick={triggerEmergencyStop}
                      disabled={agent.emergencyStop}
                      className={cn(
                        'px-4 py-2 rounded-lg text-[11px] font-bold border transition-all',
                        agent.emergencyStop
                          ? 'border-r1 text-r1 bg-[rgba(255,34,85,0.1)] opacity-60 cursor-not-allowed'
                          : 'border-[rgba(255,34,85,0.3)] text-r1 hover:bg-[rgba(255,34,85,0.08)] hover:border-r1'
                      )}>
                      {agent.emergencyStop ? '⏸ STOPPED' : 'Trigger Stop'}
                    </button>
                  </div>
                  {agent.emergencyStop && (
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => update({ emergencyStop: false, enabled: true })}
                        className="flex-1 py-2 rounded-lg border border-g1 text-g1 text-[11px] font-bold hover:bg-[rgba(0,255,157,0.08)] transition-all">
                        ✅ Resume Operations
                      </button>
                    </div>
                  )}
                </div>

                {/* TX Limits Advanced */}
                <div className="flex flex-col gap-3">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-t3">Gas & Fee Limits</div>
                  {[
                    { label: 'Max Gas per TX', hint: 'In microAlgos' },
                    { label: 'Max Slippage %', hint: 'For DEX operations' },
                    { label: 'Min Profit Threshold $', hint: 'Auto-execute only if profitable' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between border border-border-custom rounded-xl p-3">
                      <div>
                        <div className="text-[12px] text-t1">{item.label}</div>
                        <div className="text-[10px] text-t3 font-mono">{item.hint}</div>
                      </div>
                      <input type="number"
                        className="w-24 text-right bg-[rgba(0,0,0,0.3)] border border-border2 rounded-lg px-2 py-1.5 text-[12px] font-mono text-c1 focus:outline-none focus:border-c1 transition-colors"
                        defaultValue={i === 0 ? 2000 : i === 1 ? 0.5 : 5} step={i === 1 ? 0.1 : 1} />
                    </div>
                  ))}
                </div>

                {/* Policy Version log */}
                <div className="border-t border-border-custom pt-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-t3 mb-3">Policy Version History</div>
                  {Array.from({ length: Math.min(agent.version, 3) }, (_, i) => agent.version - i).map(v => (
                    <div key={v} className="flex items-center justify-between py-2 border-b border-border-custom last:border-none">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-1.5 h-1.5 rounded-full', v === agent.version ? 'bg-g1 animate-pulse' : 'bg-t3')} />
                        <span className="font-mono text-[11px] text-t2">v{v}</span>
                        {v === agent.version && <span className="text-[9px] font-mono text-g1 border border-g1/30 px-1 rounded">CURRENT</span>}
                      </div>
                      <span className="font-mono text-[10px] text-t3">{v === agent.version ? 'just now' : `${v * 2}h ago`}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-4">

          {/* Protocols */}
          <Card title="🔌 Allowed Protocols">
            <div className="flex flex-wrap gap-2">
              {(PROTOCOLS[agent.name] ?? []).map(p => {
                const on = agent.allowedProtocols.includes(p);
                return (
                  <button key={p} onClick={() => toggleProtocol(p)}
                    className={cn('px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all duration-150 flex items-center gap-1',
                      on ? 'border-g1 text-g1 bg-[rgba(0,255,157,0.08)] shadow-[0_0_8px_rgba(0,255,157,0.08)]'
                         : 'border-border-custom text-t3 hover:text-t2 hover:border-border2')}>
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', on ? 'bg-g1' : 'bg-t3')} />
                    {p}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 pt-2 border-t border-border-custom flex justify-between text-[10px] font-mono text-t3">
              <span>{agent.allowedProtocols.length} active</span>
              <span>{(PROTOCOLS[agent.name] ?? []).length - agent.allowedProtocols.length} disabled</span>
            </div>
          </Card>

          {/* Chains */}
          <Card title="⛓ Allowed Chains">
            <div className="grid grid-cols-2 gap-2">
              {CHAINS.map(c => {
                const on = agent.allowedChains.includes(c);
                const chainColors: Record<string, string> = {
                  Algorand: 'rgba(0,229,255,0.08)', Base: 'rgba(0,0,255,0.06)', Polygon: 'rgba(130,71,229,0.08)',
                  Arbitrum: 'rgba(40,160,240,0.08)', Ethereum: 'rgba(100,100,255,0.06)', Avalanche: 'rgba(232,65,66,0.08)'
                };
                return (
                  <button key={c} onClick={() => toggleChain(c)}
                    className={cn('px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all duration-150 flex items-center gap-2',
                      on ? 'border-c1 text-c1' : 'border-border-custom text-t3 hover:text-t2 hover:border-border2')}
                    style={on ? { background: chainColors[c] } : {}}>
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', on ? 'bg-c1' : 'bg-t3')} />
                    {c}
                    {c === 'Algorand' && <span className="ml-auto text-[8px] font-mono text-c1/60">PRIMARY</span>}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Permitted Actions */}
          <Card title="⚡ Permitted Actions">
            <div className="flex flex-col gap-1">
              {agent.actions.map((action, i) => (
                <div key={i}
                  className={cn('flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all duration-150',
                    action.enabled ? 'border-[rgba(0,229,255,0.1)] bg-[rgba(0,229,255,0.03)]' : 'border-border-custom')}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{action.icon}</span>
                    <span className={cn('text-[12px] font-medium', action.enabled ? 'text-t1' : 'text-t3')}>{action.label}</span>
                  </div>
                  <Toggle value={action.enabled} onChange={() => toggleAction(i)} color="bg-g1" size="sm" />
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border-custom text-[10px] font-mono text-t3 flex justify-between">
              <span>{agent.actions.filter(a => a.enabled).length}/{agent.actions.length} actions enabled</span>
              <span className={agent.autoExecute ? 'text-c1' : 'text-t3'}>
                {agent.autoExecute ? '⚡ Auto-execute ON' : '✋ Manual approval'}
              </span>
            </div>
          </Card>

          {/* Activity Feed */}
          <Card title="📟 Recent Activity">
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto scrollbar-hide">
              {activityLog.map((log, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2 border-b border-border-custom last:border-none">
                  <div className={cn('w-1 h-1 rounded-full mt-1.5 flex-shrink-0',
                    log.type === 'success' ? 'bg-g1' : log.type === 'warn' ? 'bg-gold' : 'bg-c1')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] text-t1 leading-snug truncate">{log.msg}</div>
                  </div>
                  <div className="text-[9px] font-mono text-t3 flex-shrink-0">{log.time}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
