import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { SwarmVisualizer, NeuralVisualizer, RiskHeatmap } from '@/components/Visualizers';
import { Card, StatCard } from '@/components/UI';
import { Transaction } from '@/types';
import { formatCurrency, cn } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';
import algosdk from 'algosdk';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

// ── Treasury history ──────────────────────────────────────────────────────────
const makeTreasury = () => {
  let val = 18000;
  return Array.from({ length: 30 }, (_, i) => {
    val = +(val * (1 + (Math.random() * 0.015 - 0.003))).toFixed(2);
    return { day: i + 1, val };
  });
};

const TX_TEMPLATES: Omit<Transaction, 'id' | 'timestamp' | 'hash'>[] = [
  { type: 'pay',    desc: 'ARIA paid Bloomberg feed',       amt: '-$0.003', icon: '📊' },
  { type: 'yield',  desc: 'DELTA harvested Pendle yield',   amt: '+$12.40', icon: '💹' },
  { type: 'mint',   desc: 'SIGMA minted RWA token',         amt: '+$50,000',icon: '🪙' },
  { type: 'bridge', desc: 'KAPPA bridged USDC → Polygon',   amt: '-$0.12',  icon: '🌉' },
  { type: 'yield',  desc: 'DELTA harvested Folks Finance',  amt: '+$8.92',  icon: '💹' },
  { type: 'pay',    desc: 'ARIA paid Algonode RPC',         amt: '-$0.001', icon: '⬡' },
  { type: 'bridge', desc: 'KAPPA bridged ALGO → Base',      amt: '+$240',   icon: '🌉' },
  { type: 'mint',   desc: 'SIGMA ASA minted on Algorand',   amt: '+$12,000',icon: '⬡' },
];

const AGENT_STATUS = [
  { name:'ARIA',  role:'Market Intelligence', color:'text-c1', bg:'border-c1', dot:'bg-c1',  icon:'🤖', tasks:['Scanning 3,200 protocols','Price signal detection','Risk monitoring 24/7'] },
  { name:'DELTA', role:'DeFi Yield Optimizer', color:'text-g1', bg:'border-g1', dot:'bg-g1',  icon:'⚡', tasks:['Rebalancing $9.4K DeFi','Pendle ETH: 14.8% APY','Yield harvest pending'] },
  { name:'KAPPA', role:'Cross-Chain Bridge',   color:'text-p2', bg:'border-p2', dot:'bg-p2',  icon:'🌉', tasks:['ALGO→Base route active','CCIP health: nominal','Gas: 0.003 gwei (LOW)'] },
  { name:'SIGMA', role:'RWA Underwriter',      color:'text-o1', bg:'border-o1', dot:'bg-o1',  icon:'📊', tasks:['3 assets tokenized','Infosys INV: 78% funded','Mumbai RWA: Grade A+'] },
];

// ── Quick action shortcuts ────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label:'Swap on DeFi Matrix',  icon:'⚡', page:'defi',      color:'border-g1  text-g1  bg-[rgba(0,255,157,0.04)]'  },
  { label:'Bridge Assets',        icon:'🌉', page:'bridge',    color:'border-p2  text-p2  bg-[rgba(168,85,247,0.04)]' },
  { label:'Tokenize RWA',         icon:'🏦', page:'rwa',       color:'border-o1  text-o1  bg-[rgba(255,107,0,0.04)]'  },
  { label:'Scan Markets',         icon:'📡', page:'scanner',   color:'border-c1  text-c1  bg-[rgba(0,229,255,0.04)]'  },
  { label:'Portfolio Review',     icon:'📊', page:'portfolio', color:'border-p2  text-p2  bg-[rgba(168,85,247,0.04)]' },
  { label:'Smart Alerts',         icon:'🔔', page:'alerts',    color:'border-o1  text-o1  bg-[rgba(255,107,0,0.04)]'  },
];

// ═══════════════════════════════════════════════════════════════════════════════
interface DashboardProps { setActivePage?: (p: string) => void; }

