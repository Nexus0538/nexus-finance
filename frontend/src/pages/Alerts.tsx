import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, StatCard } from '@/components/UI';
import { cn } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

// ── Types ─────────────────────────────────────────────────────────────────────
type AlertType = 'warn' | 'info' | 'success' | 'critical' | 'algo';
type AlertCategory = 'all' | 'defi' | 'bridge' | 'rwa' | 'gas' | 'algo' | 'price';
type AlertPriority = 'critical' | 'high' | 'medium' | 'low';

interface Alert {
  id: string;
  type: AlertType;
  icon: string;
  title: string;
  desc: string;
  time: string;
  ts: number;
  agent: string;
  category: AlertCategory;
  priority: AlertPriority;
  read: boolean;
  actionLabel?: string;
  actionUrl?: string;
}

interface Rule {
  id: string;
  name: string;
  condition: string;
  threshold: string;
  agent: string;
  active: boolean;
  triggered: number;
}

// ── Static initial alerts ─────────────────────────────────────────────────────
const NOW = Date.now();
const INITIAL_ALERTS: Alert[] = [
  { id:'a1', type:'warn',     icon:'⚠️', title:'Gearbox Protocol — Liquidity Drop',        desc:'TVL decreased 12.4% in 4 hours. ARIA recommends reducing Gearbox exposure. Smart contract risk monitored.', time:'2m ago',  ts:NOW-120000,  agent:'ARIA',  category:'defi',   priority:'high',     read:false, actionLabel:'View DeFi Matrix' },
  { id:'a2', type:'info',     icon:'⚡', title:'Optimal Gas Window — Execute Now',          desc:'Base gas: 0.003 gwei — lowest in 48 hours. DELTA recommends executing all pending rebalances now.',           time:'8m ago',  ts:NOW-480000,  agent:'DELTA', category:'gas',    priority:'high',     read:false, actionLabel:'Go to DeFi Matrix' },
  { id:'a3', type:'success',  icon:'💹', title:'Yield Optimization Complete',               desc:'DELTA migrated $10,000 from Aave (4.2%) to Pendle ETH Pool (14.8%). Annual yield increase: +$1,060.',        time:'42m ago', ts:NOW-2520000, agent:'DELTA', category:'defi',   priority:'medium',   read:false },
  { id:'a4', type:'algo',     icon:'⬡', title:'Algorand Block Milestone — 40M',            desc:'Algorand Testnet surpassed 40 million blocks. Network health nominal. TPS averaging 4,800.',                  time:'1h ago',  ts:NOW-3600000, agent:'ARIA',  category:'algo',   priority:'low',      read:true  },
  { id:'a5', type:'info',     icon:'🏦', title:'RWA Funding Milestone — 78%',              desc:'Infosys Invoice #1089 reached 78% funding ($93,600 of $120,000). SIGMA projects full funding in 18 hours.',   time:'1h ago',  ts:NOW-3700000, agent:'SIGMA', category:'rwa',    priority:'medium',   read:true  },
  { id:'a6', type:'warn',     icon:'📊', title:'ETH Volatility Alert — +18%',              desc:'ETH 30-day vol up 18%. AI model adjusting risk parameters. RWA token valuations reviewed.',                   time:'2h ago',  ts:NOW-7200000, agent:'ARIA',  category:'price',  priority:'high',     read:true  },
  { id:'a7', type:'success',  icon:'🌉', title:'Bridge Complete — Base → Polygon',         desc:'KAPPA completed USDC bridge: $5,000 in 18s. Fee: $0.12. Chainlink CCIP confirmed on both chains.',           time:'3h ago',  ts:NOW-10800000,agent:'KAPPA', category:'bridge', priority:'low',      read:true  },
  { id:'a8', type:'critical', icon:'🔴', title:'CRITICAL: Liquidation Risk Detected',      desc:'Leverage position on Morpho approaching 85% LTV. DELTA flagging for immediate review. Take action now.',     time:'5h ago',  ts:NOW-18000000,agent:'DELTA', category:'defi',   priority:'critical', read:true, actionLabel:'Manage Position' },
  { id:'a9', type:'algo',     icon:'⬡', title:'Algorand: New ASA Detected in Wallet',     desc:'ASA #1234567 received: 500 NEXUS-RWA tokens from address ABCD...EF. Auto-tagged as RWA holding.',            time:'6h ago',  ts:NOW-21600000,agent:'SIGMA', category:'algo',   priority:'low',      read:true  },
];

