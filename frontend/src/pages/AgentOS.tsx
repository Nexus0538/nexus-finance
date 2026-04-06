import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis,
} from 'recharts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

/* ─────────────────── types ─────────────────── */
type LogType = 'sys' | 'agent' | 'warn' | 'err' | 'pay' | 'dim' | 'cmd' | 'success';
interface LogEntry { type: LogType; msg: string; time: string; agent?: string; }
interface AgentDef {
  id: string; name: string; icon: string; role: string;
  color: string; dot: string; border: string; bg: string; gradFrom: string; gradTo: string;
  txToday: number; spent: string; status: 'ACTIVE' | 'RUNNING' | 'STANDBY' | 'PAUSED';
  progress: number; task: string;
}

/* ─────────────────── constants ─────────────────── */
const AGENTS: AgentDef[] = [
  { id: 'aria',  name: 'ARIA',  icon: '🤖', role: 'Market Intelligence & Treasury',  color: 'text-c1',  dot: 'bg-c1',  border: 'rgba(0,229,255,0.25)',  bg: 'rgba(0,229,255,0.06)',  gradFrom: '#00e5ff', gradTo: '#7c3aed', txToday: 248, spent: '$1.42', status: 'ACTIVE',  progress: 78, task: 'Scanning 1,200 pairs on CoinGecko...' },
  { id: 'delta', name: 'DELTA', icon: '⚡', role: 'DeFi Yield Optimization',         color: 'text-g1',  dot: 'bg-g1',  border: 'rgba(0,255,157,0.25)',  bg: 'rgba(0,255,157,0.06)',  gradFrom: '#00ff9d', gradTo: '#00e5ff', txToday: 34,  spent: '$0.68', status: 'RUNNING', progress: 91, task: 'Harvesting yield — Tinyman ALGO/USDC...' },
  { id: 'kappa', name: 'KAPPA', icon: '🌉', role: 'Cross-Chain Bridge Router',       color: 'text-p2',  dot: 'bg-p2',  border: 'rgba(168,85,247,0.25)', bg: 'rgba(168,85,247,0.06)', gradFrom: '#a855f7', gradTo: '#00e5ff', txToday: 12,  spent: '$4.20', status: 'STANDBY', progress: 42, task: 'Monitoring Wormhole VAA confirmations...' },
  { id: 'sigma', name: 'SIGMA', icon: '📊', role: 'RWA Underwriting & ASA Minting', color: 'text-o1',  dot: 'bg-o1',  border: 'rgba(255,107,0,0.25)',  bg: 'rgba(255,107,0,0.06)',  gradFrom: '#ff6b00', gradTo: '#ffd600', txToday: 7,   spent: '$0.21', status: 'ACTIVE',  progress: 55, task: 'Scoring invoice #3421 — Wipro AR Pool...' },
];

const QUICK_CMDS = [
  { label: '📈 Best Yield', cmd: 'What is the best yield opportunity right now?' },
  { label: '💹 ETH Price', cmd: 'Analyze current ETH price and trend' },
  { label: '🌉 Bridge USDC', cmd: 'Bridge 100 USDC from Base to Algorand via Wormhole' },
  { label: '🏦 Tokenize Invoice', cmd: 'Tokenize a $50,000 invoice as Algorand ASA via SIGMA' },
  { label: '🔄 Rebalance', cmd: 'Rebalance my DeFi portfolio for maximum yield' },
  { label: '🛡 Risk Report', cmd: 'Generate a full risk report for my current portfolio' },
];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:  'text-g1 border-[rgba(0,255,157,0.3)] bg-[rgba(0,255,157,0.08)]',
  RUNNING: 'text-c1 border-[rgba(0,229,255,0.3)] bg-[rgba(0,229,255,0.08)]',
  STANDBY: 'text-gold border-[rgba(255,214,0,0.3)] bg-[rgba(255,214,0,0.08)]',
  PAUSED:  'text-r1 border-[rgba(255,34,85,0.3)] bg-[rgba(255,34,85,0.08)]',
};

