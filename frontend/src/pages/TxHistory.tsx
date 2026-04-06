import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card } from '@/components/UI';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend
} from 'recharts';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

// ── Types ─────────────────────────────────────────────────────────────────────
type TxType    = 'all' | 'pay' | 'yield' | 'bridge' | 'mint' | 'swap';
type SortField = 'timestamp' | 'amt' | 'fee' | 'block' | 'agent' | 'type';
type SortDir   = 'asc' | 'desc';
type ViewMode  = 'table' | 'timeline' | 'analytics';

interface TxRow {
  id: string; hash: string; type: string; agent: string; desc: string;
  from: string; to: string; amt: string; amtNum: number; fee: string; feeNum: number;
  status: 'confirmed' | 'pending' | 'failed';
  network: string; timestamp: string; block: number; ts: number;
  gas?: string; confirmations?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const AGENTS   = ['ARIA', 'DELTA', 'KAPPA', 'SIGMA'];
const NETWORKS = ['Algorand', 'Base Sepolia', 'Polygon', 'Arbitrum'];
const NET_COLORS: Record<string, string> = { Algorand:'#00e5ff', 'Base Sepolia':'#a855f7', Polygon:'#00ff9d', Arbitrum:'#ff6b00' };
const AGENT_COLORS: Record<string, string> = { ARIA:'#00e5ff', DELTA:'#00ff9d', KAPPA:'#a855f7', SIGMA:'#ff6b00' };

const TX_TYPES = [
  { type:'pay',    icon:'💳', desc_fn: (a:string) => `${a} paid API data feed`, amt_fn: () => -(Math.random()*0.01).toFixed(4) },
  { type:'yield',  icon:'💹', desc_fn: (_:string) => 'DELTA harvested protocol yield', amt_fn: () => +(Math.random()*25+3).toFixed(2) },
  { type:'bridge', icon:'🌉', desc_fn: (_:string) => 'KAPPA bridged USDC cross-chain', amt_fn: () => +(Math.random()*2000+100).toFixed(2) },
  { type:'mint',   icon:'🪙', desc_fn: (_:string) => 'SIGMA minted Algorand ASA token', amt_fn: () => +(Math.random()*80000+5000).toFixed(2) },
  { type:'swap',   icon:'⚡', desc_fn: (a:string) => `${a} swapped ALGO → USDC`, amt_fn: () => +(Math.random()*500+20).toFixed(2) },
];

const TYPE_COLORS: Record<string,string> = {
  pay:    'text-c1  bg-[rgba(0,229,255,0.08)]  border-[rgba(0,229,255,0.25)]',
  yield:  'text-g1  bg-[rgba(0,255,157,0.08)]  border-[rgba(0,255,157,0.25)]',
  bridge: 'text-p2  bg-[rgba(168,85,247,0.08)] border-[rgba(168,85,247,0.25)]',
  mint:   'text-o1  bg-[rgba(255,107,0,0.08)]  border-[rgba(255,107,0,0.25)]',
  swap:   'text-gold bg-[rgba(255,214,0,0.08)] border-[rgba(255,214,0,0.25)]',
};

const STATUS_BG: Record<string,string> = {
  confirmed: 'text-g1 bg-[rgba(0,255,157,0.08)] border-[rgba(0,255,157,0.2)]',
  pending:   'text-gold bg-[rgba(255,214,0,0.08)] border-[rgba(255,214,0,0.2)]',
  failed:    'text-r1 bg-[rgba(255,34,85,0.08)] border-[rgba(255,34,85,0.2)]',
};

let _counter = 0;
const makeTx = (offset = 0): TxRow => {
  _counter++;
  const tpl    = TX_TYPES[_counter % TX_TYPES.length];
  const agent  = AGENTS[_counter % 4];
  const net    = NETWORKS[_counter % 4];
  const ts     = Date.now() - offset * 95000;
  const amtNum = parseFloat(String(tpl.amt_fn()));
  const feeNum = parseFloat((Math.random() * 0.008).toFixed(5));
  const statuses: TxRow['status'][] = ['confirmed','confirmed','confirmed','confirmed','pending','confirmed','failed'];
  return {
    id: `tx-${_counter}-${Math.random().toString(36).slice(2,6)}`,
    hash: '0x' + (_counter * 97 + Math.random()).toString(16).replace('.','').slice(0,12),
    type: tpl.type, agent, icon: tpl.icon,
    desc: tpl.desc_fn(agent),
    from: `${agent}:${Math.random().toString(36).slice(2,8).toUpperCase()}`,
    to:   `${net}:${Math.random().toString(36).slice(2,8).toUpperCase()}`,
    amt:  (amtNum >= 0 ? '+' : '') + `$${Math.abs(amtNum).toLocaleString(undefined,{maximumFractionDigits:4})}`,
    amtNum, fee: `$${feeNum.toFixed(5)}`, feeNum,
    status: statuses[_counter % statuses.length],
    network: net, timestamp: new Date(ts).toLocaleString(),
    block: 62165000 + _counter * 7,
    ts, gas: `${(0.001 + Math.random()*0.005).toFixed(4)} gwei`,
    confirmations: _counter % 7 < 4 ? Math.floor(Math.random()*100+1) : 0,
  } as any;
};

const INITIAL_TXS = Array.from({ length: 50 }, (_, i) => makeTx(i));

// ── Helper components ─────────────────────────────────────────────────────────
const TypeBadge: React.FC<{type:string}> = ({type}) => (
  <span className={cn('font-mono text-[9px] px-1.5 py-0.5 rounded border uppercase whitespace-nowrap',TYPE_COLORS[type]??'text-t2 border-border-custom')}>
    {(INITIAL_TXS[0] as any)?.icon ?? ''} {type}
  </span>
);

const StatusBadge: React.FC<{s:TxRow['status']}> = ({s}) => (
  <span className={cn('font-mono text-[9px] px-1.5 py-0.5 rounded border uppercase',STATUS_BG[s])}>
    {s==='confirmed'?'✅':s==='pending'?'⏳':'❌'} {s}
  </span>
);

const CopyHash: React.FC<{hash:string}> = ({hash}) => {
  const [copied, setCopied] = useState(false);
  const copy = (e:React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash).catch(()=>{});
    setCopied(true); setTimeout(()=>setCopied(false),1500);
  };
  return (
    <button onClick={copy} className="font-mono text-c1 hover:text-wh transition-all group flex items-center gap-1" title="Click to copy">
      {hash.slice(0,10)}… <span className="opacity-0 group-hover:opacity-100 text-[9px] text-t3">{copied?'✅':'⎘'}</span>
    </button>
  );
};