const INITIAL_RULES: Rule[] = [
  { id:'r1', name:'Gas Alert',         condition:'Gas below',          threshold:'0.005 gwei (Base)',  agent:'DELTA', active:true,  triggered:12 },
  { id:'r2', name:'Liquidation Guard', condition:'LTV above',          threshold:'80%',                agent:'DELTA', active:true,  triggered:2  },
  { id:'r3', name:'Yield Spike',       condition:'APY spike >',        threshold:'5% in 1 hour',       agent:'ARIA',  active:true,  triggered:7  },
  { id:'r4', name:'ALGO Price Move',   condition:'ALGO price change >', threshold:'10% in 24h',         agent:'ARIA',  active:false, triggered:3  },
  { id:'r5', name:'Bridge Monitor',    condition:'Bridge fee >',        threshold:'$2.00',              agent:'KAPPA', active:true,  triggered:1  },
  { id:'r6', name:'RWA Funding',       condition:'Funding progress >',  threshold:'75%',                agent:'SIGMA', active:true,  triggered:4  },
];

const typeBg = (t: AlertType) => ({
  critical: 'bg-[rgba(255,34,85,0.07)] border-[rgba(255,34,85,0.3)]',
  warn:     'bg-[rgba(255,107,0,0.05)] border-[rgba(255,107,0,0.2)]',
  success:  'bg-[rgba(0,255,157,0.04)] border-[rgba(0,255,157,0.15)]',
  algo:     'bg-[rgba(0,229,255,0.05)] border-[rgba(0,229,255,0.2)]',
  info:     'bg-[rgba(168,85,247,0.04)] border-[rgba(168,85,247,0.15)]',
}[t]);

const priorityBadge = (p: AlertPriority) => ({
  critical: 'text-r1  border-[rgba(255,34,85,0.3)]  bg-[rgba(255,34,85,0.1)]',
  high:     'text-o1  border-[rgba(255,107,0,0.3)]  bg-[rgba(255,107,0,0.1)]',
  medium:   'text-c1  border-[rgba(0,229,255,0.3)]  bg-[rgba(0,229,255,0.1)]',
  low:      'text-t3  border-border-custom           bg-transparent',
}[p]);

const agentColor = (a: string) => ({
  ARIA:'text-c1', DELTA:'text-g1', KAPPA:'text-p2', SIGMA:'text-o1'
}[a] ?? 'text-t2');

const CATEGORIES: { id: AlertCategory; label: string }[] = [
  {id:'all',label:'All'},{id:'defi',label:'DeFi'},{id:'bridge',label:'Bridge'},
  {id:'rwa',label:'RWA'},{id:'gas',label:'Gas'},{id:'algo',label:'Algorand'},{id:'price',label:'Price'},
];