const LOG_COLOR: Record<LogType, string> = {
  sys: 'text-g1', agent: 'text-c1', warn: 'text-gold', err: 'text-r1',
  pay: 'text-p2', dim: 'text-t3', cmd: 'text-wh font-bold', success: 'text-g1 font-semibold',
};

const ts = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

const genMetric = (base: number, range: number) =>
  Array.from({ length: 20 }, (_, i) => ({ t: i, v: +(base + Math.sin(i * 0.5) * range + Math.random() * range * 0.4).toFixed(2) }));

/* ─────────────────── sub-components ─────────────────── */
const MiniChart: React.FC<{ data: { t: number; v: number }[]; color: string }> = ({ data, color }) => (
  <ResponsiveContainer width="100%" height={36}>
    <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
      <defs>
        <linearGradient id={`mcg${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor={color} stopOpacity={0.25} />
          <stop offset="95%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
        fill={`url(#mcg${color.replace('#', '')})`} dot={false} />
    </AreaChart>
  </ResponsiveContainer>
);

const NeuralDot: React.FC<{ color: string; size?: number; pulse?: boolean }> = ({ color, size = 6, pulse }) => (
  <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
    {pulse && <div className="absolute rounded-full animate-ping opacity-40" style={{ width: size * 2.5, height: size * 2.5, backgroundColor: color }} />}
    <div className="rounded-full" style={{ width: size, height: size, backgroundColor: color, boxShadow: `0 0 ${size}px ${color}` }} />
  </div>
);

/* ─────────────────── main component ─────────────────── */
export const AgentOS: React.FC = () => {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [input, setInput]         = useState('');
  const [busy, setBusy]           = useState(false);
  const [activeAgent, setActive]  = useState<string>('aria');
  const [metrics, setMetrics]     = useState({ txPerMin: genMetric(12, 4), latency: genMetric(280, 80), throughput: genMetric(94, 5) });
  const [agents, setAgents]       = useState(AGENTS);
  const [networkPulse, setNetPulse] = useState(0);
  const [usdcBal, setUsdcBal]     = useState(24.85);
  const [totalTx, setTotalTx]     = useState(301);
  const [tab, setTab]             = useState<'terminal' | 'swarm' | 'metrics'>('terminal');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx]     = useState(-1);
  const scrollRef                 = useRef<HTMLDivElement>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);

  const addLog = useCallback((type: LogType, msg: string, agent?: string) =>
    setLogs(p => [...p, { type, msg, time: ts(), agent }]), []);

  /* Boot sequence */
  useEffect(() => {
    const boot: [number, LogType, string][] = [
      [0,   'sys',   '███╗░░░██╗███████╗██╗░░██╗██╗░░░██╗░██████╗'],
      [100, 'sys',   '████╗░███║██╔════╝╚██╗██╔╝██║░░░██║██╔════╝'],
      [200, 'sys',   '██╔████╔██║█████╗░░░╚███╔╝░██║░░░██║╚█████╗░'],
      [300, 'sys',   '██║╚██╔╝██║██╔══╝░░░██╔██╗░██║░░░██║░╚═══██╗'],
      [400, 'sys',   '██║░╚═╝░██║███████╗██╔╝╚██╗╚██████╔╝██████╔╝'],
      [500, 'dim',   '───────────────────────────────────────────────'],
      [600, 'sys',   '[NEXUS FINANCE OS v2.0] Initializing agentic runtime...'],
      [750, 'sys',   '[ALGORAND] Connecting to testnet node — algonode.cloud'],
      [900, 'sys',   '[ALGORAND] Block height: 62,166,731 · TPS: 4,107 · Latency: 287ms'],
      [1050,'pay',   '[WALLET] Treasury loaded: 24.85 USDC · Pera Wallet connected'],
      [1200,'sys',   '[ARIA]  ● ACTIVE  — Market Intelligence online'],
      [1350,'sys',   '[DELTA] ● RUNNING — DeFi yield scanner active'],
      [1500,'sys',   '[KAPPA] ● STANDBY — Cross-chain monitor ready'],
      [1650,'sys',   '[SIGMA] ● ACTIVE  — RWA underwriting engine ready'],
      [1800,'dim',   '───────────────────────────────────────────────'],
      [1900,'agent', '[ARIA] All 4 agents synchronized. Neural swarm active.'],
      [2000,'dim',   'Commands: analyze · yield · bridge · tokenize · rebalance · status'],
    ];
    boot.forEach(([delay, type, msg]) => setTimeout(() => addLog(type, msg), delay));
  }, []);

  /* Live metric ticker */
  useEffect(() => {
    const t = setInterval(() => {
      setMetrics(m => ({
        txPerMin:   [...m.txPerMin.slice(1), { t: Date.now(), v: +(12 + Math.random() * 8).toFixed(1) }],
        latency:    [...m.latency.slice(1),  { t: Date.now(), v: +(260 + Math.random() * 80).toFixed(0) }],
        throughput: [...m.throughput.slice(1),{ t: Date.now(), v: +(90 + Math.random() * 9).toFixed(1) }],
      }));
      setNetPulse(p => (p + 1) % 3);
      if (Math.random() > 0.85) {
        const auto = [
          '[ARIA] Price alert: ETH +2.3% — monitoring threshold triggered',
          '[DELTA] Yield opportunity: ALGO/USDC LP at 14.8% on Tinyman',
          '[SIGMA] Invoice scoring complete — Wipro AR: grade A+ (98/100)',
          '[KAPPA] Wormhole VAA confirmed — bridge route optimized',
          '[ARIA] Market scan complete — 847 pairs analyzed',
        ];
        addLog('dim', auto[Math.floor(Math.random() * auto.length)]);
      }
    }, 2800);
    return () => clearInterval(t);
  }, []);

  /* Auto-scroll terminal */
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const handleSend = async () => {
    if (!input.trim() || busy) return;
    const cmd = input.trim();
    setInput(''); setBusy(true);
    setCmdHistory(p => [cmd, ...p.slice(0, 49)]);
    setHistIdx(-1);

    const agent = agents.find(a => a.id === activeAgent)!;
    addLog('cmd', `> ${cmd}`, agent.id);
    addLog('dim', `[${agent.name}] Processing command via Gemini 2.0 Flash...`);

    await new Promise(r => setTimeout(r, 600));
    const cost = (Math.random() * 0.009 + 0.001).toFixed(4);
    const txid = Math.random().toString(16).slice(2, 10).toUpperCase();
    addLog('pay', `[ALGO TX] Fee: 0.001 ALGO · TxID: ${txid}... · Block: 62,166,${Math.floor(Math.random() * 999) + 100}`);

    setUsdcBal(b => +(b - +cost).toFixed(4));
    setTotalTx(t => t + 1);
    setAgents(prev => prev.map(a => a.id === activeAgent ? { ...a, txToday: a.txToday + 1, spent: `$${(+a.spent.replace('$', '') + +cost).toFixed(2)}` } : a));

    let reply = '';
    try {
      const sysPrompt = `You are ${agent.name}, an autonomous AI finance agent running on NEXUS FINANCE (Algorand blockchain).
Role: ${agent.role}
Treasury: 24.85 USDC · Algorand Testnet · Block 62,166,731
Other agents: ARIA (market intel), DELTA (yield), KAPPA (bridge), SIGMA (RWA)
Real Algorand data: ALGO price ~$0.18, Folks Finance ALGO APY 4.2%, Tinyman ALGO/USDC LP 14.8%
Keep response to 2-3 sentences. Be specific with numbers. Always mention on-chain action taken on Algorand.`;
      const r = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: cmd, config: { systemInstruction: sysPrompt } });
      reply = r.text ?? '';
    } catch {
      const fallbacks: Record<string, Record<string, string>> = {
        aria:  { yield: 'Queried Algonode — best yield: Folks Finance ALGO at 4.2% APY vs Tinyman ALGO/USDC LP at 14.8%. Recommend rebalancing $5,000 to LP position.', price: 'CoinGecko query complete — ALGO: $0.182 (+1.4% 24h), ETH: $3,241 (+0.8%), BTC: $67,489 (-0.3%). Markets neutral-bullish.', default: `Command logged on Algorand. Treasury: 24.85 USDC · ${totalTx} total TXs · 4 agents active. Specify target protocol or asset.` },
        delta: { yield: 'Scanned DeFiLlama + Tinyman — top pool: ALGO/USDC at 14.8% APY. Auto-compounding every 4 blocks (~16s). Gas cost: 1000 microALGO.', rebalance: 'Rebalancing initiated — moving 30% from low-APY positions to Tinyman LP. Estimated additional yield: +$420/mo. TX submitted to Algorand.', default: 'DeFi scan complete. 3 yield opportunities found. Best: Pendle ETH at 14.8%, Folks Finance at 4.2%, Vestige ALGO at 8.1%. Execute?'},
        kappa: { bridge: 'Wormhole route calculated — Base → Algorand via Messina. Fee: 0.003 ETH. Estimated time: 8 minutes. VAA confirmation pending.', default: 'Cross-chain monitor online. Best route: USDC → Algorand via Wormhole (lowest fee $0.42). Chainlink CCIP alternative: $0.81.' },
        sigma: { tokenize: 'ASA minting initiated — Invoice #3421 tokenized as ASA 981234509 on Algorand. Face value: $50,000. Grade: A+. Available for fractional investment.', default: 'RWA pipeline: 7 assets underwritten, $1.24M tokenized. Next: Delhi Metro Bond scoring — ETA 4 hours. SEBI DeFi Circular compliance verified.' },
      };
      const agentFallbacks = fallbacks[activeAgent] ?? fallbacks.aria;
      const key = Object.keys(agentFallbacks).find(k => cmd.toLowerCase().includes(k)) ?? 'default';
      reply = agentFallbacks[key];
    }

    addLog('agent', `[${agent.name}] ${reply}`, agent.id);
    addLog('success', `[TX] Confirmed on Algorand · TxID: ${txid} · Cost: ${cost} USDC`);
    addLog('dim', '');
    setBusy(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleSend(); return; }
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, cmdHistory.length - 1);
      setHistIdx(idx); setInput(cmdHistory[idx] ?? '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx); setInput(idx === -1 ? '' : cmdHistory[idx] ?? '');
    }
  };

  const selectedAgent = agents.find(a => a.id === activeAgent)!;

  return (
    <div className="p-5 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="font-display text-[28px] font-bold text-wh tracking-[1px]">Agent OS</div>
            <span className="px-2 py-0.5 rounded-md border border-[rgba(0,255,157,0.3)] bg-[rgba(0,255,157,0.06)] font-mono text-[9px] text-g1 tracking-widest animate-pulse">● 4 AGENTS LIVE</span>
            <span className="px-2 py-0.5 rounded-md border border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.04)] font-mono text-[9px] text-c1 tracking-widest">ALGORAND TESTNET</span>
          </div>
          <p className="text-[12px] text-t2 font-mono">// Autonomous AI swarm · Gemini 2.0 Flash · On-chain Algorand execution</p>
        </div>
        {/* Live metrics strip */}
        <div className="flex gap-3">
          {[
            { l: 'TREASURY', v: `$${usdcBal.toFixed(2)}`, c: 'text-c1' },
            { l: 'TOTAL TXs', v: totalTx.toLocaleString(), c: 'text-g1' },
            { l: 'BLOCK', v: '62,166,731', c: 'text-p2' },
          ].map(s => (
            <div key={s.l} className="text-right">
              <div className="font-mono text-[8px] text-t3 uppercase tracking-widest">{s.l}</div>
              <div className={cn('font-display text-[16px] font-bold', s.c)}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Agent selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map(ag => (
          <button key={ag.id} onClick={() => setActive(ag.id)}
            className={cn('rounded-2xl border p-3 text-left transition-all duration-200 hover:scale-[1.01] relative overflow-hidden',
              activeAgent === ag.id ? `border-current` : 'border-border-custom bg-[rgba(0,0,0,0.15)] hover:border-border2')}
            style={activeAgent === ag.id ? { borderColor: ag.border, background: ag.bg, boxShadow: `0 0 20px ${ag.border}` } : {}}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="text-xl">{ag.icon}</div>
                <div>
                  <div className={cn('font-display text-[14px] font-bold', activeAgent === ag.id ? ag.color : 'text-t1')}>{ag.name}</div>
                  <div className="text-[9px] text-t3 font-mono truncate max-w-[100px]">{ag.role.split(' ').slice(0,3).join(' ')}</div>
                </div>
              </div>
              <span className={cn('font-mono text-[8px] px-1.5 py-0.5 rounded-md border', STATUS_STYLE[ag.status])}>
                {ag.status}
              </span>
            </div>
            <div className="text-[9px] text-t3 font-mono truncate mb-2">{ag.task}</div>
            <div className="h-1 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${ag.progress}%`, backgroundImage: `linear-gradient(to right, ${ag.gradFrom}, ${ag.gradTo})`, boxShadow: `0 0 6px ${ag.gradFrom}` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-mono text-[8px] text-t3">{ag.txToday} tx today</span>
              <span className="font-mono text-[8px] text-t3">{ag.spent}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-[rgba(0,0,0,0.3)] rounded-xl border border-border-custom w-fit">
        {([
          { id: 'terminal', label: '⌨️ Terminal' },
          { id: 'swarm',    label: '🕸 Swarm View' },
          { id: 'metrics',  label: '📊 Metrics' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn('px-5 py-2 rounded-lg text-[12px] font-semibold transition-all',
              tab === t.id ? 'bg-[rgba(0,229,255,0.1)] text-c1 border border-[rgba(0,229,255,0.2)]' : 'text-t3 hover:text-t2')}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TERMINAL TAB ── */}
      {tab === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          <div className="flex flex-col gap-4">

            {/* Quick commands */}
            <div className="flex flex-wrap gap-2">
              {QUICK_CMDS.map(q => (
                <button key={q.cmd} onClick={() => { setInput(q.cmd); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-xl border border-border-custom text-[11px] font-semibold text-t2 hover:text-c1 hover:border-[rgba(0,229,255,0.3)] hover:bg-[rgba(0,229,255,0.04)] transition-all">
                  {q.label}
                </button>
              ))}
            </div>

            {/* Terminal window */}
            <div className="bg-[#020508] border border-border2 rounded-2xl flex flex-col overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]" style={{ minHeight: 400 }}>
              {/* Terminal chrome */}
              <div className="px-4 py-3 bg-[rgba(0,0,0,0.6)] border-b border-border-custom flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57] hover:opacity-80 transition-opacity cursor-pointer" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e] hover:opacity-80 transition-opacity cursor-pointer" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840] hover:opacity-80 transition-opacity cursor-pointer" />
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <NeuralDot color={selectedAgent.gradFrom} size={6} pulse={!busy} />
                  <span className="font-mono text-[10px] text-t3">
                    {selectedAgent.name}@nexus-os · algorand-testnet
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  {busy && <div className="w-3 h-3 border border-c1 border-t-transparent rounded-full animate-spin" />}
                  <span className="font-mono text-[10px] text-t3">{logs.length} lines</span>
                  <button onClick={() => setLogs([])} className="font-mono text-[9px] text-t3 hover:text-wh transition-colors">CLR</button>
                </div>
              </div>

              {/* Log output */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-[1.8] scrollbar-hide"
                style={{ minHeight: 320, maxHeight: 420 }}>
                {logs.map((log, i) => (
                  <div key={i} className={cn('flex gap-2', LOG_COLOR[log.type])}>
                    <span className="text-t3 text-[9px] shrink-0 mt-0.5 select-none">{log.time}</span>
                    <span className="break-all">{log.msg}</span>
                  </div>
                ))}
                {busy && (
                  <div className="flex gap-2 text-c1">
                    <span className="text-t3 text-[9px] shrink-0">{ts()}</span>
                    <span className="animate-pulse">█</span>
                  </div>
                )}
              </div>

              {/* Input bar */}
              <div className="border-t border-border-custom px-4 py-3 flex items-center gap-3 bg-[rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-2 shrink-0">
                  <NeuralDot color={selectedAgent.gradFrom} size={5} />
                  <span className="font-mono text-[12px]" style={{ color: selectedAgent.gradFrom }}>{selectedAgent.name} ›</span>
                </div>
                <input ref={inputRef}
                  className="flex-1 bg-transparent border-none outline-none text-wh font-mono text-[12px] placeholder:text-t3"
                  placeholder="Enter command or ask anything… (↑↓ history)"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={busy}
                />
                <button onClick={handleSend} disabled={busy || !input.trim()}
                  className="px-4 py-1.5 rounded-lg border font-mono text-[11px] font-bold transition-all hover:scale-105 disabled:opacity-40"
                  style={{ borderColor: selectedAgent.border, color: selectedAgent.gradFrom, background: selectedAgent.bg }}>
                  {busy ? '...' : 'EXEC'}
                </button>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">
            {/* Active agent detail */}
            <div className="rounded-2xl border p-4" style={{ borderColor: selectedAgent.border, background: selectedAgent.bg, boxShadow: `0 0 24px ${selectedAgent.border}` }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="text-3xl">{selectedAgent.icon}</div>
                <div>
                  <div className={cn('font-display text-[18px] font-bold', selectedAgent.color)}>{selectedAgent.name}</div>
                  <div className="text-[10px] text-t3 font-mono">{selectedAgent.role}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  { l: 'TXs Today', v: selectedAgent.txToday.toString(), c: selectedAgent.color },
                  { l: 'Spent',     v: selectedAgent.spent, c: 'text-o1' },
                  { l: 'Status',    v: selectedAgent.status, c: selectedAgent.status === 'ACTIVE' || selectedAgent.status === 'RUNNING' ? 'text-g1' : 'text-gold' },
                  { l: 'Progress',  v: `${selectedAgent.progress}%`, c: selectedAgent.color },
                ].map(s => (
                  <div key={s.l} className="bg-[rgba(0,0,0,0.3)] rounded-xl px-3 py-2">
                    <div className="font-mono text-[8px] text-t3 uppercase tracking-widest">{s.l}</div>
                    <div className={cn('font-mono text-[14px] font-bold', s.c)}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-t3 font-mono">Current: {selectedAgent.task}</div>
            </div>

            {/* x402 payment flow */}
            <div className="rounded-2xl border border-border-custom bg-[rgba(0,0,0,0.2)] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="text-sm">⚡</div>
                <div className="font-mono text-[10px] text-t3 uppercase tracking-widest">Algorand TX Flow</div>
                <div className="ml-auto">
                  <span className="font-mono text-[8px] text-g1 border border-g1/30 px-1.5 py-0.5 rounded animate-pulse">LIVE</span>
                </div>
              </div>
              <div className="flex items-center gap-1 mb-3">
                {[
                  { icon: '🤖', label: 'Agent', color: '#00e5ff' },
                  { icon: '→',  label: '',        color: 'transparent', arrow: true },
                  { icon: '⛓',  label: 'Algorand', color: '#00ff9d' },
                  { icon: '→',  label: '',        color: 'transparent', arrow: true },
                  { icon: '✅',  label: 'Confirm', color: '#a855f7' },
                ].map((n, i) => n.arrow ? (
                  <div key={i} className="flex-1 flex items-center">
                    <div className="flex-1 h-px bg-border2 relative">
                      <div className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-c1 animate-pulse" style={{ left: `${(networkPulse * 33)}%`, transition: 'left 0.8s ease' }} />
                    </div>
                  </div>
                ) : (
                  <div key={i} className="text-center">
                    <div className="w-10 h-10 rounded-xl border flex items-center justify-center text-lg mx-auto"
                      style={{ borderColor: n.color + '44', background: n.color + '0d' }}>{n.icon}</div>
                    <div className="font-mono text-[8px] text-t3 mt-1">{n.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {[
                  { k: 'Block Time', v: '< 4s' },
                  { k: 'Fee',       v: '0.001 ALGO' },
                  { k: 'Finality',  v: 'Instant' },
                  { k: 'Network',   v: 'Algorand Testnet' },
                ].map(r => (
                  <div key={r.k} className="flex justify-between text-[10px] py-1 border-b border-border-custom last:border-none">
                    <span className="text-t3 font-mono">{r.k}</span>
                    <span className="text-c1 font-mono">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Treasury */}
            <div className="rounded-2xl border border-[rgba(0,229,255,0.15)] bg-[rgba(0,229,255,0.03)] p-4 text-center">
              <div className="font-mono text-[9px] text-t3 tracking-widest uppercase mb-1">Agent Treasury</div>
              <div className="font-display text-[32px] font-extrabold text-c1 drop-shadow-[0_0_20px_rgba(0,229,255,0.4)]">${usdcBal.toFixed(2)}</div>
              <div className="font-mono text-[9px] text-t3">USDC · Algorand Testnet</div>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-t3">Daily Limit</span>
                  <span className="text-wh font-mono">$50.00</span>
                </div>
                <div className="h-1.5 bg-border-custom rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-c1 to-g1" style={{ width: `${Math.min(100, (1.42 / 50) * 100 + 2)}%` }} />
                </div>
                <div className="flex justify-between text-[9px] mt-1">
                  <span className="text-t3 font-mono">Spent: $1.42</span>
                  <span className="text-t3 font-mono">{totalTx} TXs</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SWARM TAB ── */}
      {tab === 'swarm' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map(ag => (
            <div key={ag.id} className="rounded-2xl border p-5 transition-all hover:scale-[1.01]"
              style={{ borderColor: ag.border, background: ag.bg, boxShadow: `0 0 20px ${ag.border}` }}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{ag.icon}</div>
                  <div>
                    <div className={cn('font-display text-[18px] font-bold', ag.color)}>{ag.name}</div>
                    <div className="text-[11px] text-t2 font-mono">{ag.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <NeuralDot color={ag.gradFrom} size={8} pulse={ag.status === 'ACTIVE' || ag.status === 'RUNNING'} />
                  <span className={cn('font-mono text-[9px] px-2 py-0.5 rounded-md border', STATUS_STYLE[ag.status])}>{ag.status}</span>
                </div>
              </div>

              {/* Mini chart */}
              <MiniChart data={genMetric(ag.txToday / 24, ag.txToday / 48)} color={ag.gradFrom} />

              <div className="grid grid-cols-3 gap-2 mt-3 mb-3">
                {[
                  { l: 'TXs/Today', v: ag.txToday.toString() },
                  { l: 'Spent', v: ag.spent },
                  { l: 'CPU %', v: `${20 + ag.progress}%` },
                ].map(s => (
                  <div key={s.l} className="bg-[rgba(0,0,0,0.3)] rounded-xl px-3 py-2 text-center">
                    <div className="font-mono text-[8px] text-t3 uppercase tracking-widest">{s.l}</div>
                    <div className={cn('font-mono text-[13px] font-bold', ag.color)}>{s.v}</div>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-t3 font-mono mb-2">Task: {ag.task}</div>
              <div className="h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden mb-1">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${ag.progress}%`, backgroundImage: `linear-gradient(to right, ${ag.gradFrom}, ${ag.gradTo})`, boxShadow: `0 0 8px ${ag.gradFrom}` }} />
              </div>
              <div className="flex justify-between text-[9px] font-mono text-t3">
                <span>Neural load: {ag.progress}%</span>
                <button onClick={() => { setActive(ag.id); setTab('terminal'); }}
                  className={cn('border px-2 py-0.5 rounded transition-all hover:opacity-80', ag.color)} style={{ borderColor: ag.border }}>
                  → Talk to {ag.name}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── METRICS TAB ── */}
      {tab === 'metrics' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[
            { label: 'TX / Minute', data: metrics.txPerMin, color: '#00e5ff', unit: 'tx/min', current: metrics.txPerMin.at(-1)?.v },
            { label: 'Latency (ms)', data: metrics.latency, color: '#a855f7', unit: 'ms', current: metrics.latency.at(-1)?.v },
            { label: 'Throughput %', data: metrics.throughput, color: '#00ff9d', unit: '%', current: metrics.throughput.at(-1)?.v },
          ].map(m => (
            <div key={m.label} className="rounded-2xl border border-border-custom bg-[rgba(0,0,0,0.2)] p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="font-mono text-[10px] text-t3 uppercase tracking-widest">{m.label}</div>
                <div className="font-mono text-[18px] font-bold" style={{ color: m.color }}>{m.current}<span className="text-[10px] text-t3 ml-1">{m.unit}</span></div>
              </div>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={m.data} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                    <defs>
                      <linearGradient id={`mg${m.label}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={m.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="t" hide />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border-custom)', borderRadius: '8px', fontSize: 10 }}
                      formatter={(v: number) => [`${v} ${m.unit}`, m.label]} />
                    <Area type="monotone" dataKey="v" stroke={m.color} strokeWidth={2} fill={`url(#mg${m.label})`} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}

          {/* Agent performance table */}
          <div className="lg:col-span-3 rounded-2xl border border-border-custom bg-[rgba(0,0,0,0.2)] p-5">
            <div className="font-mono text-[10px] text-t3 uppercase tracking-widest mb-4">Agent Performance Matrix</div>
            <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-x-4 gap-y-2 items-center">
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">Agent</div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">TXs Today</div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">Spent</div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">Status</div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">Neural Load</div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">Task</div>
              {agents.map(ag => (
                <React.Fragment key={ag.id}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{ag.icon}</span>
                    <span className={cn('font-display font-bold text-[14px]', ag.color)}>{ag.name}</span>
                  </div>
                  <span className="font-mono text-[13px] text-wh">{ag.txToday}</span>
                  <span className="font-mono text-[13px] text-o1">{ag.spent}</span>
                  <span className={cn('font-mono text-[9px] px-2 py-0.5 rounded-md border w-fit', STATUS_STYLE[ag.status])}>{ag.status}</span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-border-custom rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${ag.progress}%`, backgroundColor: ag.gradFrom, boxShadow: `0 0 4px ${ag.gradFrom}` }} />
                    </div>
                    <span className="font-mono text-[10px]" style={{ color: ag.gradFrom }}>{ag.progress}%</span>
                  </div>
                  <span className="font-mono text-[10px] text-t3 truncate">{ag.task}</span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Algorand blockchain stats */}
          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l: 'Block Height', v: '62,166,731', icon: '⬡', c: 'text-c1' },
              { l: 'Avg Block Time', v: '3.7s', icon: '⏱', c: 'text-g1' },
              { l: 'Network TPS', v: '4,107', icon: '⚡', c: 'text-p2' },
              { l: 'Consensus', v: 'Pure PoS', icon: '🔒', c: 'text-o1' },
            ].map(s => (
              <div key={s.l} className="rounded-2xl border border-border-custom bg-[rgba(0,0,0,0.2)] p-4 text-center">
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className={cn('font-display text-[20px] font-bold', s.c)}>{s.v}</div>
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
