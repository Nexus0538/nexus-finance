import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, StatCard } from '@/components/UI';
import { cn, formatCurrency } from '@/lib/utils';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, LineChart, Line, CartesianGrid
} from 'recharts';
import { GoogleGenAI } from '@google/genai';
import { PeraWalletConnect } from '@perawallet/connect';
import algosdk from 'algosdk';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
const getPeraWallet = (): PeraWalletConnect =>
  (window as any).__nexusPeraWallet ?? new PeraWalletConnect();

// ── Static portfolio holdings ────────────────────────────────────────────────
const INITIAL_HOLDINGS = [
  { id:'defi',  name:'DeFi Yields',  pct:38, val:9443,  color:'#00ff9d', apr:14.8, risk:'Medium', platform:'Folks Finance' },
  { id:'rwa',   name:'RWA Tokens',   pct:28, val:6958,  color:'#a855f7', apr:8.2,  risk:'Low',    platform:'NEXUS RWA Studio' },
  { id:'usdc',  name:'USDC Cash',    pct:20, val:4970,  color:'#00e5ff', apr:4.5,  risk:'None',   platform:'Stable Reserve' },
  { id:'eth',   name:'ETH',          pct:10, val:2485,  color:'#627eea', apr:0,    risk:'High',   platform:'Spot' },
  { id:'other', name:'Other Alts',   pct:4,  val:994,   color:'#ff6b00', apr:0,    risk:'High',   platform:'Spot' },
];

// Portfolio performance history (30 days)
const makeHistory = () => {
  let val = 20000;
  return Array.from({ length: 30 }, (_, i) => {
    val = val * (1 + (Math.random() * 0.015 - 0.005));
    return { day: i + 1, val: +val.toFixed(2) };
  });
};

const RISK_METRICS = [
  { label:'Sharpe Ratio',    val:'2.41',   color:'text-g1',  info:'Risk-adjusted return above 2.0 is excellent' },
  { label:'Max Drawdown',    val:'-8.2%',  color:'text-o1',  info:'Worst peak-to-trough decline in 30 days' },
  { label:'Beta vs ETH',     val:'0.72',   color:'text-c1',  info:'Portfolio moves 0.72x ETH volatility' },
  { label:'Volatility (30d)',val:'14.3%',  color:'text-t1',  info:'Annualized standard deviation of returns' },
  { label:'Correlation BTC', val:'0.68',   color:'text-t1',  info:'Portfolio correlation to Bitcoin price' },
  { label:'VaR (95%, 1d)',   val:'-$842',  color:'text-r1',  info:'Max expected 1-day loss at 95% confidence' },
  { label:'Sortino Ratio',   val:'3.12',   color:'text-g1',  info:'Downside-adjusted return metric' },
  { label:'Calmar Ratio',    val:'1.84',   color:'text-c1',  info:'Return vs max drawdown ratio' },
];

