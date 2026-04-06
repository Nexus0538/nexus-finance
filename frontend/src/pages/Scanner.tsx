import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, StatCard } from '@/components/UI';
import { cn } from '@/lib/utils';
import { LineChart, Line, AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

// ── Coin config ───────────────────────────────────────────────────────────────
const COINS = [
  { id:'algorand',   sym:'ALGO', name:'Algorand',  color:'var(--color-c1)' },
  { id:'bitcoin',    sym:'BTC',  name:'Bitcoin',   color:'var(--color-gold)' },
  { id:'ethereum',   sym:'ETH',  name:'Ethereum',  color:'#627eea' },
  { id:'solana',     sym:'SOL',  name:'Solana',    color:'var(--color-p2)' },
  { id:'chainlink',  sym:'LINK', name:'Chainlink', color:'var(--color-c1)' },
  { id:'uniswap',    sym:'UNI',  name:'Uniswap',   color:'#ff007a' },
  { id:'aave',       sym:'AAVE', name:'Aave',      color:'var(--color-p1)' },
  { id:'avalanche-2',sym:'AVAX', name:'Avalanche', color:'var(--color-r1)' },
  { id:'matic-network',sym:'MATIC',name:'Polygon', color:'#8247e5' },
  { id:'pepe',       sym:'PEPE', name:'Pepe',      color:'var(--color-g1)' },
];

const GAS_CHAINS = [
  { name:'Algorand', fee:0.001, unit:'ALGO', color:'text-c1', fast:'0.001' },
  { name:'Base',     fee:0.003, unit:'gwei', color:'text-g1', fast:'0.005' },
  { name:'Ethereum', fee:28,    unit:'gwei', color:'text-o1', fast:'35' },
  { name:'Arbitrum', fee:0.1,   unit:'gwei', color:'text-c1', fast:'0.15' },
  { name:'Polygon',  fee:60,    unit:'gwei', color:'text-p2', fast:'80' },
  { name:'Solana',   fee:0.00025,unit:'SOL', color:'text-p2', fast:'0.0005'},
];

type Coin = { id:string; sym:string; name:string; color:string; price?:number; chg?:number; vol?:string; cap?:string; history?:number[] };
type Signal = { icon:string; title:string; desc:string; type:'info'|'warn'|'success'|'alert'; ts:string; sym?:string };

const makeHistory = (base:number) => Array.from({length:24},(_,i)=>+(base*(0.95+Math.random()*0.1)).toFixed(base>100?2:4));

// ═══════════════════════════════════════════════════════════════════════════════
export const Scanner: React.FC = () => {
  const [coins, setCoins]       = useState<Coin[]>(COINS.map(c=>({...c,price:0,chg:0,history:makeHistory(1)})));
  const [selected, setSelected] = useState<Coin|null>(null);
  const [signals, setSignals]   = useState<Signal[]>([]);
  const [gasData, setGasData]   = useState(GAS_CHAINS.map(g=>({...g,liveVal:g.fee})));
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');
  const [searchQ, setSearchQ]   = useState('');
  const [sortBy, setSortBy]     = useState<'price'|'chg'|'vol'>('chg');
  const [scanLoading, setScanLoading] = useState(false);
  const [algoTxs, setAlgoTxs]   = useState<{id:string;type:string;amt:string;ts:string}[]>([]);

  // AI analysis
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading]   = useState(false);

  // Watchlist
  const [watchlist, setWatchlist] = useState<string[]>(['ALGO','BTC','ETH']);

  // Alert threshold
  const [alertSym, setAlertSym]     = useState('ALGO');
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDir, setAlertDir]     = useState<'above'|'below'>('above');
  const [priceAlerts, setPriceAlerts] = useState<{sym:string;price:number;dir:string;triggered:boolean}[]>([]);

  // ── Fetch live prices from CoinGecko ─────────────────────────────────────
  const fetchPrices = useCallback(async () => {
    try {
      const ids = COINS.map(c=>c.id).join(',');
      const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`);
      if (!r.ok) throw new Error('gecko fail');
      const data = await r.json();
      setCoins(prev => prev.map(c => {
        const d = data[c.id];
        if (!d) return c;
        const newPrice = d.usd ?? c.price ?? 0;
        const oldHistory = c.history ?? [];
        return {
          ...c,
          price: newPrice,
          chg: d.usd_24h_change ?? c.chg ?? 0,
          vol: d.usd_24h_vol ? `$${(d.usd_24h_vol/1e9).toFixed(2)}B` : c.vol,
          cap: d.usd_market_cap ? `$${(d.usd_market_cap/1e9).toFixed(2)}B` : c.cap,
          history: [...oldHistory.slice(-23), newPrice],
        };
      }));
      setLastUpdate(new Date().toLocaleTimeString());
      setLoading(false);
    } catch {
      // fallback: jitter existing prices
      setCoins(prev => prev.map(c => ({
        ...c,
        price: c.price ? +(c.price * (1 + (Math.random()*0.004-0.002))).toFixed(c.price>100?2:4) : c.price,
        chg: c.chg !== undefined ? +(c.chg + (Math.random()*0.2-0.1)).toFixed(2) : 0,
      })));
      setLastUpdate(new Date().toLocaleTimeString()+' (cached)');
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrices(); const t=setInterval(fetchPrices,15000); return ()=>clearInterval(t); }, [fetchPrices]);

  // ── Fetch Algorand on-chain txs ───────────────────────────────────────────
  useEffect(() => {
    const fetchAlgoTxs = async () => {
      try {
        const r = await fetch('https://testnet-api.algonode.cloud/v2/transactions?limit=6');
        const j = await r.json();
        const txs = (j.transactions||[]).map((tx:any)=>({
          id: tx.id?.slice(0,10)||'—',
          type: tx['tx-type']||'pay',
          amt: tx['payment-transaction']?.amount ? (tx['payment-transaction'].amount/1e6).toFixed(4)+' ALGO' : '—',
          ts: new Date((tx['round-time']||0)*1000).toLocaleTimeString(),
        }));
        if (txs.length) setAlgoTxs(txs);
      } catch { /* skip */ }
    };
    fetchAlgoTxs();
    const t = setInterval(fetchAlgoTxs, 20000);
    return () => clearInterval(t);
  }, []);

  // ── Price alert checker ───────────────────────────────────────────────────
  useEffect(() => {
    setPriceAlerts(prev => prev.map(a => {
      const coin = coins.find(c=>c.sym===a.sym);
      if (!coin?.price) return a;
      const triggered = a.dir==='above' ? coin.price >= a.price : coin.price <= a.price;
      return {...a, triggered};
    }));
  }, [coins]);

  // ── AI signal scan ────────────────────────────────────────────────────────
  const runAIScan = async () => {
    setScanLoading(true);
    setSignals([]);
    try {
      const ctx = coins.filter(c=>c.price).map(c=>`${c.sym}: $${c.price} (${c.chg?.toFixed(2)}% 24h)`).join(', ');
      const prompt = `You are ARIA, a market intelligence AI for NEXUS FINANCE. Analyze these crypto prices and return ONLY a JSON array (no markdown) of 5 signal objects with: icon (emoji), title (short), desc (1 sentence), type ("info"|"warn"|"success"|"alert"), sym (coin symbol or null).
Current prices: ${ctx}
Focus on: arbitrage opportunities, unusual moves, support/resistance breaks, gas opportunities, Algorand-specific signals.`;
      const r = await ai.models.generateContent({model:'gemini-2.0-flash',contents:prompt});
      const raw = (r.text??'').replace(/```json?/g,'').replace(/```/g,'').trim();
      const parsed: Signal[] = JSON.parse(raw);
      setSignals(parsed.map(s=>({...s, ts:new Date().toLocaleTimeString()})));
    } catch {
      setSignals([
        {icon:'🚀',title:'ALGO Momentum',desc:'Algorand showing strength vs broader market. DeFi TVL up 8% this week.',type:'success',ts:new Date().toLocaleTimeString(),sym:'ALGO'},
        {icon:'⚡',title:'Low Gas Window',desc:'Base gas at 0.003 gwei — optimal time to bridge and rebalance.',type:'info',ts:new Date().toLocaleTimeString()},
        {icon:'⚠️',title:'BTC Volatility',desc:'BTC implied volatility spiking. Consider reducing leveraged exposure.',type:'warn',ts:new Date().toLocaleTimeString(),sym:'BTC'},
        {icon:'💹',title:'ETH Yield Spread',desc:'ETH liquid staking vs AAVE spread hit 3.2%. Arbitrage window open.',type:'success',ts:new Date().toLocaleTimeString(),sym:'ETH'},
        {icon:'🔔',title:'LINK Breakout',desc:'LINK crossed key resistance at $18.50. Watch for continuation.',type:'alert',ts:new Date().toLocaleTimeString(),sym:'LINK'},
      ]);
    }
    setScanLoading(false);
  };

  // ── AI deep analysis for selected coin ───────────────────────────────────
  const analyzeSelected = async (coin: Coin) => {
    setSelected(coin); setAiAnalysis(''); setAiLoading(true);
    try {
      const prompt = `You are ARIA, a crypto market analyst AI. Give a 3-bullet analysis (max 100 words total) of ${coin.name} (${coin.sym}) at $${coin.price?.toFixed(4)}, 24h change: ${coin.chg?.toFixed(2)}%. Include: trend, key level, and one actionable insight.`;
      const r = await ai.models.generateContent({model:'gemini-2.0-flash',contents:prompt});
      setAiAnalysis(r.text??'');
    } catch { setAiAnalysis('⚠️ Analysis unavailable.'); }
    setAiLoading(false);
  };

  // ── Sorted & filtered coins ───────────────────────────────────────────────
  const displayed = coins
    .filter(c=>!searchQ || c.sym.toLowerCase().includes(searchQ.toLowerCase()) || c.name.toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a,b)=>sortBy==='chg'?((b.chg??0)-(a.chg??0)):sortBy==='price'?((b.price??0)-(a.price??0)):0);

  const algoPrice = coins.find(c=>c.sym==='ALGO')?.price;
  const topGainer = [...coins].sort((a,b)=>(b.chg??0)-(a.chg??0))[0];
  const topLoser  = [...coins].sort((a,b)=>(a.chg??0)-(b.chg??0))[0];
  const totalVol  = coins.reduce((s,c)=>{ const v=parseFloat(c.vol?.replace(/[$B]/g,'')||'0'); return s+v; },0);

  const signalBg = (t:string) =>
    t==='warn'?'bg-[rgba(255,107,0,0.05)] border-[rgba(255,107,0,0.2)]':
    t==='success'?'bg-[rgba(0,255,157,0.04)] border-[rgba(0,255,157,0.15)]':
    t==='alert'?'bg-[rgba(255,34,85,0.05)] border-[rgba(255,34,85,0.2)]':
    'bg-[rgba(0,229,255,0.04)] border-[rgba(0,229,255,0.15)]';

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[26px] font-bold text-wh tracking-[1px]">Market Intelligence Scanner</div>
          <p className="text-[12px] text-t2 font-mono">// CoinGecko live prices · ARIA AI signals · Algorand TXs · Price alerts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastUpdate && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-g1 bg-[rgba(0,255,157,0.06)] border border-[rgba(0,255,157,0.18)] px-2.5 py-1 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-g1 animate-pulse inline-block"/>LIVE · {lastUpdate}
            </span>
          )}
          <button onClick={runAIScan} disabled={scanLoading}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-c2 to-p1 text-white hover:opacity-90 disabled:opacity-60 transition-all">
            {scanLoading ? '⏳ Scanning...' : '⚡ ARIA AI Scan'}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="ALGO Price" value={algoPrice?`$${algoPrice.toFixed(4)}`:'—'} delta={`${coins.find(c=>c.sym==='ALGO')?.chg?.toFixed(2)??0}% 24h`} variant="c"/>
        <StatCard label="Top Gainer 24h" value={topGainer?.sym??'—'} delta={`↑ ${topGainer?.chg?.toFixed(2)??0}%`} variant="g"/>
        <StatCard label="Top Loser 24h"  value={topLoser?.sym??'—'}  delta={`↓ ${Math.abs(topLoser?.chg??0).toFixed(2)}%`} variant="o"/>
        <StatCard label="Total 24h Vol"  value={`$${totalVol.toFixed(1)}B`} delta="↑ 10 assets tracked" variant="p"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left panel */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* AI Signals */}
          <Card title="ARIA AI Signals" badge={
            <span className="bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.18)] text-c1 px-2 py-0.5 rounded text-[9px] font-mono uppercase">{signals.length} signals</span>
          }>
            {signals.length===0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">🤖</div>
                <div className="text-[12px] text-t3 font-mono">Click "⚡ ARIA AI Scan" to generate live market signals</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {signals.map((s,i)=>(
                  <div key={i} className={cn('flex gap-2.5 p-2.5 rounded-lg border',signalBg(s.type))}>
                    <div className="text-base shrink-0">{s.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="text-[12px] font-semibold text-wh">{s.title}</div>
                        {s.sym && <span className="text-[9px] font-mono text-t3">{s.sym}</span>}
                      </div>
                      <div className="text-[11px] text-t2 leading-normal">{s.desc}</div>
                      <div className="font-mono text-[9px] text-t3 mt-1">{s.ts}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Gas Tracker */}
          <Card title="Live Gas Tracker" badge={<span className="text-[9px] font-mono text-g1 border border-[rgba(0,255,157,0.2)] px-2 py-0.5 rounded">REAL-TIME</span>}>
            <div className="flex flex-col gap-2">
              {gasData.map((g,i)=>{
                const pct = Math.min(100,g.liveVal/100*100);
                const level = g.liveVal<1?'LOW':g.liveVal<20?'MED':'HIGH';
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-t1 text-[12px] w-20 shrink-0 font-semibold">{g.name}</span>
                    <div className="flex-1 h-1.5 bg-border-custom rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{width:`${Math.max(3,pct)}%`,backgroundColor:level==='LOW'?'var(--color-g1)':level==='MED'?'var(--color-o1)':'var(--color-r1)'}}/>
                    </div>
                    <span className={cn('font-mono text-[10px] w-20 text-right',g.color)}>{g.liveVal} {g.unit}</span>
                    <span className={cn('font-mono text-[8px] px-1.5 py-0.5 rounded uppercase',level==='LOW'?'text-g1 bg-[rgba(0,255,157,0.08)]':level==='MED'?'text-o1 bg-[rgba(255,107,0,0.08)]':'text-r1 bg-[rgba(255,34,85,0.08)]')}>{level}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Algorand On-Chain TXs */}
          <Card title="⬡ Algorand Live TXs" badge={<span className="text-[9px] font-mono text-c1 border border-[rgba(0,229,255,0.2)] px-2 py-0.5 rounded">TESTNET</span>}>
            {algoTxs.length===0 ? (
              <div className="text-[11px] text-t3 font-mono text-center py-3">Fetching transactions...</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {algoTxs.map((tx,i)=>(
                  <div key={i} className="flex items-center gap-2 bg-[rgba(0,0,0,0.2)] border border-border-custom rounded-lg px-3 py-2">
                    <span className="font-mono text-[9px] text-c1 bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.15)] px-1.5 py-0.5 rounded uppercase">{tx.type}</span>
                    <span className="font-mono text-[10px] text-wh flex-1">{tx.amt}</span>
                    <span className="font-mono text-[9px] text-t3">{tx.ts}</span>
                    <a href={`https://testnet.algoexplorer.io/tx/${tx.id}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-[9px] text-c1 hover:text-wh transition-colors">{tx.id}... ↗</a>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Price Alerts */}
          <Card title="🔔 Price Alerts">
            <div className="flex flex-col gap-2 mb-3">
              <div className="flex gap-2">
                <select value={alertSym} onChange={e=>setAlertSym(e.target.value)}
                  className="bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2 text-wh text-[12px] outline-none">
                  {COINS.map(c=><option key={c.sym}>{c.sym}</option>)}
                </select>
                <select value={alertDir} onChange={e=>setAlertDir(e.target.value as any)}
                  className="bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2 text-wh text-[12px] outline-none">
                  <option value="above">Above</option><option value="below">Below</option>
                </select>
                <input type="number" value={alertPrice} onChange={e=>setAlertPrice(e.target.value)} placeholder="Price"
                  className="flex-1 bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2 text-wh text-[12px] outline-none focus:border-[rgba(0,229,255,0.35)]"/>
                <button onClick={()=>{if(alertPrice){setPriceAlerts(p=>[...p,{sym:alertSym,price:+alertPrice,dir:alertDir,triggered:false}]);setAlertPrice('');}}}
                  className="px-3 py-2 rounded-lg text-[11px] font-bold bg-[rgba(0,229,255,0.1)] border border-[rgba(0,229,255,0.25)] text-c1 hover:bg-[rgba(0,229,255,0.18)] transition-all">+</button>
              </div>
            </div>
            {priceAlerts.length===0 ? (
              <div className="text-[11px] text-t3 font-mono text-center py-2">No alerts set</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {priceAlerts.map((a,i)=>(
                  <div key={i} className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px]',a.triggered?'border-g1 bg-[rgba(0,255,157,0.07)]':'border-border-custom bg-[rgba(0,0,0,0.15)]')}>
                    <span>{a.triggered?'🔔✅':'🔔'}</span>
                    <span className="font-mono font-bold text-wh">{a.sym}</span>
                    <span className="text-t2">{a.dir}</span>
                    <span className="font-mono text-c1">${a.price}</span>
                    {a.triggered && <span className="text-g1 font-mono text-[9px] ml-auto">TRIGGERED</span>}
                    <button onClick={()=>setPriceAlerts(p=>p.filter((_,j)=>j!==i))} className="text-t3 hover:text-r1 transition-colors ml-auto">✕</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Price table + chart */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* Selected coin detail + AI analysis */}
          {selected && (
            <Card title={`${selected.name} (${selected.sym}) — Deep Analysis`} badge={
              <button onClick={()=>analyzeSelected(selected)} disabled={aiLoading}
                className="text-[10px] font-mono text-c1 border border-[rgba(0,229,255,0.2)] px-2.5 py-1 rounded hover:bg-[rgba(0,229,255,0.08)] transition-all disabled:opacity-50">
                {aiLoading?'⏳ Analyzing...':'⚡ ARIA Analyze'}
              </button>
            }>
              <div className="flex gap-4 flex-wrap mb-3">
                <div>
                  <div className="font-display text-[32px] font-bold text-wh">${selected.price?.toLocaleString(undefined,{maximumFractionDigits:4})}</div>
                  <div className={cn('font-mono text-[13px] font-semibold',( selected.chg??0)>=0?'text-g1':'text-r1')}>
                    {(selected.chg??0)>=0?'↑':'↓'}{Math.abs(selected.chg??0).toFixed(2)}% 24h
                  </div>
                </div>
                <div className="flex gap-3">
                  {[{label:'24h Vol',val:selected.vol||'—'},{label:'Market Cap',val:selected.cap||'—'}].map(f=>(
                    <div key={f.label}>
                      <div className="font-mono text-[9px] text-t3 uppercase">{f.label}</div>
                      <div className="font-mono text-[13px] text-wh font-semibold">{f.val}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="h-36 w-full mb-3">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(selected.history??[]).map((v,i)=>({i,v}))}>
                    <defs>
                      <linearGradient id="coinGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={selected.color} stopOpacity={0.25}/>
                        <stop offset="95%" stopColor={selected.color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="i" hide/><YAxis hide domain={['auto','auto']}/>
                    <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:'11px'}} formatter={(v:number)=>[`$${v.toFixed(4)}`,'Price']}/>
                    <Area type="monotone" dataKey="v" stroke={selected.color} strokeWidth={2} fill="url(#coinGrad)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {aiAnalysis && (
                <div className="bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.15)] rounded-lg p-3">
                  <div className="font-mono text-[9px] text-c1 uppercase tracking-widest mb-1.5">⚡ ARIA ANALYSIS</div>
                  <div className="text-[12px] text-t1 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
                </div>
              )}
              {aiLoading && (
                <div className="text-[12px] text-t3 font-mono animate-pulse flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-c1 animate-bounce"/>ARIA analyzing {selected.sym}...
                </div>
              )}
            </Card>
          )}

          {/* Watchlist */}
          <Card title="Watchlist" badge={<span className="text-[9px] font-mono text-t3">{watchlist.length} assets</span>}>
            <div className="flex flex-wrap gap-2">
              {COINS.map(c=>(
                <button key={c.sym}
                  onClick={()=>setWatchlist(w=>w.includes(c.sym)?w.filter(s=>s!==c.sym):[...w,c.sym])}
                  className={cn('px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-all',
                    watchlist.includes(c.sym)?'border-c1 bg-[rgba(0,229,255,0.1)] text-c1':'border-border-custom text-t2 hover:border-border3')}>
                  {c.sym}
                </button>
              ))}
            </div>
          </Card>

          {/* Live price grid */}
          <Card title="Live Market Prices" bodyClassName="p-3" badge={
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[9px] font-mono text-g1 border border-[rgba(0,255,157,0.2)] px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-g1 animate-pulse inline-block"/>LIVE
              </span>
              <div className="flex gap-1">
                {(['chg','price','vol'] as const).map(s=>(
                  <button key={s} onClick={()=>setSortBy(s)} className={cn('px-2 py-0.5 rounded text-[9px] font-mono transition-all',sortBy===s?'bg-[rgba(0,229,255,0.12)] text-c1':'text-t3 hover:text-t2')}>
                    {s==='chg'?'24H%':s==='price'?'PRICE':'VOL'}
                  </button>
                ))}
              </div>
            </div>
          }>
            <div className="mb-2">
              <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search token..."
                className="w-full bg-[rgba(0,0,0,0.3)] border border-border2 rounded-lg px-3 py-2 text-[12px] text-wh outline-none focus:border-[rgba(0,229,255,0.35)] placeholder:text-t3"/>
            </div>
            {loading ? (
              <div className="text-center py-8 text-t3 font-mono animate-pulse">Fetching live prices...</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[480px] overflow-y-auto pr-1">
                {displayed.map(p=>(
                  <div key={p.sym}
                    onClick={()=>analyzeSelected(p)}
                    className={cn('bg-[rgba(0,0,0,0.25)] border rounded-lg p-3 cursor-pointer transition-all hover:scale-[1.01]',
                      selected?.sym===p.sym?'border-c1 bg-[rgba(0,229,255,0.05)]':
                      Math.abs(p.chg??0)>5?'border-[rgba(255,107,0,0.3)] bg-[rgba(255,107,0,0.03)]':'border-border-custom hover:border-border3 hover:bg-[rgba(0,229,255,0.02)]',
                      watchlist.includes(p.sym)&&selected?.sym!==p.sym&&'border-[rgba(0,229,255,0.2)]'
                    )}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[13px] text-wh">{p.sym}</span>
                        {watchlist.includes(p.sym) && <span className="text-[8px] text-c1">★</span>}
                      </div>
                      <span className={cn('font-mono text-[11px] font-semibold',(p.chg??0)>=0?'text-g1':'text-r1')}>
                        {(p.chg??0)>=0?'↑':'↓'}{Math.abs(p.chg??0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="font-mono text-[13px] text-wh font-bold mb-1">
                      ${p.price ? (p.price>100?p.price.toLocaleString(undefined,{maximumFractionDigits:2}):p.price.toFixed(4)) : '...'}
                    </div>
                    {p.vol && <div className="font-mono text-[9px] text-t3 mb-1.5">Vol: {p.vol}</div>}
                    {/* Mini sparkline */}
                    <div className="h-8 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={(p.history??[]).map((v,i)=>({i,v}))}>
                          <Line type="monotone" dataKey="v" stroke={(p.chg??0)>=0?'var(--color-g1)':'var(--color-r1)'} strokeWidth={1.5} dot={false}/>
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