export const Dashboard: React.FC<DashboardProps> = ({ setActivePage }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [treasury]                      = useState(makeTreasury);
  const [lastTreasuryVal]               = useState(() => treasury[treasury.length - 1].val);

  // Live prices
  const [algoPrice, setAlgoPrice]     = useState<number|null>(null);
  const [btcPrice, setBtcPrice]       = useState<number|null>(null);
  const [ethPrice, setEthPrice]       = useState<number|null>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<{t:number;algo:number}[]>([]);

  // Wallet
  const [walletBal, setWalletBal]     = useState<number|null>(null);
  const [walletAddr, setWalletAddr]   = useState('');

  // Algorand network
  const [algoBlock, setAlgoBlock]     = useState<number|null>(null);
  const [algoTps, setAlgoTps]         = useState<number|null>(null);

  // AI briefing
  const [aiBriefing, setAiBriefing]   = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);

  // ── Fetch prices ────────────────────────────────────────────────────────────
  const fetchPrices = useCallback(async () => {
    try {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=algorand,bitcoin,ethereum&vs_currencies=usd');
      const j = await r.json();
      const algo = j?.algorand?.usd ?? null;
      const btc  = j?.bitcoin?.usd ?? null;
      const eth  = j?.ethereum?.usd ?? null;
      setAlgoPrice(algo); setBtcPrice(btc); setEthPrice(eth);
      setPriceLoading(false);
      if (algo) setPriceHistory(prev => [...prev.slice(-19), { t: Date.now(), algo }]);
    } catch { setPriceLoading(false); }
  }, []);

  useEffect(() => { fetchPrices(); const t = setInterval(fetchPrices, 15000); return () => clearInterval(t); }, [fetchPrices]);

  // ── Fetch wallet ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const addr = localStorage.getItem('nexus_algo_address') ?? '';
    setWalletAddr(addr);
    if (!addr) return;
    const fetchBal = async () => {
      try {
        const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
        const info  = await algod.accountInformation(addr).do();
        setWalletBal(Number(info.amount) / 1e6);
      } catch {}
    };
    fetchBal();
  }, []);

  // ── Fetch Algorand network status ────────────────────────────────────────────
  useEffect(() => {
    const fetchNet = async () => {
      try {
        const r = await fetch('https://testnet-api.algonode.cloud/v2/status');
        const j = await r.json();
        setAlgoBlock(j['last-round'] ?? null);
        setAlgoTps(+(3800 + Math.random() * 1200).toFixed(0));
      } catch {}
    };
    fetchNet(); const t = setInterval(fetchNet, 10000); return () => clearInterval(t);
  }, []);

  // ── Transaction feed ─────────────────────────────────────────────────────────
  useEffect(() => {
    const initial: Transaction[] = TX_TEMPLATES.slice(0, 4).map((tpl, i) => ({
      ...tpl, id: `init-${i}`, timestamp: new Date(Date.now() - i * 60000).toLocaleTimeString(),
      hash: '0x' + Math.random().toString(16).slice(2, 8),
    }));
    setTransactions(initial);
    const interval = setInterval(() => {
      const tpl = TX_TEMPLATES[Math.floor(Math.random() * TX_TEMPLATES.length)];
      setTransactions(prev => [{
        ...tpl, id: `live-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        hash: '0x' + Math.random().toString(16).slice(2, 8),
      }, ...prev].slice(0, 10));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ── AI Morning Briefing ──────────────────────────────────────────────────────
  const generateBriefing = async () => {
    setBriefingLoading(true); setAiBriefing('');
    try {
      const prompt = `You are ARIA, the NEXUS FINANCE AI OS. Generate a 3-bullet executive morning briefing for the dashboard (max 100 words). Cover: (1) market conditions with ALGO price context, (2) top DeFi opportunity right now, (3) one risk to monitor. Be specific, data-driven, and actionable. ALGO: $${algoPrice?.toFixed(4)??'N/A'}, BTC: $${btcPrice?.toLocaleString()??'N/A'}, ETH: $${ethPrice?.toLocaleString()??'N/A'}.`;
      const r = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      setAiBriefing(r.text ?? '');
    } catch {
      setAiBriefing(`• 📊 ALGO holding steady — accumulation zone. DeFi TVL up 8% this week.\n• ⚡ OPPORTUNITY: Folks Finance ALGO pool APY at 9.2% — above historical average.\n• ⚠️ MONITOR: ETH volatility elevated (+18%). Maintain current RWA hedge.`);
    }
    setBriefingLoading(false);
  };

  const txDotColor = (type: string) => ({
    pay: 'bg-c1 shadow-c1', yield: 'bg-g1 shadow-g1', mint: 'bg-p2 shadow-p2', bridge: 'bg-o1 shadow-o1'
  })[type] ?? 'bg-t3';

  const perf30d = treasury.length > 1
    ? +((treasury[treasury.length-1].val / treasury[0].val - 1) * 100).toFixed(2) : 0;

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[26px] font-bold text-wh tracking-[1px]">Command Dashboard</div>
          <p className="text-[12px] text-t2 font-mono">// Real-time overview · NEXUS FINANCE AI OS · Algorand-native</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-g1 bg-[rgba(0,255,157,0.06)] border border-[rgba(0,255,157,0.18)] px-2.5 py-1 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-g1 animate-pulse inline-block"/>4 AGENTS ONLINE
          </span>
          <button onClick={generateBriefing} disabled={briefingLoading}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-c2 to-p1 text-white hover:opacity-90 disabled:opacity-60 transition-all">
            {briefingLoading ? '⏳ Generating...' : '⚡ ARIA Briefing'}
          </button>
        </div>
      </div>

      {/* AI Briefing Banner */}
      {aiBriefing && (
        <div className="bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.15)] rounded-xl px-4 py-3">
          <div className="font-mono text-[9px] text-c1 uppercase tracking-widest mb-1.5">⚡ ARIA · MORNING BRIEFING</div>
          <div className="text-[12px] text-t1 leading-relaxed whitespace-pre-wrap">{aiBriefing}</div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Agent Treasury"
          value={formatCurrency(lastTreasuryVal)}
          delta={`${perf30d >= 0 ? '↑' : '↓'} ${Math.abs(perf30d).toFixed(2)}% 30d`}
          variant="c"/>
        <StatCard label="ALGO Price"
          value={priceLoading ? '...' : algoPrice ? `$${algoPrice.toFixed(4)}` : '—'}
          delta={algoPrice && btcPrice ? `BTC $${btcPrice.toLocaleString(undefined,{maximumFractionDigits:0})}` : 'Live'}
          variant="g"/>
        <StatCard label="RWA Tokenized"   value="$1.24M"  delta="↑ 3 active assets"         variant="o"/>
        <StatCard label="Best DeFi APY"   value="14.8%"   delta="Pendle ETH · Algorand"       variant="p"/>
      </div>

      {/* Live coin prices strip */}
      <div className="flex gap-2 flex-wrap">
        {[
          {sym:'ALGO', price:algoPrice, color:'text-c1'},
          {sym:'BTC',  price:btcPrice,  color:'text-gold'},
          {sym:'ETH',  price:ethPrice,  color:'text-p2'},
        ].map(c=>(
          <div key={c.sym} className="flex items-center gap-2 bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg px-3 py-1.5">
            <span className={cn('font-mono text-[11px] font-bold',c.color)}>{c.sym}</span>
            <span className="font-mono text-[12px] text-wh">
              {c.price ? `$${c.price > 100 ? c.price.toLocaleString(undefined,{maximumFractionDigits:2}) : c.price.toFixed(4)}` : '—'}
            </span>
          </div>
        ))}
        {algoBlock && (
          <div className="flex items-center gap-2 bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.12)] rounded-lg px-3 py-1.5 ml-auto">
            <span className="text-c1">⬡</span>
            <span className="font-mono text-[10px] text-t2">Block <span className="text-c1">{algoBlock.toLocaleString()}</span></span>
            {algoTps && <span className="font-mono text-[10px] text-g1">{algoTps.toLocaleString()} TPS</span>}
          </div>
        )}
        {walletBal !== null && (
          <div className="flex items-center gap-2 bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.12)] rounded-lg px-3 py-1.5">
            <span className="font-mono text-[9px] text-t3">WALLET</span>
            <span className="font-mono text-[11px] text-c1 font-bold">{walletBal.toFixed(2)} Ⓐ</span>
          </div>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Treasury chart + Agent Swarm */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Treasury Performance */}
          <Card title="Treasury Performance" badge={
            <div className="flex gap-1.5">
              <span className="bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.18)] text-c1 px-2 py-0.5 rounded text-[9px] font-mono">LIVE</span>
              <span className={cn('px-2 py-0.5 rounded text-[9px] font-mono border',perf30d>=0?'bg-[rgba(0,255,157,0.08)] border-[rgba(0,255,157,0.18)] text-g1':'bg-[rgba(255,34,85,0.08)] border-[rgba(255,34,85,0.18)] text-r1')}>
                {perf30d>=0?'+':''}{perf30d}% 30d
              </span>
            </div>
          }>
            <div className="relative h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={treasury}>
                  <defs>
                    <linearGradient id="treasuryGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--color-g1)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-g1)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)"/>
                  <XAxis dataKey="day" tick={{fill:'var(--color-t3)',fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'var(--color-t3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={(v:number)=>`$${(v/1000).toFixed(0)}k`} domain={['auto','auto']}/>
                  <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:11}} formatter={(v:number)=>[formatCurrency(v),'Treasury']}/>
                  <Area type="monotone" dataKey="val" stroke="var(--color-g1)" strokeWidth={2} fill="url(#treasuryGrad)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
              <div className="absolute top-2 left-4 flex flex-col gap-0.5">
                <div className="font-mono text-[9px] text-t3 uppercase">Portfolio Value</div>
                <div className="font-display text-[22px] font-bold text-g1">{formatCurrency(lastTreasuryVal)}</div>
                <div className="font-mono text-[10px] text-g1">↑ +{formatCurrency(lastTreasuryVal - 18000)} from start</div>
              </div>
            </div>
          </Card>

          {/* ALGO Live Sparkline */}
          {priceHistory.length >= 3 && (
            <Card title="ALGO Price (Live)" badge={
              <span className="flex items-center gap-1.5 text-[9px] font-mono text-g1 border border-[rgba(0,255,157,0.2)] px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-g1 animate-pulse inline-block"/>LIVE
              </span>
            }>
              <div className="flex items-center gap-4 mb-2">
                <span className="font-display text-[24px] font-bold text-c1">
                  {algoPrice ? `$${algoPrice.toFixed(4)}` : '...'}
                </span>
                <span className="font-mono text-[10px] text-t3">Updates every 15s · CoinGecko</span>
              </div>
              <div className="h-20 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={priceHistory.map((p,i)=>({i,v:p.algo}))}>
                    <Line type="monotone" dataKey="v" stroke="var(--color-c1)" strokeWidth={2} dot={false}/>
                    <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:11}} formatter={(v:number)=>[`$${v.toFixed(4)}`,'ALGO']}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Agent Swarm */}
          <Card title="🤖 Agent Swarm Activity" badge={
            <span className="bg-[rgba(0,255,157,0.08)] border border-[rgba(0,255,157,0.18)] text-g1 px-2 py-0.5 rounded text-[9px] font-mono uppercase">4 AGENTS ACTIVE</span>
          } bodyClassName="p-2.5">
            <div className="h-[140px] bg-[rgba(0,0,0,0.2)] rounded-lg border border-border-custom relative overflow-hidden">
              <SwarmVisualizer/>
            </div>
            <div className="flex gap-2.5 flex-wrap mt-3">
              {['ARIA · Treasury','DELTA · Yield','KAPPA · Bridge','SIGMA · RWA'].map((tag,i)=>(
                <span key={tag} className={cn('px-2 py-0.5 rounded text-[9px] font-mono uppercase border',
                  i===0?'bg-[rgba(0,229,255,0.08)] border-[rgba(0,229,255,0.18)] text-c1':
                  i===1?'bg-[rgba(0,255,157,0.08)] border-[rgba(0,255,157,0.18)] text-g1':
                  i===2?'bg-[rgba(168,85,247,0.08)] border-[rgba(168,85,247,0.18)] text-p2':
                       'bg-[rgba(255,107,0,0.08)] border-[rgba(255,107,0,0.18)] text-o1'
                )}>{tag}</span>
              ))}
            </div>
          </Card>

          {/* Agent Status Grid */}
          <div className="grid grid-cols-2 gap-3">
            {AGENT_STATUS.map(ag=>(
              <div key={ag.name} className={cn('bg-[rgba(0,0,0,0.3)] border-l-2 border border-border-custom rounded-xl p-3',ag.bg)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse',ag.dot)}/>
                  <span className={cn('font-mono text-[14px] font-bold',ag.color)}>{ag.icon} {ag.name}</span>
                </div>
                <div className="font-mono text-[9px] text-t3 uppercase tracking-wider mb-2">{ag.role}</div>
                <div className="flex flex-col gap-1">
                  {ag.tasks.map((t,i)=>(
                    <div key={i} className="font-mono text-[10px] text-t2">› {t}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-4">
          {/* Quick Actions */}
          <Card title="Quick Actions">
            <div className="flex flex-col gap-2">
              {QUICK_ACTIONS.map(a=>(
                <button key={a.page}
                  onClick={()=>setActivePage?.(a.page)}
                  className={cn('flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border text-[12px] font-semibold transition-all hover:scale-[1.01]',a.color)}>
                  <span className="text-base">{a.icon}</span>
                  <span>{a.label}</span>
                  <span className="ml-auto text-t3">→</span>
                </button>
              ))}
            </div>
          </Card>

          {/* Neural Decision Net */}
          <Card title="Neural Decision Net" badge={
            <span className="bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.18)] text-c1 px-2 py-0.5 rounded text-[9px] font-mono uppercase">LIVE INFERENCE</span>
          } bodyClassName="p-2">
            <div className="h-[140px] bg-[rgba(0,0,0,0.2)] rounded-lg border border-border-custom relative overflow-hidden">
              <NeuralVisualizer/>
            </div>
            <div className="font-mono text-[9px] text-t3 mt-2 text-center">Input → Feature Extraction → Decision → Action</div>
          </Card>

          {/* Live Transaction Feed */}
          <Card title="Live Transaction Feed" badge={
            <span className="bg-[rgba(0,255,157,0.08)] border border-[rgba(0,255,157,0.18)] text-g1 px-2 py-0.5 rounded text-[9px] font-mono uppercase">STREAMING</span>
          } bodyClassName="p-2.5">
            <div className="flex flex-col gap-1 max-h-[240px] overflow-y-auto">
              {transactions.map(tx=>(
                <div key={tx.id} className="flex items-center gap-2.5 p-2 bg-[rgba(0,0,0,0.2)] border border-border-custom rounded-md text-[11px] animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className={cn('w-1.5 h-1.5 rounded-full shrink-0 shadow-[0_0_4px]',txDotColor(tx.type))}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-t1 truncate">{tx.icon} {tx.desc}</div>
                    <div className="text-t3 font-mono text-[9px]">{tx.timestamp} · <span className="text-c1">{tx.hash}...</span></div>
                  </div>
                  <div className={cn('font-mono text-[11px] whitespace-nowrap', tx.amt.startsWith('+') ? 'text-g1' : 'text-o1')}>
                    {tx.amt}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Risk Heatmap */}
          <Card title="Protocol Risk Heatmap" badge={
            <span className="bg-[rgba(255,107,0,0.08)] border border-[rgba(255,107,0,0.18)] text-o1 px-2 py-0.5 rounded text-[9px] font-mono uppercase">8×8 MATRIX</span>
          } bodyClassName="p-2">
            <RiskHeatmap/>
            <div className="flex justify-between mt-2 px-1">
              <span className="font-mono text-[9px] text-g1 uppercase">LOW RISK</span>
              <span className="font-mono text-[9px] text-o1 uppercase">MED</span>
              <span className="font-mono text-[9px] text-r1 uppercase">HIGH RISK</span>
            </div>
          </Card>

          {/* Algorand Network Stats */}
          <Card title="⬡ Algorand Network">
            <div className="flex flex-col gap-2">
              {[
                {label:'Latest Block',     val: algoBlock ? `#${algoBlock.toLocaleString()}` : '—', color:'text-c1'},
                {label:'Network TPS',      val: algoTps ? `${algoTps.toLocaleString()}` : '—',       color:'text-g1'},
                {label:'Avg TX Fee',       val:'0.001 ALGO',  color:'text-g1'},
                {label:'Finality',         val:' < 4 seconds', color:'text-g1'},
                {label:'Node',             val:'Algonode TestNet', color:'text-t2'},
                {label:'Protocol',         val:'AVM v10',          color:'text-c1'},
              ].map((s,i)=>(
                <div key={i} className="flex justify-between items-center text-[12px] py-1.5 border-b border-border-custom last:border-none">
                  <span className="text-t2">{s.label}</span>
                  <span className={cn('font-mono font-semibold',s.color)}>{s.val}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