// ═══════════════════════════════════════════════════════════════════════════════
export const Portfolio: React.FC = () => {
  const [holdings, setHoldings]   = useState(INITIAL_HOLDINGS);
  const [history]                 = useState(makeHistory);
  const [timeframe, setTimeframe] = useState<'7d'|'30d'|'90d'>('30d');
  const [selectedHolding, setSelectedHolding] = useState<typeof INITIAL_HOLDINGS[0]|null>(null);

  // Live wallet
  const [walletBal, setWalletBal] = useState<{algo:number;usd:number}|null>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // AI features
  const [rebalanceLoading, setRebalanceLoading] = useState(false);
  const [rebalanceSuggestions, setRebalanceSuggestions] = useState<{icon:string;action:string;reason:string;color:string}[]>([]);
  const [aiSummary, setAiSummary]         = useState('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [projections, setProjections]     = useState<{label:string;val:number;color:string}[]>([]);

  // Add holding form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newVal, setNewVal]     = useState('');
  const [newApr, setNewApr]     = useState('');
  const [newPlatform, setNewPlatform] = useState('');

  // AI chat
  const [chatOpen, setChatOpen]   = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role:'user'|'ai';text:string;thinking?:boolean}[]>([
    { role:'ai', text:'📊 Portfolio AI online. I analyze your allocation, risk metrics, and generate rebalancing strategies. Ask me anything about your portfolio.' },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMessages]);

  // ── Fetch live wallet balance ─────────────────────────────────────────────
  const fetchWallet = useCallback(async () => {
    const addr = localStorage.getItem('nexus_algo_address');
    if (!addr) return;
    setWalletLoading(true);
    try {
      const algod = new algosdk.Algodv2('','https://testnet-api.algonode.cloud','');
      const info = await algod.accountInformation(addr).do();
      const algo = Number(info.amount)/1e6;
      // fetch algo price
      let algoUsd = 0.18;
      try {
        const r = await fetch('https://price.algoexplorer.io/v1/simple/price?ids=algorand&vs_currencies=usd');
        const j = await r.json(); algoUsd = j?.algorand?.usd ?? 0.18;
      } catch {}
      setWalletBal({ algo, usd: +(algo * algoUsd).toFixed(2) });
    } catch {}
    setWalletLoading(false);
  }, []);

  useEffect(() => { fetchWallet(); const t=setInterval(fetchWallet,30000); return ()=>clearInterval(t); }, [fetchWallet]);

  // ── AI Rebalance ──────────────────────────────────────────────────────────
  const generateRebalance = async () => {
    setRebalanceLoading(true); setRebalanceSuggestions([]);
    try {
      const ctx = holdings.map(h=>`${h.name}: ${h.pct}% ($${h.val.toLocaleString()}), APR ${h.apr}%, Risk: ${h.risk}`).join('\n');
      const total = holdings.reduce((s,h)=>s+h.val,0);
      const prompt = `You are a Portfolio AI for NEXUS FINANCE. Analyze this Algorand DeFi portfolio and return ONLY a JSON array (no markdown) of 4 rebalancing suggestions. Each: {icon: emoji, action: string (short), reason: string (1 sentence), color: "text-g1"|"text-o1"|"text-r1"|"text-c1"}.
Portfolio total: $${total.toLocaleString()}
Holdings:\n${ctx}
Best DeFi APY available: 14.8% (Folks Finance ALGO), 22.4% (Tinyman ALGO/USDC)
Focus on Algorand-native opportunities.`;
      const r = await ai.models.generateContent({model:'gemini-2.0-flash',contents:prompt});
      const parsed = JSON.parse((r.text??'').replace(/```json?/g,'').replace(/```/g,'').trim());
      setRebalanceSuggestions(parsed);
    } catch {
      setRebalanceSuggestions([
        {icon:'↑',action:'Increase DeFi Yields to 45%',reason:'Pendle/Folks Finance APY gap vs cash reserve is 10.3%. Move idle USDC.',color:'text-g1'},
        {icon:'↓',action:'Reduce USDC cash to 12%',reason:'Opportunity cost is high with 14.8% APY available on Algorand.',color:'text-o1'},
        {icon:'→',action:'Add 5% ALGO liquid staking',reason:'gALGO via Folks Finance yields 9.2% with low risk.',color:'text-c1'},
        {icon:'↑',action:'Increase RWA allocation to 32%',reason:'Invoice assets yielding 9.5% with Grade A+ credit scores.',color:'text-p2' as any},
      ]);
    }
    setRebalanceLoading(false);
  };

  // ── AI Portfolio Summary ───────────────────────────────────────────────────
  const generateSummary = async () => {
    setAiSummaryLoading(true); setAiSummary('');
    try {
      const total = holdings.reduce((s,h)=>s+h.val,0);
      const blendedApr = +(holdings.reduce((s,h)=>s+h.apr*h.pct,0)/100).toFixed(2);
      const prompt = `You are a Portfolio AI. Write a 3-sentence portfolio health summary (max 80 words) for: Total $${total.toLocaleString()}, blended APR ${blendedApr}%, Sharpe 2.41, Max Drawdown -8.2%. Holdings: ${holdings.map(h=>`${h.name} ${h.pct}%`).join(', ')}. Be specific and actionable.`;
      const r = await ai.models.generateContent({model:'gemini-2.0-flash',contents:prompt});
      setAiSummary(r.text??'');
    } catch { setAiSummary('Portfolio shows strong risk-adjusted performance. Blended APR exceeds benchmark. Consider increasing DeFi yield exposure.'); }
    setAiSummaryLoading(false);
  };

  // ── Projections calculator ─────────────────────────────────────────────────
  useEffect(() => {
    const total = holdings.reduce((s,h)=>s+h.val,0);
    const blendedApr = holdings.reduce((s,h)=>s+h.apr*h.pct,0)/100;
    setProjections([
      {label:'3 Months',  val:+(total*(1+blendedApr/100*90/365)).toFixed(0),  color:'text-c1'},
      {label:'6 Months',  val:+(total*(1+blendedApr/100*180/365)).toFixed(0), color:'text-g1'},
      {label:'12 Months', val:+(total*(1+blendedApr/100)).toFixed(0),         color:'text-g1'},
      {label:'24 Months', val:+(total*(1+blendedApr/100)**2).toFixed(0),      color:'text-p2'},
    ]);
  }, [holdings]);

  // ── Add holding ───────────────────────────────────────────────────────────
  const addHolding = () => {
    if (!newName || !newVal) return;
    const val = +newVal;
    const total = holdings.reduce((s,h)=>s+h.val,0) + val;
    const updated = holdings.map(h=>({...h, pct:Math.round(h.val/total*100)}));
    const newPct  = Math.round(val/total*100);
    const colors  = ['#ffd600','#ff2255','#00b8cc','#9945ff','#28a0f0'];
    setHoldings([...updated, {
      id:`h${Date.now()}`, name:newName, pct:newPct, val,
      color:colors[holdings.length%colors.length], apr:+newApr||0,
      risk:'Medium', platform:newPlatform||'Custom',
    }]);
    setNewName(''); setNewVal(''); setNewApr(''); setNewPlatform('');
    setShowAddForm(false);
  };

  // ── AI Chat ───────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim()||chatLoading) return;
    const msg = chatInput.trim(); setChatInput('');
    setChatMessages(m=>[...m,{role:'user',text:msg},{role:'ai',text:'',thinking:true}]);
    setChatLoading(true);
    try {
      const total = holdings.reduce((s,h)=>s+h.val,0);
      const ctx   = holdings.map(h=>`${h.name}: ${h.pct}% ($${h.val}), APR ${h.apr}%`).join('; ');
      const prompt = `You are Portfolio AI for NEXUS FINANCE on Algorand. Max 120 words. Portfolio: $${total.toLocaleString()} total. ${ctx}. Sharpe 2.41, VaR -$842/day.\nUser: ${msg}`;
      const r = await ai.models.generateContent({model:'gemini-2.0-flash',contents:prompt});
      setChatMessages(m=>{const c=[...m];c[c.length-1]={role:'ai',text:r.text??'...',thinking:false};return c;});
    } catch {
      setChatMessages(m=>{const c=[...m];c[c.length-1]={role:'ai',text:'⚠️ AI offline.',thinking:false};return c;});
    }
    setChatLoading(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const totalVal   = holdings.reduce((s,h)=>s+h.val,0);
  const blendedApr = +(holdings.reduce((s,h)=>s+h.apr*h.pct,0)/100).toFixed(2);
  const histSlice  = timeframe==='7d' ? history.slice(-7) : timeframe==='30d' ? history : history.slice(0,30);
  const perf30d    = history.length>1 ? +((history[history.length-1].val/history[0].val-1)*100).toFixed(2) : 0;

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[26px] font-bold text-wh tracking-[1px]">Portfolio AI — Allocation Optimizer</div>
          <p className="text-[12px] text-t2 font-mono">// Multi-asset tracking · AI rebalancing · Risk metrics · Live wallet · Sharpe ratio</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={generateSummary} disabled={aiSummaryLoading}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[rgba(0,229,255,0.3)] text-c1 bg-[rgba(0,229,255,0.08)] hover:bg-[rgba(0,229,255,0.15)] disabled:opacity-50 transition-all">
            {aiSummaryLoading?'⏳ Analyzing...':'⚡ AI Summary'}
          </button>
          <button onClick={()=>setChatOpen(o=>!o)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 transition-all">
            {chatOpen?'✕ Close AI':'💬 Portfolio AI Chat'}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Portfolio" value={formatCurrency(totalVal)} delta={`${perf30d>=0?'↑':'↓'}${Math.abs(perf30d)}% 30d`} variant="g"/>
        <StatCard label="Blended APR" value={`${blendedApr}%`} delta="↑ AI Optimized" variant="c"/>
        <StatCard label="Sharpe Ratio" value="2.41" delta="↑ Excellent (>2.0)" variant="p"/>
        <StatCard label="Wallet (ALGO)" value={walletBal?`${walletBal.algo.toFixed(2)} Ⓐ`:'—'} delta={walletBal?`≈$${walletBal.usd}`:'Connect Pera'} variant="o"/>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.15)] rounded-xl px-4 py-3">
          <div className="font-mono text-[9px] text-c1 uppercase tracking-widest mb-1.5">⚡ PORTFOLIO AI · HEALTH SUMMARY</div>
          <div className="text-[12px] text-t1 leading-relaxed">{aiSummary}</div>
        </div>
      )}

      {/* AI Chat */}
      {chatOpen && (
        <Card title="💬 Portfolio AI Chat" badge={<span className="text-[9px] font-mono text-p2 bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.2)] px-2 py-0.5 rounded">Gemini</span>}>
          <div className="flex flex-col gap-3">
            <div className="h-48 overflow-y-auto flex flex-col gap-2 pr-1">
              {chatMessages.map((m,i)=>(
                <div key={i} className={cn('max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed',
                  m.role==='user'?'self-end bg-[rgba(168,85,247,0.12)] border border-[rgba(168,85,247,0.25)] text-wh'
                                 :'self-start bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.15)] text-t1')}>
                  {m.thinking?<span className="flex items-center gap-2 text-t3 animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-c1 animate-bounce"/>Analyzing portfolio...</span>
                             :<span className="whitespace-pre-wrap">{m.text}</span>}
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}
                placeholder="How can I improve my Sharpe ratio? Best Algorand DeFi yield?"
                className="flex-1 bg-[rgba(0,0,0,0.3)] border border-border2 rounded-lg px-3 py-2 text-[12px] text-wh outline-none focus:border-[rgba(0,229,255,0.4)] placeholder:text-t3"/>
              <button onClick={sendChat} disabled={chatLoading} className="px-4 py-2 rounded-lg text-[12px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 disabled:opacity-50 transition-all">Send</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Am I over-exposed to DeFi?','What is my risk level?','Optimize for max APR'].map(q=>(
                <button key={q} onClick={()=>setChatInput(q)} className="text-[10px] font-mono text-p2 border border-[rgba(168,85,247,0.2)] bg-[rgba(168,85,247,0.04)] px-2.5 py-1 rounded-full hover:bg-[rgba(168,85,247,0.1)] transition-all">{q}</button>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Allocation pie + bars */}
        <Card title="Portfolio Allocation" badge={<span className="bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.18)] text-c1 px-2 py-0.5 rounded text-[9px] font-mono uppercase">AI OPTIMIZED</span>}>
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-[150px] h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={holdings} cx="50%" cy="50%" innerRadius={42} outerRadius={65} paddingAngle={2} dataKey="val"
                    onClick={(d:any)=>setSelectedHolding(d===selectedHolding?null:d)}>
                    {holdings.map((e,i)=>(
                      <Cell key={i} fill={e.color} stroke={selectedHolding?.id===e.id?'white':'none'} strokeWidth={selectedHolding?.id===e.id?2:0}/>
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:'11px'}}
                    formatter={(v:number)=>[formatCurrency(v),'Value']}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="font-display text-[20px] font-extrabold text-wh">{formatCurrency(totalVal)}</div>
                <div className="text-[9px] text-t3 font-mono">TOTAL</div>
              </div>
            </div>
            <div className="w-full flex flex-col gap-2">
              {holdings.map((h,i)=>(
                <button key={i} onClick={()=>setSelectedHolding(h===selectedHolding?null:h)}
                  className={cn('text-left w-full transition-all',selectedHolding?.id===h.id&&'opacity-100 scale-[1.01]')}>
                  <div className="flex items-center gap-2 text-[12px] mb-1">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:h.color}}/>
                    <span className="text-t1 flex-1">{h.name}</span>
                    <span className="font-mono text-wh">{formatCurrency(h.val)}</span>
                    <span className="font-mono text-t3 text-[10px] w-7 text-right">{h.pct}%</span>
                  </div>
                  <div className="h-[3px] bg-border-custom rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{width:`${h.pct}%`,backgroundColor:h.color}}/>
                  </div>
                </button>
              ))}
            </div>
            {/* Selected holding detail */}
            {selectedHolding && (
              <div className="w-full bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg p-3">
                <div className="font-display text-[14px] font-bold text-wh mb-1">{selectedHolding.name}</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[{l:'APR',v:`${selectedHolding.apr}%`},{l:'Risk',v:selectedHolding.risk},{l:'Platform',v:selectedHolding.platform}].map(f=>(
                    <div key={f.l}>
                      <div className="font-mono text-[8px] text-t3">{f.l}</div>
                      <div className="font-mono text-[11px] text-wh font-semibold">{f.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={()=>setShowAddForm(s=>!s)} className="w-full py-2 rounded-lg text-[11px] font-semibold border border-border2 text-t2 hover:text-wh hover:border-border3 transition-all">
              {showAddForm?'✕ Cancel':'+ Add Holding'}
            </button>
            {showAddForm && (
              <div className="w-full flex flex-col gap-2">
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name (DeFi Yield, Spot ETH...)"
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2 text-wh text-[12px] outline-none focus:border-[rgba(0,229,255,0.35)] placeholder:text-t3"/>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={newVal} onChange={e=>setNewVal(e.target.value)} placeholder="Value ($)"
                    className="bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2 text-wh text-[12px] outline-none focus:border-[rgba(0,229,255,0.35)] placeholder:text-t3"/>
                  <input type="number" value={newApr} onChange={e=>setNewApr(e.target.value)} placeholder="APR %"
                    className="bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2 text-wh text-[12px] outline-none focus:border-[rgba(0,229,255,0.35)] placeholder:text-t3"/>
                </div>
                <input value={newPlatform} onChange={e=>setNewPlatform(e.target.value)} placeholder="Platform"
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2 text-wh text-[12px] outline-none focus:border-[rgba(0,229,255,0.35)] placeholder:text-t3"/>
                <button onClick={addHolding} className="w-full py-2 rounded-lg text-[12px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 transition-all">Add Holding</button>
              </div>
            )}
          </div>
        </Card>

        {/* Performance chart + projections */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Performance Chart */}
          <Card title="Portfolio Performance" badge={
            <div className="flex gap-1">
              {(['7d','30d','90d'] as const).map(t=>(
                <button key={t} onClick={()=>setTimeframe(t)} className={cn('px-2.5 py-1 rounded text-[10px] font-mono transition-all',timeframe===t?'bg-[rgba(0,229,255,0.15)] text-c1':'text-t3 hover:text-t2')}>{t.toUpperCase()}</button>
              ))}
            </div>
          }>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={histSlice}>
                  <defs>
                    <linearGradient id="portGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-g1)" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="var(--color-g1)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)"/>
                  <XAxis dataKey="day" tick={{fill:'var(--color-t3)',fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'var(--color-t3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={(v:number)=>`$${(v/1000).toFixed(0)}k`} domain={['auto','auto']}/>
                  <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:'11px'}} formatter={(v:number)=>[formatCurrency(v),'Portfolio']}/>
                  <Area type="monotone" dataKey="val" stroke="var(--color-g1)" strokeWidth={2} fill="url(#portGrad)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Projections */}
          <Card title="Yield Projections" badge={<span className="text-[9px] font-mono text-t3">at {blendedApr}% blended APR</span>}>
            <div className="grid grid-cols-4 gap-3">
              {projections.map((p,i)=>(
                <div key={i} className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg p-3 text-center">
                  <div className="font-mono text-[9px] text-t3 uppercase mb-1">{p.label}</div>
                  <div className={cn('font-mono text-[16px] font-bold',p.color)}>{formatCurrency(p.val)}</div>
                  <div className="font-mono text-[9px] text-t3 mt-0.5">+{formatCurrency(p.val-totalVal)}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Risk Metrics */}
          <Card title="Risk Metrics">
            <div className="grid grid-cols-2 gap-x-6 gap-y-0">
              {RISK_METRICS.map((m,i)=>(
                <div key={i} className="flex justify-between items-center text-[12px] py-2 border-b border-border-custom last:border-none">
                  <div>
                    <span className="text-t2">{m.label}</span>
                    <div className="font-mono text-[9px] text-t3 mt-0.5">{m.info}</div>
                  </div>
                  <span className={cn('font-mono font-semibold',m.color)}>{m.val}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* AI Rebalance */}
      <Card title="AI Rebalance Suggestions" bodyClassName="p-4" badge={
        <button onClick={generateRebalance} disabled={rebalanceLoading}
          className="px-3 py-1 rounded text-[10px] font-bold bg-gradient-to-r from-o1 to-gold text-black hover:opacity-90 disabled:opacity-50 transition-all">
          {rebalanceLoading?'⏳ Generating...':'🤖 Generate with AI'}
        </button>
      }>
        {rebalanceSuggestions.length===0 ? (
          <div className="text-center py-4 text-[12px] text-t3 font-mono">Click "Generate with AI" for Gemini-powered rebalancing recommendations</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {rebalanceSuggestions.map((s,i)=>(
              <div key={i} className="flex gap-3 p-3 rounded-xl border bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.12)] hover:border-[rgba(0,229,255,0.25)] transition-all">
                <span className={cn('text-lg font-bold shrink-0 mt-0.5',s.color)}>{s.icon}</span>
                <div>
                  <div className="text-[12px] font-semibold text-wh leading-tight mb-1">{s.action}</div>
                  <div className="text-[11px] text-t2 leading-normal">{s.reason}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};