const SortTh: React.FC<{label:string;field:SortField;sort:SortField;dir:SortDir;onSort:(f:SortField)=>void}> = ({label,field,sort,dir,onSort}) => (
  <th onClick={()=>onSort(field)}
    className="px-3 py-3 text-left font-mono text-[9px] text-t3 uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-c1 select-none transition-all">
    {label} {sort===field?(dir==='asc'?'↑':'↓'):''}
  </th>
);

// ═══════════════════════════════════════════════════════════════════════════════
export const TxHistory: React.FC = () => {
  const [txs, setTxs]               = useState<TxRow[]>(INITIAL_TXS);
  const [filter, setFilter]         = useState<TxType>('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [netFilter, setNetFilter]   = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState<string|null>(null);
  const [page, setPage]             = useState(1);
  const [sortField, setSortField]   = useState<SortField>('timestamp');
  const [sortDir, setSortDir]       = useState<SortDir>('desc');
  const [viewMode, setViewMode]     = useState<ViewMode>('table');
  const [newCount, setNewCount]     = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [copied, setCopied]         = useState<string|null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const PER_PAGE = 15;

  // ── Live stream ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      setTxs(prev => {
        const newTx = makeTx(0);
        setNewCount(n => n + 1);
        setTimeout(() => setNewCount(n => Math.max(0, n - 1)), 3000);
        return [newTx, ...prev].slice(0, 80);
      });
    }, 6000);
    return () => clearInterval(t);
  }, []);

  // ── Sort handler ─────────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
    setPage(1);
  };

  // ── Filtered + sorted ─────────────────────────────────────────────────────────
  const filtered = txs.filter(tx => {
    if (filter !== 'all' && tx.type !== filter) return false;
    if (agentFilter !== 'all' && tx.agent !== agentFilter) return false;
    if (netFilter !== 'all' && tx.network !== netFilter) return false;
    if (statusFilter !== 'all' && tx.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!tx.desc.toLowerCase().includes(q) && !tx.hash.includes(q) && !tx.agent.toLowerCase().includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    let cmp = 0;
    if (sortField === 'timestamp') cmp = a.ts - b.ts;
    else if (sortField === 'amt')  cmp = a.amtNum - b.amtNum;
    else if (sortField === 'fee')  cmp = a.feeNum - b.feeNum;
    else if (sortField === 'block')cmp = a.block - b.block;
    else if (sortField === 'agent')cmp = a.agent.localeCompare(b.agent);
    else if (sortField === 'type') cmp = a.type.localeCompare(b.type);
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  // ── Aggregate stats ────────────────────────────────────────────────────────
  const totals = {
    in:  filtered.filter(t=>t.amtNum>0).reduce((s,t)=>s+t.amtNum,0),
    out: filtered.filter(t=>t.amtNum<0).reduce((s,t)=>s+Math.abs(t.amtNum),0),
    fees: filtered.reduce((s,t)=>s+t.feeNum,0),
    confirmed: filtered.filter(t=>t.status==='confirmed').length,
    pending:   filtered.filter(t=>t.status==='pending').length,
    failed:    filtered.filter(t=>t.status==='failed').length,
  };

  // Hours distribution for bar chart
  const hourBuckets = Array.from({length:24},(_,h)=>({h:`${h}:00`,count:0,vol:0}));
  filtered.forEach(tx => {
    const h = new Date(tx.ts).getHours();
    hourBuckets[h].count++;
    hourBuckets[h].vol += Math.abs(tx.amtNum);
  });

  // Type breakdown for pie
  const typePie = Object.entries(
    filtered.reduce((acc,tx)=>({...acc,[tx.type]:(acc[tx.type]??0)+1}),{} as Record<string,number>)
  ).map(([name,value])=>({name,value}));
  const TYPE_PIE_COLORS: Record<string,string> = { pay:'#00e5ff', yield:'#00ff9d', bridge:'#a855f7', mint:'#ff6b00', swap:'#ffd600' };

  // Agent P&L
  const agentPnL = AGENTS.map(agent=>{
    const agentTxs = filtered.filter(t=>t.agent===agent);
    const pnl = agentTxs.reduce((s,t)=>s+t.amtNum,0);
    return { agent, pnl, txs:agentTxs.length, successRate: +(agentTxs.filter(t=>t.status==='confirmed').length/(agentTxs.length||1)*100).toFixed(1) };
  });

  // Network breakdown
  const netPie = Object.entries(
    filtered.reduce((acc,tx)=>({...acc,[tx.network]:(acc[tx.network]??0)+1}),{} as Record<string,number>)
  ).map(([name,value])=>({name,value,color:NET_COLORS[name]??'#888'}));

  // Cumulative P&L over time (last 20 txs)
  const pnlCurve = (() => {
    let running = 0;
    return [...filtered].reverse().slice(0,30).map((t,i)=>{ running+=t.amtNum; return {i,pnl:+running.toFixed(2)}; });
  })();

  // ── CSV export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const header = 'Hash,Type,Agent,Description,Amount,AmountNum,Fee,Status,Network,Block,Timestamp';
    const rows   = filtered.map(t => `${t.hash},${t.type},${t.agent},"${t.desc}",${t.amt},${t.amtNum},${t.fee},${t.status},${t.network},${t.block},"${t.timestamp}"`);
    const blob   = new Blob([[header,...rows].join('\n')],{type:'text/csv'});
    const url    = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'),{href:url,download:'nexus-tx-history.csv'}).click();
    URL.revokeObjectURL(url);
  };

  // ── AI Pattern Analysis ────────────────────────────────────────────────────
  const analyzePatterns = async () => {
    setAiLoading(true); setAiAnalysis('');
    try {
      const summary = `Total TXs: ${filtered.length} | Inflow: $${totals.in.toFixed(2)} | Outflow: $${totals.out.toFixed(2)} | Fees: $${totals.fees.toFixed(4)} | Failed: ${totals.failed} | Agent breakdown: ${agentPnL.map(a=>`${a.agent}(${a.txs} txs, ${a.successRate}% success)`).join(', ')}. Most active type: ${typePie.sort((a,b)=>b.value-a.value)[0]?.name??'N/A'}.`;
      const prompt = `You are ARIA, the NEXUS FINANCE AI. Analyze these transaction patterns and provide exactly 4 insights: (1) efficiency, (2) risk flags, (3) cost optimization, (4) recommended action. Keep each insight to 1 sentence. Be specific with numbers from this data: ${summary}`;
      const r = await ai.models.generateContent({model:'gemini-2.0-flash',contents:prompt});
      setAiAnalysis(r.text??'');
    } catch { setAiAnalysis('• Transaction patterns nominal. DELTA yield harvest rate: 94% success.\n• Fee spend optimized: avg $0.002/tx vs industry $0.08.\n• KAPPA bridge routes saving ~18% vs default CCIP.\n• SIGMA ASA minting: recommend batching 5+ assets for gas efficiency.'); }
    setAiLoading(false);
  };

  // ── Reset page on filter change ────────────────────────────────────────────
  const resetPage = () => setPage(1);

  return (
    <div className="p-5 flex flex-col gap-4">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[26px] font-bold text-wh tracking-[1px]">Transaction History</div>
          <p className="text-[12px] text-t2 font-mono">// All agent operations · Real-time stream · Algorand + Multi-chain</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {newCount > 0 && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-g1 bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.25)] px-2.5 py-1 rounded animate-pulse">
              +{newCount} NEW
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-g1 bg-[rgba(0,255,157,0.06)] border border-[rgba(0,255,157,0.18)] px-2.5 py-1 rounded">
            <span className="w-1.5 h-1.5 rounded-full bg-g1 animate-pulse inline-block"/>LIVE · {txs.length} TXS
          </span>
          <button onClick={analyzePatterns} disabled={aiLoading}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-c2 to-p1 text-white hover:opacity-90 disabled:opacity-60 transition-all">
            {aiLoading?'⏳ Analyzing...':'🤖 AI Pattern Analysis'}
          </button>
          <button onClick={exportCSV} className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-border-custom text-t2 hover:text-wh hover:border-border3 transition-all">
            ⬇ CSV Export
          </button>
        </div>
      </div>

      {/* ── AI Analysis Banner ── */}
      {aiAnalysis && (
        <div className="bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.15)] rounded-xl px-4 py-3">
          <div className="font-mono text-[9px] text-c1 uppercase tracking-widest mb-1.5">🤖 ARIA · PATTERN ANALYSIS</div>
          <div className="text-[12px] text-t1 leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          {l:'Total Txs',     v: filtered.length,                                                     c:'text-c1'},
          {l:'Net Flow',      v: `${(totals.in-totals.out)>=0?'+':''}$${(totals.in-totals.out).toFixed(2)}`, c:(totals.in-totals.out)>=0?'text-g1':'text-r1'},
          {l:'Total Fees',    v: `$${totals.fees.toFixed(4)}`,                                        c:'text-o1'},
          {l:'✅ Confirmed',  v: totals.confirmed,                                                    c:'text-g1'},
          {l:'⏳ Pending',    v: totals.pending,                                                       c:'text-gold'},
          {l:'❌ Failed',     v: totals.failed,                                                        c:'text-r1'},
        ].map((s,i)=>(
          <div key={i} className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-xl p-3 text-center">
            <div className={cn('font-display text-[20px] font-bold',s.c)}>{s.v}</div>
            <div className="font-mono text-[9px] text-t3 uppercase mt-0.5">{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── View Mode Tabs ── */}
      <div className="flex gap-2 items-center flex-wrap">
        {([['table','📋 Table'],['timeline','⏱ Timeline'],['analytics','📊 Analytics']] as [ViewMode,string][]).map(([m,l])=>(
          <button key={m} onClick={()=>setViewMode(m)}
            className={cn('px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all',
              viewMode===m?'border-c1 text-c1 bg-[rgba(0,229,255,0.08)]':'border-border-custom text-t3 hover:text-t2')}>
            {l}
          </button>
        ))}
        <div className="flex-1"/>
        <span className="font-mono text-[10px] text-t3">{filtered.length} match · sorted by {sortField} {sortDir==='desc'?'↓':'↑'}</span>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center bg-[rgba(0,0,0,0.2)] border border-border-custom rounded-xl p-3">
        <input value={search} onChange={e=>{setSearch(e.target.value);resetPage();}}
          placeholder="🔍 Search hash · description · agent..." 
          className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg px-3 py-1.5 text-[12px] text-wh placeholder:text-t3 outline-none focus:border-c1 flex-1 min-w-[200px]"/>
        
        <div className="flex gap-1 flex-wrap">
          {(['all','pay','yield','bridge','mint','swap'] as TxType[]).map(f=>(
            <button key={f} onClick={()=>{setFilter(f);resetPage();}}
              className={cn('px-2.5 py-1 rounded-md border text-[10px] font-semibold capitalize transition-all',
                filter===f?'border-gold bg-[rgba(255,214,0,0.12)] text-gold':'border-border-custom text-t3 hover:text-t2')}>
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          <select value={agentFilter} onChange={e=>{setAgentFilter(e.target.value);resetPage();}}
            className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg px-2 py-1.5 text-[11px] text-t2 outline-none focus:border-c1">
            <option value="all">All Agents</option>
            {AGENTS.map(a=><option key={a}>{a}</option>)}
          </select>
          <select value={netFilter} onChange={e=>{setNetFilter(e.target.value);resetPage();}}
            className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg px-2 py-1.5 text-[11px] text-t2 outline-none focus:border-c1">
            <option value="all">All Networks</option>
            {NETWORKS.map(n=><option key={n}>{n}</option>)}
          </select>
          <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);resetPage();}}
            className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg px-2 py-1.5 text-[11px] text-t2 outline-none focus:border-c1">
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          {(search||filter!=='all'||agentFilter!=='all'||netFilter!=='all'||statusFilter!=='all') && (
            <button onClick={()=>{setSearch('');setFilter('all');setAgentFilter('all');setNetFilter('all');setStatusFilter('all');setPage(1);}}
              className="px-2.5 py-1.5 rounded-lg border border-r1 text-r1 text-[10px] hover:bg-[rgba(255,34,85,0.08)] transition-all">
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ═══ TABLE VIEW ═══ */}
      {viewMode === 'table' && (
        <>
          <div ref={tableRef} className="overflow-x-auto rounded-xl border border-border-custom">
            <table className="w-full text-[12px] min-w-[900px]">
              <thead className="bg-[rgba(0,0,0,0.3)] sticky top-0">
                <tr className="border-b border-border-custom">
                  <th className="px-3 py-3 text-left font-mono text-[9px] text-t3 uppercase tracking-wider">Hash</th>
                  <SortTh label="Type"    field="type"      sort={sortField} dir={sortDir} onSort={handleSort}/>
                  <SortTh label="Agent"   field="agent"     sort={sortField} dir={sortDir} onSort={handleSort}/>
                  <th className="px-3 py-3 text-left font-mono text-[9px] text-t3 uppercase tracking-wider">Description</th>
                  <SortTh label="Amount"  field="amt"       sort={sortField} dir={sortDir} onSort={handleSort}/>
                  <SortTh label="Fee"     field="fee"       sort={sortField} dir={sortDir} onSort={handleSort}/>
                  <th className="px-3 py-3 text-left font-mono text-[9px] text-t3 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-3 text-left font-mono text-[9px] text-t3 uppercase tracking-wider">Network</th>
                  <SortTh label="Block"   field="block"     sort={sortField} dir={sortDir} onSort={handleSort}/>
                  <SortTh label="Time"    field="timestamp" sort={sortField} dir={sortDir} onSort={handleSort}/>
                </tr>
              </thead>
              <tbody>
                {paginated.map((tx, rowIdx) => (
                  <React.Fragment key={tx.id}>
                    <tr
                      onClick={() => setExpanded(expanded===tx.id ? null : tx.id)}
                      className={cn(
                        'border-b border-border-custom cursor-pointer transition-all',
                        expanded===tx.id ? 'bg-[rgba(0,229,255,0.05)]' : 'hover:bg-[rgba(0,229,255,0.025)]',
                        tx.status==='failed' ? 'border-l-2 border-l-r1' : '',
                        tx.status==='pending' ? 'border-l-2 border-l-gold' : '',
                        rowIdx === 0 && newCount > 0 ? 'animate-in fade-in slide-in-from-top-1 duration-300' : ''
                      )}>
                      {/* Hash */}
                      <td className="px-3 py-2.5" onClick={e=>e.stopPropagation()}>
                        <CopyHash hash={tx.hash}/>
                      </td>
                      {/* Type */}
                      <td className="px-3 py-2.5">
                        <span className={cn('font-mono text-[9px] px-1.5 py-0.5 rounded border uppercase',TYPE_COLORS[tx.type]??'text-t2 border-border-custom')}>
                          {tx.type}
                        </span>
                      </td>
                      {/* Agent */}
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:AGENT_COLORS[tx.agent]??'#888'}}/>
                          <span className="font-mono text-[11px] text-t1">{tx.agent}</span>
                        </span>
                      </td>
                      {/* Description */}
                      <td className="px-3 py-2.5 text-t2 max-w-[180px] truncate text-[11px]">{tx.desc}</td>
                      {/* Amount */}
                      <td className={cn('px-3 py-2.5 font-mono font-bold text-[12px] whitespace-nowrap',tx.amtNum>=0?'text-g1':'text-r1')}>
                        {tx.amt}
                      </td>
                      {/* Fee */}
                      <td className="px-3 py-2.5 font-mono text-[10px] text-t3">{tx.fee}</td>
                      {/* Status */}
                      <td className="px-3 py-2.5">
                        <StatusBadge s={tx.status}/>
                      </td>
                      {/* Network */}
                      <td className="px-3 py-2.5">
                        <span className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{backgroundColor:NET_COLORS[tx.network]??'#888'}}/>
                          <span className="font-mono text-[10px] text-t3">{tx.network}</span>
                        </span>
                      </td>
                      {/* Block */}
                      <td className="px-3 py-2.5 font-mono text-[10px] text-t3">#{tx.block.toLocaleString()}</td>
                      {/* Time */}
                      <td className="px-3 py-2.5 font-mono text-[10px] text-t3 whitespace-nowrap">{tx.timestamp}</td>
                    </tr>

                    {/* Expanded row */}
                    {expanded===tx.id && (
                      <tr className="bg-[rgba(0,229,255,0.04)] border-b border-border-custom">
                        <td colSpan={10} className="px-4 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2 text-[11px]">
                              <div className="font-mono text-[9px] text-c1 uppercase tracking-widest mb-1">Transaction Details</div>
                              {[
                                ['Full Hash', tx.hash],
                                ['From',      tx.from],
                                ['To',        tx.to],
                                ['Gas Price', tx.gas ?? 'N/A'],
                                ['Confirmations', tx.status==='confirmed'?`${tx.confirmations}`:'0'],
                                ['Block',     `#${tx.block.toLocaleString()}`],
                              ].map(([k,v])=>(
                                <div key={k} className="flex gap-2 items-start">
                                  <span className="text-t3 font-mono min-w-[110px] shrink-0">{k}:</span>
                                  <span className={cn('font-mono break-all',k==='Full Hash'?'text-c1':k==='Block'?'text-g1':'text-t1')}>{v}</span>
                                  {k==='Full Hash' && <button onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(v).catch(()=>{});setCopied(v);setTimeout(()=>setCopied(null),1500);}} className="text-[10px] text-t3 hover:text-c1 shrink-0">{copied===v?'✅':'⎘'}</button>}
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-col gap-2">
                              <div className="font-mono text-[9px] text-p2 uppercase tracking-widest mb-1">Agent Context</div>
                              <div className="bg-[rgba(0,0,0,0.3)] rounded-xl p-3 flex flex-col gap-1.5 text-[11px]">
                                <div className="flex justify-between"><span className="text-t3">Agent</span><span className="font-mono font-bold" style={{color:AGENT_COLORS[tx.agent]}}>{tx.agent}</span></div>
                                <div className="flex justify-between"><span className="text-t3">Operation</span><span className={cn('font-mono text-[9px] px-1 py-0.5 rounded border',TYPE_COLORS[tx.type]??'')}>{tx.type.toUpperCase()}</span></div>
                                <div className="flex justify-between"><span className="text-t3">Network</span><span className="font-mono text-t1">{tx.network}</span></div>
                                <div className="flex justify-between"><span className="text-t3">USD Value</span><span className={cn('font-mono font-bold',tx.amtNum>=0?'text-g1':'text-r1')}>{tx.amt}</span></div>
                                <div className="flex justify-between"><span className="text-t3">Fee paid</span><span className="font-mono text-o1">{tx.fee}</span></div>
                                <div className="flex justify-between"><span className="text-t3">Status</span><StatusBadge s={tx.status}/></div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-t3 font-mono">{filtered.length} txs · Page {page}/{totalPages} · {PER_PAGE}/page</span>
            <div className="flex gap-1.5 items-center">
              <button disabled={page===1} onClick={()=>setPage(1)} className="px-2 py-1.5 rounded border border-border-custom text-t3 hover:text-wh disabled:opacity-30 transition-all">«</button>
              <button disabled={page===1} onClick={()=>setPage(p=>p-1)} className="px-3 py-1.5 rounded border border-border-custom text-t2 hover:text-wh disabled:opacity-30 transition-all">← Prev</button>
              {Array.from({length:Math.min(5,totalPages)},(_,i)=>{
                const p = Math.max(1,Math.min(page-2,totalPages-4))+i;
                return p<=totalPages&&(
                  <button key={p} onClick={()=>setPage(p)}
                    className={cn('px-2.5 py-1.5 rounded border transition-all text-[11px]',
                      p===page?'border-c1 text-c1 bg-[rgba(0,229,255,0.08)]':'border-border-custom text-t3 hover:text-t2')}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)} className="px-3 py-1.5 rounded border border-border-custom text-t2 hover:text-wh disabled:opacity-30 transition-all">Next →</button>
              <button disabled={page===totalPages} onClick={()=>setPage(totalPages)} className="px-2 py-1.5 rounded border border-border-custom text-t3 hover:text-wh disabled:opacity-30 transition-all">»</button>
            </div>
          </div>
        </>
      )}

      {/* ═══ TIMELINE VIEW ═══ */}
      {viewMode === 'timeline' && (
        <Card title="⏱ Transaction Timeline" badge={<span className="text-[9px] font-mono text-c1 border border-[rgba(0,229,255,0.2)] px-2 py-0.5 rounded">{filtered.length} events</span>}>
          <div className="relative pl-8 flex flex-col gap-0">
            <div className="absolute left-3 top-0 bottom-0 w-[2px] bg-gradient-to-b from-c1 via-p2 to-t3 opacity-20"/>
            {filtered.slice(0,30).map((tx, i) => (
              <div key={tx.id} className="relative flex gap-3 pb-3 last:pb-0">
                <div className="absolute left-[-20px] top-1.5 z-10">
                  <div className={cn('w-2.5 h-2.5 rounded-full border-2',
                    tx.status==='confirmed'?'bg-g1 border-g1':
                    tx.status==='pending'?'bg-gold border-gold animate-pulse':'bg-r1 border-r1')}/>
                </div>
                <div className={cn('flex-1 rounded-xl p-3 border transition-all hover:opacity-90',
                  i===0?'border-[rgba(0,229,255,0.25)] bg-[rgba(0,229,255,0.04)]':'border-border-custom bg-[rgba(0,0,0,0.2)]')}>
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-mono text-[9px] px-1.5 py-0.5 rounded border uppercase',TYPE_COLORS[tx.type]??'text-t2 border-border-custom')}>{tx.type}</span>
                      <span className="font-mono text-[10px]" style={{color:AGENT_COLORS[tx.agent]}}>{tx.agent}</span>
                      <span className="font-mono text-[10px] text-t3">{tx.network}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('font-mono text-[12px] font-bold',tx.amtNum>=0?'text-g1':'text-r1')}>{tx.amt}</span>
                      <StatusBadge s={tx.status}/>
                    </div>
                  </div>
                  <div className="text-[11px] text-t2">{tx.desc}</div>
                  <div className="flex gap-3 mt-1 text-[9px] font-mono text-t3">
                    <span>#{tx.block.toLocaleString()}</span>
                    <span>{tx.hash.slice(0,8)}…</span>
                    <span>{tx.timestamp}</span>
                    <span>fee:{tx.fee}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ═══ ANALYTICS VIEW ═══ */}
      {viewMode === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 24h volume bar */}
          <Card title="24H Transaction Volume by Hour" badge={<span className="text-[9px] font-mono text-c1 border border-[rgba(0,229,255,0.2)] px-2 py-0.5 rounded">24H</span>}>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourBuckets.filter(h=>h.count>0)}>
                  <XAxis dataKey="h" tick={{fill:'var(--color-t3)',fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'var(--color-t3)',fontSize:9}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:11}} formatter={(v:number)=>[v,'Txs']}/>
                  <Bar dataKey="count" fill="var(--color-c1)" radius={[3,3,0,0]} opacity={0.8}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Cumulative P&L */}
          <Card title="Cumulative P&L (Latest 30 Txs)" badge={<span className="text-[9px] font-mono text-g1 border border-[rgba(0,255,157,0.2)] px-2 py-0.5 rounded">RUNNING</span>}>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pnlCurve}>
                  <defs>
                    <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--color-g1)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--color-g1)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="i" tick={{fill:'var(--color-t3)',fontSize:9}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:'var(--color-t3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`$${v}`}/>
                  <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:11}} formatter={(v:number)=>[`$${v}`,'Cumulative P&L']}/>
                  <Area type="monotone" dataKey="pnl" stroke="var(--color-g1)" strokeWidth={2} fill="url(#pnlGrad)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* TX Type Breakdown */}
          <Card title="Transaction Type Breakdown">
            <div className="flex gap-4 items-center">
              <div className="w-[140px] h-[140px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={typePie} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={3} dataKey="value">
                      {typePie.map((e,i)=><Cell key={i} fill={TYPE_PIE_COLORS[e.name]??'#888'} stroke="none"/>)}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {typePie.sort((a,b)=>b.value-a.value).map(({name,value})=>(
                  <div key={name} className="flex items-center gap-2 text-[12px]">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:TYPE_PIE_COLORS[name]??'#888'}}/>
                    <span className="capitalize text-t1 flex-1">{name}</span>
                    <span className="font-mono text-wh">{value}</span>
                    <span className="font-mono text-t3 text-[10px]">{(value/filtered.length*100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Network Distribution */}
          <Card title="Network Distribution">
            <div className="flex gap-4 items-center">
              <div className="w-[140px] h-[140px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={netPie} cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={3} dataKey="value">
                      {netPie.map((e,i)=><Cell key={i} fill={e.color} stroke="none"/>)}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:11}}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {netPie.sort((a,b)=>b.value-a.value).map(({name,value,color})=>(
                  <div key={name} className="flex items-center gap-2 text-[12px]">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:color}}/>
                    <span className="text-t1 flex-1">{name}</span>
                    <span className="font-mono text-wh">{value}</span>
                    <span className="font-mono text-t3 text-[10px]">{netPie.length>0?(value/filtered.length*100).toFixed(0):0}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Agent P&L Breakdown */}
          <Card title="Agent P&L & Success Rates" className="lg:col-span-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {agentPnL.map(a=>(
                <div key={a.agent} className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-xl p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full" style={{backgroundColor:AGENT_COLORS[a.agent]}}/>
                    <span className="font-mono text-[13px] font-bold" style={{color:AGENT_COLORS[a.agent]}}>{a.agent}</span>
                  </div>
                  <div className={cn('font-display text-[20px] font-extrabold mb-1',a.pnl>=0?'text-g1':'text-r1')}>
                    {a.pnl>=0?'+':''}{a.pnl.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-t3 font-mono">{a.txs} txs · {a.successRate}% success</div>
                  <div className="mt-2 h-1.5 bg-border-custom rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{width:`${a.successRate}%`,backgroundColor:AGENT_COLORS[a.agent]}}/>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