// ═══════════════════════════════════════════════════════════════════════════════
export const Alerts: React.FC = () => {
  const [alerts, setAlerts]     = useState<Alert[]>(INITIAL_ALERTS);
  const [rules, setRules]       = useState<Rule[]>(INITIAL_RULES);
  const [category, setCategory] = useState<AlertCategory>('all');
  const [showUnread, setShowUnread] = useState(false);
  const [expandedId, setExpandedId] = useState<string|null>(null);

  // AI Digest
  const [digestOpen, setDigestOpen]   = useState(false);
  const [digestText, setDigestText]   = useState('');
  const [digestLoading, setDigestLoading] = useState(false);

  // Create Alert form
  const [showCreate, setShowCreate]   = useState(false);
  const [newTitle, setNewTitle]       = useState('');
  const [newDesc, setNewDesc]         = useState('');
  const [newType, setNewType]         = useState<AlertType>('info');
  const [newCat, setNewCat]           = useState<AlertCategory>('defi');
  const [newAgent, setNewAgent]       = useState('ARIA');

  // Create Rule form
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleCondition, setRuleCondition] = useState('');
  const [ruleThreshold, setRuleThreshold] = useState('');
  const [ruleAgent, setRuleAgent]         = useState('ARIA');

  // Live Algorand events (simulated + real)
  const [algoEvents, setAlgoEvents] = useState<{hash:string;type:string;ts:string}[]>([]);

  // Stats
  const unreadCount   = alerts.filter(a=>!a.read).length;
  const criticalCount = alerts.filter(a=>a.priority==='critical').length;
  const todayCount    = alerts.filter(a=>Date.now()-a.ts < 86400000).length;
  const activeRules   = rules.filter(r=>r.active).length;

  // ── Fetch Algorand events ─────────────────────────────────────────────────
  useEffect(() => {
    const fetch = async () => {
      try {
        const r = await window.fetch('https://testnet-api.algonode.cloud/v2/transactions?limit=5');
        const j = await r.json();
        const events = (j.transactions||[]).slice(0,5).map((tx:any) => ({
          hash: tx.id?.slice(0,10) || '—',
          type: tx['tx-type'] || 'pay',
          ts:   new Date((tx['round-time']||0)*1000).toLocaleTimeString(),
        }));
        if (events.length) setAlgoEvents(events);
      } catch {}
    };
    fetch(); const t = setInterval(fetch, 20000); return () => clearInterval(t);
  }, []);

  // ── Simulate new live alerts every ~60s ──────────────────────────────────
  useEffect(() => {
    const LIVE_ALERTS: Omit<Alert,'id'|'ts'|'time'>[] = [
      {type:'info',icon:'⚡',title:'Gas Opportunity: Base 0.002 gwei',desc:'Cheapest gas window detected. Execute rebalances now.',agent:'DELTA',category:'gas',priority:'high',read:false,actionLabel:'DeFi Matrix'},
      {type:'algo',icon:'⬡',title:'New Algorand TXs Detected',desc:'6 new transactions on testnet in the last block. Network congestion: minimal.',agent:'ARIA',category:'algo',priority:'low',read:false},
      {type:'success',icon:'💹',title:'Yield Target Hit: Folks Finance',desc:'ALGO liquid staking APY crossed 9.5% target. DELTA flagging for rebalance.',agent:'DELTA',category:'defi',priority:'medium',read:false},
    ];
    let i = 0;
    const t = setInterval(() => {
      const template = LIVE_ALERTS[i % LIVE_ALERTS.length];
      const now = Date.now();
      setAlerts(prev => [{
        ...template,
        id: `live-${now}`,
        ts: now,
        time: 'just now',
      }, ...prev].slice(0,40));
      i++;
    }, 60000);
    return () => clearInterval(t);
  }, []);

  // ── Mark read ─────────────────────────────────────────────────────────────
  const markRead = (id: string) => setAlerts(prev => prev.map(a => a.id===id ? {...a,read:true} : a));
  const markAllRead = () => setAlerts(prev => prev.map(a => ({...a, read:true})));
  const dismissAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id!==id));

  // ── AI Digest ─────────────────────────────────────────────────────────────
  const generateDigest = async () => {
    setDigestLoading(true); setDigestText('');
    try {
      const ctx = alerts.slice(0,8).map(a=>`[${a.priority.toUpperCase()}] ${a.agent}: ${a.title} — ${a.desc}`).join('\n');
      const prompt = `You are ARIA, the NEXUS FINANCE AI OS. Generate a concise 5-bullet daily digest from these system alerts. Focus on critical risks, opportunities, and actions. Max 150 words total.\n\nAlerts:\n${ctx}`;
      const r = await ai.models.generateContent({model:'gemini-2.0-flash',contents:prompt});
      setDigestText(r.text ?? '');
    } catch {
      setDigestText(`• ⚠️ HIGH PRIORITY: Gearbox TVL drop warrants immediate review of DeFi exposure.\n• ⚡ OPPORTUNITY: Gas window at 0.003 gwei — execute all pending rebalances now.\n• 💹 COMPLETE: DELTA yield migration succeeded (+$1,060/yr improvement).\n• ⬡ ALGO: Network performing well, ASA activity normal on Testnet.\n• 📊 MONITOR: ETH volatility elevated — maintain current RWA hedge allocation.`);
    }
    setDigestLoading(false);
  };

  // ── Create alert ──────────────────────────────────────────────────────────
  const createAlert = () => {
    if (!newTitle) return;
    const now = Date.now();
    setAlerts(prev => [{
      id:`u-${now}`, type:newType, icon:'🔔', title:newTitle,
      desc:newDesc||'User-defined alert.', time:'now',
      ts:now, agent:newAgent, category:newCat,
      priority:'medium', read:false,
    }, ...prev]);
    setNewTitle(''); setNewDesc(''); setShowCreate(false);
  };

  // ── Create rule ───────────────────────────────────────────────────────────
  const createRule = () => {
    if (!ruleCondition) return;
    setRules(prev => [...prev, {
      id:`r-${Date.now()}`, name:`Custom: ${ruleCondition.slice(0,20)}`,
      condition:ruleCondition, threshold:ruleThreshold, agent:ruleAgent, active:true, triggered:0,
    }]);
    setRuleCondition(''); setRuleThreshold(''); setShowRuleForm(false);
  };

  // ── Filtered alerts ───────────────────────────────────────────────────────
  const filtered = alerts
    .filter(a => category==='all' || a.category===category)
    .filter(a => !showUnread || !a.read);

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[26px] font-bold text-wh tracking-[1px]">Smart Alert System</div>
          <p className="text-[12px] text-t2 font-mono">// ARIA monitors 24/7 · On-chain triggers · Custom rules · AI daily digest</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={markAllRead} className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-border2 text-t2 hover:text-wh hover:border-border3 transition-all">
            ✓ Mark All Read
          </button>
          <button onClick={()=>{setDigestOpen(o=>!o);if(!digestText)generateDigest();}}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[rgba(0,229,255,0.3)] text-c1 bg-[rgba(0,229,255,0.08)] hover:bg-[rgba(0,229,255,0.15)] transition-all">
            {digestOpen?'✕ Close Digest':'⚡ AI Daily Digest'}
          </button>
          <button onClick={()=>setShowCreate(s=>!s)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 transition-all">
            {showCreate?'✕ Cancel':'+ Create Alert'}
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Unread Alerts" value={`${unreadCount}`} delta={`${todayCount} today`} variant="o"/>
        <StatCard label="Critical" value={`${criticalCount}`} delta={criticalCount>0?'Action required':'All clear'} variant={criticalCount>0?'o':'g'}/>
        <StatCard label="Active Rules" value={`${activeRules}/${rules.length}`} delta="↑ Monitoring" variant="c"/>
        <StatCard label="Agents Online" value="4" delta="ARIA · DELTA · KAPPA · SIGMA" variant="p"/>
      </div>

      {/* AI Digest */}
      {digestOpen && (
        <Card title="⚡ ARIA Daily Digest" badge={<span className="text-[9px] font-mono text-c1 border border-[rgba(0,229,255,0.2)] px-2 py-0.5 rounded">Gemini Generated</span>}>
          {digestLoading ? (
            <div className="flex items-center gap-2 text-[12px] text-t3 font-mono animate-pulse py-3">
              <span className="w-2 h-2 rounded-full bg-c1 animate-bounce"/>ARIA generating digest...
            </div>
          ) : (
            <div className="text-[12px] text-t1 leading-relaxed whitespace-pre-wrap">{digestText}</div>
          )}
        </Card>
      )}

      {/* Create Alert form */}
      {showCreate && (
        <Card title="Create Custom Alert" badge={<span className="text-[9px] font-mono text-p2">Manual trigger</span>}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Title</div>
              <input value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Alert title..."
                className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[12px] outline-none focus:border-[rgba(168,85,247,0.4)] placeholder:text-t3"/>
            </div>
            <div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Description</div>
              <input value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="Optional description..."
                className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[12px] outline-none focus:border-[rgba(168,85,247,0.4)] placeholder:text-t3"/>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Type</div>
                <select value={newType} onChange={e=>setNewType(e.target.value as AlertType)}
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[12px] outline-none">
                  {(['info','warn','success','critical','algo'] as AlertType[]).map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Category</div>
                <select value={newCat} onChange={e=>setNewCat(e.target.value as AlertCategory)}
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[12px] outline-none">
                  {CATEGORIES.filter(c=>c.id!=='all').map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Agent</div>
                <select value={newAgent} onChange={e=>setNewAgent(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[12px] outline-none">
                  {['ARIA','DELTA','KAPPA','SIGMA'].map(a=><option key={a}>{a}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-end">
              <button onClick={createAlert} className="w-full py-2.5 rounded-lg text-[12px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 transition-all">
                🔔 Create Alert
              </button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Alert Feed */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {CATEGORIES.map(c=>(
              <button key={c.id} onClick={()=>setCategory(c.id)}
                className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border',
                  category===c.id?'border-c1 bg-[rgba(0,229,255,0.12)] text-c1':'border-border-custom text-t2 hover:border-border3 hover:text-wh')}>
                {c.label}
              </button>
            ))}
            <button onClick={()=>setShowUnread(s=>!s)}
              className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ml-auto',
                showUnread?'border-p2 bg-[rgba(168,85,247,0.12)] text-p2':'border-border-custom text-t2 hover:border-border3')}>
              {showUnread?'● Unread Only':'○ Unread Only'}
            </button>
          </div>

          {/* Alert list */}
          <div className="flex flex-col gap-2">
            {filtered.length === 0 ? (
              <div className="bg-[rgba(0,0,0,0.2)] border border-border-custom rounded-xl p-8 text-center">
                <div className="text-3xl mb-2">🔕</div>
                <div className="text-[13px] text-t3 font-mono">No alerts in this category</div>
              </div>
            ) : filtered.map(a=>(
              <div key={a.id}
                onClick={()=>{ setExpandedId(expandedId===a.id?null:a.id); markRead(a.id); }}
                className={cn('rounded-xl border transition-all cursor-pointer hover:scale-[1.003]',
                  typeBg(a.type), !a.read&&'shadow-[0_0_12px_rgba(0,229,255,0.08)]'
                )}>
                <div className="flex gap-3 p-3.5">
                  <div className="text-lg shrink-0 mt-0.5">{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-[13px] font-semibold',a.read?'text-t1':'text-wh')}>{a.title}</span>
                        {!a.read && <span className="w-1.5 h-1.5 rounded-full bg-c1 animate-pulse shrink-0"/>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn('font-mono text-[8px] px-1.5 py-0.5 rounded border uppercase',priorityBadge(a.priority))}>{a.priority}</span>
                        <button onClick={e=>{e.stopPropagation();dismissAlert(a.id);}} className="text-t3 hover:text-r1 w-4 h-4 flex items-center justify-center transition-colors">✕</button>
                      </div>
                    </div>
                    <div className="text-[11px] text-t2 leading-relaxed line-clamp-2">{a.desc}</div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={cn('font-mono text-[9px] font-bold',agentColor(a.agent))}>{a.agent}</span>
                      <span className="font-mono text-[9px] text-t3">·</span>
                      <span className="font-mono text-[9px] text-t3 uppercase tracking-wider">{a.category}</span>
                      <span className="font-mono text-[9px] text-t3">·</span>
                      <span className="font-mono text-[9px] text-t3">{a.time}</span>
                    </div>
                  </div>
                </div>
                {/* Expanded detail */}
                {expandedId===a.id && (
                  <div className="px-4 pb-4 pt-0 border-t border-[rgba(255,255,255,0.05)] mt-1">
                    <div className="text-[12px] text-t1 leading-relaxed mt-3 mb-3">{a.desc}</div>
                    {a.actionLabel && (
                      <button className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[rgba(0,229,255,0.3)] text-c1 bg-[rgba(0,229,255,0.08)] hover:bg-[rgba(0,229,255,0.15)] transition-all">
                        → {a.actionLabel}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-4">
          {/* Automation Rules */}
          <Card title="Automation Rules" badge={
            <button onClick={()=>setShowRuleForm(s=>!s)} className="text-[9px] font-mono text-p2 border border-[rgba(168,85,247,0.2)] px-2 py-0.5 rounded hover:bg-[rgba(168,85,247,0.08)] transition-all">
              {showRuleForm?'✕':'+ Rule'}
            </button>
          }>
            {showRuleForm && (
              <div className="flex flex-col gap-2 mb-3 bg-[rgba(168,85,247,0.04)] border border-[rgba(168,85,247,0.12)] rounded-lg p-3">
                <input value={ruleCondition} onChange={e=>setRuleCondition(e.target.value)} placeholder="Condition (e.g. Gas below)"
                  className="w-full bg-[rgba(0,0,0,0.4)] border border-border2 rounded-lg p-2 text-wh text-[11px] outline-none focus:border-[rgba(168,85,247,0.4)] placeholder:text-t3"/>
                <input value={ruleThreshold} onChange={e=>setRuleThreshold(e.target.value)} placeholder="Threshold (e.g. 0.005 gwei)"
                  className="w-full bg-[rgba(0,0,0,0.4)] border border-border2 rounded-lg p-2 text-wh text-[11px] outline-none focus:border-[rgba(168,85,247,0.4)] placeholder:text-t3"/>
                <select value={ruleAgent} onChange={e=>setRuleAgent(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.4)] border border-border2 rounded-lg p-2 text-wh text-[11px] outline-none">
                  {['ARIA','DELTA','KAPPA','SIGMA'].map(a=><option key={a}>{a}</option>)}
                </select>
                <button onClick={createRule} className="w-full py-2 rounded-lg text-[11px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 transition-all">+ Add Rule</button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {rules.map(r=>(
                <div key={r.id} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border-custom bg-[rgba(0,0,0,0.2)] hover:border-border3 transition-all">
                  <button onClick={()=>setRules(prev=>prev.map(x=>x.id===r.id?{...x,active:!x.active}:x))}
                    className={cn('w-7 h-4 rounded-full transition-all relative shrink-0',r.active?'bg-c1':'bg-border2')}>
                    <span className={cn('absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all',r.active?'left-3.5':'left-0.5')}/>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[11px] text-wh truncate">{r.name}</div>
                    <div className="font-mono text-[9px] text-t3 truncate">{r.condition} {r.threshold}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn('font-mono text-[9px] font-bold',agentColor(r.agent))}>{r.agent}</span>
                    <div className="font-mono text-[8px] text-t3">{r.triggered}x fired</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Agent Status */}
          <Card title="Agent Status">
            <div className="flex flex-col gap-2">
              {[
                {name:'ARIA',  role:'Market Intelligence', active:true,  alerts:12, color:'text-c1'},
                {name:'DELTA', role:'DeFi Yield Router',   active:true,  alerts:8,  color:'text-g1'},
                {name:'KAPPA', role:'Cross-Chain Bridge',  active:true,  alerts:3,  color:'text-p2'},
                {name:'SIGMA', role:'RWA Underwriting',    active:true,  alerts:5,  color:'text-o1'},
              ].map(ag=>(
                <div key={ag.name} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border-custom bg-[rgba(0,0,0,0.2)]">
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 animate-pulse',ag.active?'bg-g1':'bg-r1')}/>
                  <div className="flex-1 min-w-0">
                    <div className={cn('font-mono text-[12px] font-bold',ag.color)}>{ag.name}</div>
                    <div className="font-mono text-[9px] text-t3">{ag.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[11px] text-wh">{ag.alerts}</div>
                    <div className="font-mono text-[8px] text-t3">alerts/day</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Algorand On-chain events */}
          <Card title="⬡ Algorand Live Events" badge={<span className="text-[9px] font-mono text-c1 border border-[rgba(0,229,255,0.2)] px-2 py-0.5 rounded">TESTNET</span>}>
            {algoEvents.length === 0 ? (
              <div className="text-[11px] text-t3 font-mono text-center py-3 animate-pulse">Monitoring Algorand...</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {algoEvents.map((ev,i)=>(
                  <div key={i} className="flex items-center gap-2 bg-[rgba(0,229,255,0.03)] border border-[rgba(0,229,255,0.1)] rounded-lg px-3 py-2">
                    <span className="text-c1">⬡</span>
                    <span className="font-mono text-[9px] text-c1 uppercase bg-[rgba(0,229,255,0.1)] border border-[rgba(0,229,255,0.15)] px-1.5 py-0.5 rounded">{ev.type}</span>
                    <span className="font-mono text-[10px] text-wh flex-1">{ev.hash}...</span>
                    <span className="font-mono text-[9px] text-t3">{ev.ts}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Alert stats chart */}
          <Card title="Alert Activity (7d)">
            <div className="flex items-end gap-1.5 h-20">
              {[4,7,3,9,5,11,unreadCount+3].map((v,i)=>(
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                  <div className="w-full rounded-t-sm transition-all duration-700"
                    style={{height:`${(v/12)*100}%`,background:i===6?'linear-gradient(to top,var(--color-p1),var(--color-c1))':'var(--color-border3)'}}/>
                  <span className="font-mono text-[8px] text-t3">{['M','T','W','T','F','S','T'][i]}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
