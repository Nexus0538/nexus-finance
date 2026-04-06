import React, { useState, useEffect } from 'react';
import { Card } from '@/components/UI';
import { cn } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis
} from 'recharts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

interface Asset {
  id: string; name: string; type: string; location: string; flag: string;
  totalValue: number; funded: number; apy: number; grade: string;
  maturity: string; maturityDays: number; minInvest: number; color: string;
  risk: number; liquidity: 'High' | 'Medium' | 'Low'; sector: string;
  issuer: string; asaId: string; verified: boolean; trending: boolean;
}

const ASSETS: Asset[] = [
  { id:'a1', name:'Infosys Invoice #1089',      type:'Invoice',    location:'Mumbai',    flag:'🇮🇳', totalValue:120000,   funded:78, apy:9.2,  grade:'A+',  maturity:'42 days',    maturityDays:42,   minInvest:100,   color:'#00e5ff', risk:18, liquidity:'High',   sector:'Tech',    issuer:'Infosys Ltd',       asaId:'981234501', verified:true,  trending:true  },
  { id:'a2', name:'Chennai Warehouse Complex',  type:'Real Estate',location:'Chennai',   flag:'🇮🇳', totalValue:5000000,  funded:62, apy:7.8,  grade:'A',   maturity:'60 months',  maturityDays:1800, minInvest:1000,  color:'#00ff9d', risk:31, liquidity:'Low',    sector:'Infra',   issuer:'TN Realty REIT',    asaId:'981234502', verified:true,  trending:false },
  { id:'a3', name:'TCS Export Receivable',      type:'Receivable', location:'Pune',      flag:'🇮🇳', totalValue:450000,   funded:91, apy:11.2, grade:'AA',  maturity:'30 days',    maturityDays:30,   minInvest:500,   color:'#a855f7', risk:12, liquidity:'High',   sector:'Tech',    issuer:'Tata Consultancy',  asaId:'981234503', verified:true,  trending:true  },
  { id:'a4', name:'Mumbai Port Logistics',      type:'Infra Bond', location:'Mumbai',    flag:'🇮🇳', totalValue:8000000,  funded:34, apy:6.4,  grade:'A-',  maturity:'120 months', maturityDays:3600, minInvest:5000,  color:'#ff6b00', risk:42, liquidity:'Low',    sector:'Infra',   issuer:'JNPT Authority',    asaId:'981234504', verified:true,  trending:false },
  { id:'a5', name:'Wipro AR Pool Q4',           type:'AR Pool',    location:'Bangalore', flag:'🇮🇳', totalValue:290000,   funded:55, apy:10.1, grade:'A+',  maturity:'28 days',    maturityDays:28,   minInvest:250,   color:'#ffd600', risk:22, liquidity:'Medium', sector:'Tech',    issuer:'Wipro Ltd',         asaId:'981234505', verified:true,  trending:true  },
  { id:'a6', name:'Delhi Metro Bond 2025',      type:'Muni Bond',  location:'Delhi',     flag:'🇮🇳', totalValue:20000000, funded:22, apy:5.8,  grade:'AA-', maturity:'84 months',  maturityDays:2520, minInvest:10000, color:'#00e5ff', risk:9,  liquidity:'Medium', sector:'Govt',    issuer:'DMRC Ltd',          asaId:'981234506', verified:true,  trending:false },
  { id:'a7', name:'Bangalore Tech Park REIT',   type:'Real Estate',location:'Bangalore', flag:'🇮🇳', totalValue:12000000, funded:47, apy:8.6,  grade:'A',   maturity:'36 months',  maturityDays:1080, minInvest:2000,  color:'#00ff9d', risk:27, liquidity:'Medium', sector:'Real Est',issuer:'Embassy Group',      asaId:'981234507', verified:false, trending:true  },
  { id:'a8', name:'SME Invoice Bundle #44',     type:'Invoice',    location:'Hyderabad', flag:'🇮🇳', totalValue:75000,    funded:88, apy:13.4, grade:'B+',  maturity:'21 days',    maturityDays:21,   minInvest:50,    color:'#ff2255', risk:58, liquidity:'High',   sector:'SME',     issuer:'Multi-originator',  asaId:'981234508', verified:true,  trending:false },
];

const GRADE_STYLE: Record<string,string> = {
  'AA': 'text-g1 bg-[rgba(0,255,157,0.1)] border-[rgba(0,255,157,0.3)]',
  'AA-':'text-g1 bg-[rgba(0,255,157,0.08)] border-[rgba(0,255,157,0.2)]',
  'A+': 'text-c1 bg-[rgba(0,229,255,0.08)] border-[rgba(0,229,255,0.25)]',
  'A':  'text-c1 bg-[rgba(0,229,255,0.06)] border-[rgba(0,229,255,0.15)]',
  'A-': 'text-t1 bg-[rgba(255,255,255,0.05)] border-border-custom',
  'B+': 'text-o1 bg-[rgba(255,107,0,0.08)] border-[rgba(255,107,0,0.25)]',
};

const LIQ_STYLE: Record<string,string> = {
  High:'text-g1 bg-[rgba(0,255,157,0.08)] border-[rgba(0,255,157,0.2)]',
  Medium:'text-gold bg-[rgba(255,214,0,0.08)] border-[rgba(255,214,0,0.2)]',
  Low:'text-r1 bg-[rgba(255,34,85,0.08)] border-[rgba(255,34,85,0.2)]',
};

const RISK_COLOR = (r: number) => r < 25 ? '#00ff9d' : r < 50 ? '#ffd600' : '#ff2255';

const genYield = (apy: number) =>
  Array.from({ length: 12 }, (_, i) => ({
    m: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
    yield: +(apy * (0.85 + i * 0.012 + Math.random() * 0.06)).toFixed(2),
    cumulative: +(apy * (i + 1) / 12).toFixed(2),
  }));

const RiskBar: React.FC<{ value: number }> = ({ value }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-border-custom rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, backgroundColor: RISK_COLOR(value), boxShadow: `0 0 6px ${RISK_COLOR(value)}` }} />
    </div>
    <span className="text-[10px] font-mono w-5" style={{ color: RISK_COLOR(value) }}>{value}</span>
  </div>
);

const MiniSparkline: React.FC<{ apy: number; color: string }> = ({ apy, color }) => {
  const d = Array.from({ length: 8 }, (_, i) => ({ v: apy * (0.9 + i * 0.015 + Math.random() * 0.04) }));
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={d} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={`sg${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#sg${color.replace('#','')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const RWAInvestor: React.FC = () => {
  const [invested, setInvested] = useState<Record<string, number>>({ a1: 5000, a3: 2500, a5: 1000 });
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState<'apy' | 'risk' | 'funded' | 'value'>('apy');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [modal, setModal] = useState<Asset | null>(null);
  const [investAmt, setInvestAmt] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio' | 'analytics'>('market');
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [successTx, setSuccessTx] = useState('');
  const [pulse, setPulse] = useState(false);

  useEffect(() => { const t = setInterval(() => setPulse(p => !p), 1800); return () => clearInterval(t); }, []);

  const myPositions = ASSETS.filter(a => invested[a.id]);
  const totalInvested = Object.values(invested).reduce((s, v) => s + v, 0);
  const weightedApy = Object.entries(invested).reduce((s, [id, amt]) => {
    const a = ASSETS.find(x => x.id === id); return s + (a ? a.apy * amt : 0);
  }, 0) / (totalInvested || 1);
  const estAnnual = totalInvested * weightedApy / 100;
  const avgRisk = myPositions.reduce((s, a) => s + a.risk, 0) / (myPositions.length || 1);

  const types = ['all', ...Array.from(new Set(ASSETS.map(a => a.type)))];
  const filtered = ASSETS
    .filter(a => filterType === 'all' || a.type === filterType)
    .sort((a, b) => {
      const map = { apy: [a.apy, b.apy], risk: [a.risk, b.risk], funded: [a.funded, b.funded], value: [a.totalValue, b.totalValue] };
      const [av, bv] = map[sortBy];
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  const pieData = myPositions.map(a => ({ name: a.name.split(' ').slice(0, 2).join(' '), value: invested[a.id] ?? 0, color: a.color }));
  const sectorData = Object.entries(
    myPositions.reduce((acc, a) => { acc[a.sector] = (acc[a.sector] ?? 0) + (invested[a.id] ?? 0); return acc; }, {} as Record<string, number>)
  ).map(([s, v]) => ({ sector: s, value: v }));

  const radarData = myPositions.map(a => ({
    asset: a.name.split(' ')[0],
    APY: a.apy * 8, Risk: 100 - a.risk, Liquidity: a.liquidity === 'High' ? 90 : a.liquidity === 'Medium' ? 60 : 30,
    Funded: a.funded, Grade: a.grade === 'AA' ? 95 : a.grade.startsWith('A+') ? 85 : 70,
  }));

  const doInvest = () => {
    const amt = parseFloat(investAmt);
    if (!modal || isNaN(amt) || amt < modal.minInvest) return;
    setInvested(p => ({ ...p, [modal.id]: (p[modal.id] ?? 0) + amt }));
    const fakeTx = `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    setSuccessTx(fakeTx);
    setTimeout(() => { setModal(null); setInvestAmt(''); setSuccessTx(''); }, 3000);
  };

  const getAiInsight = async () => {
    setAiLoading(true); setAiInsight('');
    try {
      const prompt = `You are SIGMA, an AI underwriting agent for Algorand RWA tokenization.
Portfolio: $${totalInvested.toLocaleString()} across ${myPositions.length} assets.
Weighted APY: ${weightedApy.toFixed(1)}% | Avg risk score: ${avgRisk.toFixed(0)}/100 | Est. annual income: $${estAnnual.toFixed(0)}
Assets: ${myPositions.map(a => `${a.name} (${a.apy}% APY, grade ${a.grade}, risk ${a.risk})`).join('; ')}
Available high-yield assets not yet in portfolio: ${ASSETS.filter(a => !invested[a.id] && a.apy > 8).map(a => a.name + ' ' + a.apy + '%').join(', ')}
Give: 1) 2-sentence portfolio assessment, 2) One rebalancing recommendation, 3) Best new asset to add and why. Keep it to 4 sentences max.`;
      const r = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      setAiInsight(r.text ?? '');
    } catch { setAiInsight('SIGMA: Unable to connect. Check GEMINI_API_KEY.'); }
    setAiLoading(false);
  };

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  return (
    <div className="p-5 flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="font-display text-[28px] font-bold text-wh tracking-[1px]">RWA Investor</div>
            <span className="px-2 py-0.5 rounded-md border border-[rgba(255,107,0,0.3)] bg-[rgba(255,107,0,0.06)] font-mono text-[9px] text-o1 tracking-widest">ALGORAND ASA</span>
            <span className="px-2 py-0.5 rounded-md border border-[rgba(0,255,157,0.3)] bg-[rgba(0,255,157,0.06)] font-mono text-[9px] text-g1 tracking-widest animate-pulse">● LIVE</span>
          </div>
          <p className="text-[12px] text-t2 font-mono">// Tokenized real-world assets · Fractional ownership · Algorand settlement</p>
        </div>
        <button onClick={getAiInsight} disabled={aiLoading}
          className="px-4 py-2 rounded-xl text-[12px] font-bold bg-gradient-to-r from-o1 to-p1 text-white hover:opacity-90 hover:scale-105 disabled:opacity-60 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,107,0,0.2)]">
          {aiLoading ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyzing...</> : '🤖 SIGMA AI Insight'}
        </button>
      </div>

      {/* AI Insight */}
      {aiInsight && (
        <div className="bg-[rgba(255,107,0,0.03)] border border-[rgba(255,107,0,0.15)] rounded-2xl px-5 py-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-o1 animate-pulse" />
            <span className="font-mono text-[9px] text-o1 uppercase tracking-widest">📊 SIGMA Agent · Portfolio Analysis</span>
          </div>
          <p className="text-[12px] text-t1 leading-relaxed">{aiInsight}</p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Invested', value: `$${totalInvested.toLocaleString()}`, sub: `${myPositions.length} positions`, color: 'text-c1', glow: 'rgba(0,229,255,0.15)', icon: '💼' },
          { label: 'Weighted APY',   value: `${weightedApy.toFixed(1)}%`,        sub: 'Blended yield',                 color: 'text-g1', glow: 'rgba(0,255,157,0.15)', icon: '📈' },
          { label: 'Est. Annual',    value: `$${estAnnual.toFixed(0)}`,           sub: `~$${(estAnnual/12).toFixed(0)}/mo`, color: 'text-o1', glow: 'rgba(255,107,0,0.15)', icon: '💰' },
          { label: 'Portfolio Risk', value: `${avgRisk.toFixed(0)}/100`,          sub: avgRisk < 30 ? 'Low Risk' : avgRisk < 55 ? 'Moderate' : 'High Risk', color: avgRisk < 30 ? 'text-g1' : avgRisk < 55 ? 'text-gold' : 'text-r1', glow: 'rgba(168,85,247,0.15)', icon: '🛡' },
        ].map((s, i) => (
          <div key={i} className="relative rounded-2xl border border-border-custom bg-[rgba(0,0,0,0.25)] p-4 overflow-hidden group hover:border-border2 transition-all"
            style={{ boxShadow: `0 0 20px ${s.glow}` }}>
            <div className="absolute top-3 right-3 text-2xl opacity-20 group-hover:opacity-40 transition-opacity">{s.icon}</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-t3 mb-1">{s.label}</div>
            <div className={cn('font-display text-[26px] font-bold leading-none', s.color)}>{s.value}</div>
            <div className="text-[10px] text-t3 mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 p-1 bg-[rgba(0,0,0,0.3)] rounded-xl border border-border-custom w-fit">
        {(['market', 'portfolio', 'analytics'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn('px-5 py-2 rounded-lg text-[12px] font-semibold capitalize transition-all duration-150',
              activeTab === t ? 'bg-[rgba(255,107,0,0.12)] text-o1 border border-[rgba(255,107,0,0.25)]' : 'text-t3 hover:text-t2')}>
            {t === 'market' ? '🏪 Market' : t === 'portfolio' ? '💼 Portfolio' : '📊 Analytics'}
          </button>
        ))}
      </div>

      {/* ── MARKET TAB ── */}
      {activeTab === 'market' && (
        <div className="flex flex-col gap-4">
          {/* Filters + Sort */}
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap gap-1.5">
              {types.map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={cn('px-2.5 py-1 rounded-lg border text-[10px] font-semibold capitalize transition-all',
                    filterType === t ? 'border-o1 bg-[rgba(255,107,0,0.1)] text-o1' : 'border-border-custom text-t3 hover:text-t2')}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-t3 font-mono">Sort:</span>
              {(['apy', 'risk', 'funded', 'value'] as const).map(k => (
                <button key={k} onClick={() => toggleSort(k)}
                  className={cn('px-2 py-1 rounded-lg border text-[10px] font-mono capitalize transition-all',
                    sortBy === k ? 'border-c1 text-c1 bg-[rgba(0,229,255,0.06)]' : 'border-border-custom text-t3 hover:text-t2')}>
                  {k} {sortBy === k ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </button>
              ))}
              <div className="flex border border-border-custom rounded-lg overflow-hidden">
                {(['grid', 'list'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={cn('px-2.5 py-1 text-[11px] transition-all', view === v ? 'bg-[rgba(0,229,255,0.1)] text-c1' : 'text-t3 hover:text-t2')}>
                    {v === 'grid' ? '⊞' : '☰'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trending Banner */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {ASSETS.filter(a => a.trending).map(a => (
              <div key={a.id} onClick={() => setModal(a)}
                className="flex-shrink-0 flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all hover:scale-105"
                style={{ borderColor: a.color + '44', background: a.color + '08' }}>
                <span className="text-base">{a.flag}</span>
                <div>
                  <div className="text-[11px] font-semibold text-t1 whitespace-nowrap">{a.name.split(' ').slice(0, 3).join(' ')}</div>
                  <div className="text-[10px] font-mono" style={{ color: a.color }}>🔥 {a.apy}% APY</div>
                </div>
              </div>
            ))}
          </div>

          {/* Asset Grid / List */}
          {view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(asset => {
                const myAmt = invested[asset.id] ?? 0;
                const isOwned = myAmt > 0;
                return (
                  <div key={asset.id}
                    className={cn('rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-200 group hover:scale-[1.01]',
                      isOwned ? 'border-[rgba(0,229,255,0.2)] bg-[rgba(0,229,255,0.03)]' : 'border-border-custom bg-[rgba(0,0,0,0.2)] hover:border-border2')}
                    style={isOwned ? { boxShadow: '0 0 20px rgba(0,229,255,0.05)' } : {}}>

                    {/* Card Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-base">{asset.flag}</span>
                          <span className="font-semibold text-wh text-[13px] truncate">{asset.name}</span>
                          {asset.trending && <span className="text-[9px] text-o1">🔥</span>}
                          {!asset.verified && <span className="text-[8px] text-gold border border-gold/30 px-1 rounded">UNVERIFIED</span>}
                        </div>
                        <div className="font-mono text-[9px] text-t3">{asset.type} · {asset.location} · ASA {asset.asaId}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={cn('font-mono text-[9px] px-1.5 py-0.5 rounded-md border', GRADE_STYLE[asset.grade] ?? '')}>{asset.grade}</span>
                        <span className={cn('font-mono text-[8px] px-1.5 py-0.5 rounded-md border', LIQ_STYLE[asset.liquidity])}>{asset.liquidity}</span>
                      </div>
                    </div>

                    {/* Sparkline */}
                    <MiniSparkline apy={asset.apy} color={asset.color} />

                    {/* Funding Bar */}
                    <div>
                      <div className="flex justify-between text-[9px] font-mono mb-1">
                        <span className="text-t3">{asset.funded}% funded</span>
                        <span className="text-t2">${(asset.totalValue / 1000).toFixed(0)}K total</span>
                      </div>
                      <div className="h-1.5 bg-border-custom rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${asset.funded}%`, backgroundColor: asset.color, boxShadow: `0 0 8px ${asset.color}` }} />
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-1.5 text-center">
                      {[
                        { l: 'APY',  v: `${asset.apy}%`,                    c: 'text-g1' },
                        { l: 'Mat.', v: asset.maturity,                      c: 'text-c1' },
                        { l: 'Min',  v: `$${(asset.minInvest).toLocaleString()}`, c: 'text-t1' },
                        { l: 'Risk', v: `${asset.risk}`,                     c: RISK_COLOR(asset.risk) },
                      ].map(stat => (
                        <div key={stat.l} className="bg-[rgba(0,0,0,0.25)] rounded-lg py-1.5">
                          <div className={cn('font-mono text-[11px] font-bold', stat.l !== 'Risk' ? stat.c : '')}
                            style={stat.l === 'Risk' ? { color: RISK_COLOR(asset.risk) } : {}}>
                            {stat.v}
                          </div>
                          <div className="font-mono text-[8px] text-t3 uppercase">{stat.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* Risk bar */}
                    <RiskBar value={asset.risk} />

                    {/* Owned label */}
                    {isOwned && (
                      <div className="flex items-center justify-between text-[11px] bg-[rgba(0,229,255,0.05)] border border-[rgba(0,229,255,0.1)] rounded-lg px-2.5 py-1.5">
                        <span className="text-c1 font-mono font-bold">✅ ${myAmt.toLocaleString()}</span>
                        <span className="text-g1 font-mono">+${(myAmt * asset.apy / 100 / 12).toFixed(2)}/mo</span>
                      </div>
                    )}

                    {/* CTA */}
                    <button onClick={() => setModal(asset)}
                      className="w-full py-2.5 rounded-xl text-[12px] font-bold border transition-all duration-200 hover:scale-105"
                      style={{
                        borderColor: asset.color + '55', color: asset.color,
                        background: asset.color + '0f',
                        boxShadow: `0 0 12px ${asset.color}15`
                      }}>
                      {isOwned ? '+ Add More' : '💎 Invest Now'}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_120px] gap-2 px-3 py-2 text-[9px] font-mono uppercase tracking-widest text-t3 border-b border-border-custom">
                <span>Asset</span><span>Type</span><span>APY</span><span>Grade</span><span>Risk</span><span>Funded</span><span className="text-right">Action</span>
              </div>
              {filtered.map(asset => {
                const myAmt = invested[asset.id] ?? 0;
                return (
                  <div key={asset.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_120px] gap-2 items-center px-3 py-3 rounded-xl border border-border-custom hover:border-border2 bg-[rgba(0,0,0,0.15)] hover:bg-[rgba(0,0,0,0.25)] transition-all text-[12px]">
                    <div>
                      <div className="font-semibold text-wh truncate">{asset.name}</div>
                      <div className="text-[9px] text-t3 font-mono">{asset.flag} {asset.location}</div>
                    </div>
                    <span className="text-t2 text-[10px]">{asset.type}</span>
                    <span className="font-mono font-bold text-g1">{asset.apy}%</span>
                    <span className={cn('font-mono text-[9px] px-1.5 py-0.5 rounded border w-fit', GRADE_STYLE[asset.grade] ?? '')}>{asset.grade}</span>
                    <div className="w-20"><RiskBar value={asset.risk} /></div>
                    <div>
                      <div className="h-1 bg-border-custom rounded-full overflow-hidden mb-0.5">
                        <div className="h-full rounded-full" style={{ width: `${asset.funded}%`, backgroundColor: asset.color }} />
                      </div>
                      <span className="text-[9px] text-t3 font-mono">{asset.funded}%</span>
                    </div>
                    <button onClick={() => setModal(asset)}
                      className="py-1.5 px-3 rounded-lg border text-[11px] font-bold transition-all hover:scale-105 text-right"
                      style={{ borderColor: asset.color + '44', color: asset.color, background: asset.color + '0d' }}>
                      {myAmt > 0 ? `✅ $${myAmt.toLocaleString()}` : 'Invest'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PORTFOLIO TAB ── */}
      {activeTab === 'portfolio' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          <div className="flex flex-col gap-4">
            <Card title="💼 My Positions">
              {myPositions.length === 0 ? (
                <div className="text-center py-10 text-t3 font-mono text-[12px]">No investments yet. Go to Market to invest.</div>
              ) : myPositions.map(a => {
                const amt = invested[a.id] ?? 0;
                const monthly = amt * a.apy / 100 / 12;
                const pct = amt / totalInvested * 100;
                return (
                  <div key={a.id} className="rounded-xl border border-border-custom p-4 mb-3 last:mb-0 hover:border-border2 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg border flex items-center justify-center text-lg"
                          style={{ borderColor: a.color + '44', background: a.color + '0d' }}>
                          {a.flag}
                        </div>
                        <div>
                          <div className="font-semibold text-wh text-[13px]">{a.name}</div>
                          <div className="text-[10px] text-t3 font-mono">{a.type} · Maturity: {a.maturity}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-[18px] font-bold" style={{ color: a.color }}>${amt.toLocaleString()}</div>
                        <div className="text-[10px] text-g1 font-mono">+${monthly.toFixed(2)}/mo</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center mb-3">
                      {[
                        { l: 'APY', v: `${a.apy}%`, c: 'text-g1' },
                        { l: 'Portfolio %', v: `${pct.toFixed(1)}%`, c: 'text-c1' },
                        { l: 'Ann. Return', v: `$${(amt * a.apy / 100).toFixed(0)}`, c: 'text-o1' },
                        { l: 'Grade', v: a.grade, c: 'text-p2' },
                      ].map(s => (
                        <div key={s.l} className="bg-[rgba(0,0,0,0.2)] rounded-lg py-2">
                          <div className={cn('font-mono text-[13px] font-bold', s.c)}>{s.v}</div>
                          <div className="text-[8px] text-t3 font-mono uppercase">{s.l}</div>
                        </div>
                      ))}
                    </div>
                    <div className="h-1.5 bg-border-custom rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: a.color, boxShadow: `0 0 8px ${a.color}` }} />
                    </div>
                  </div>
                );
              })}
            </Card>

            {/* Yield Projection Chart */}
            {myPositions.length > 0 && (
              <Card title="📈 12-Month Cumulative Yield Projection">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={genYield(weightedApy)}>
                      <defs>
                        <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff9d" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00ff9d" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#00e5ff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="m" tick={{ fill: 'var(--color-t3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--color-t3)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border-custom)', borderRadius: '10px', fontSize: 11 }}
                        formatter={(v: number, n: string) => [`${v.toFixed(2)}%`, n]} />
                      <Area type="monotone" dataKey="yield" name="Monthly Yield" stroke="#00ff9d" strokeWidth={2} fill="url(#yieldGrad)" />
                      <Area type="monotone" dataKey="cumulative" name="Cumulative" stroke="#00e5ff" strokeWidth={1.5} fill="url(#cumGrad)" strokeDasharray="4 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-4">
            {myPositions.length > 0 && (
              <Card title="🥧 Allocation">
                <div className="flex justify-center mb-3">
                  <div className="w-32 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={32} outerRadius={58} paddingAngle={3} dataKey="value">
                          {pieData.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => [`$${v.toLocaleString()}`, 'Invested']}
                          contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border-custom)', borderRadius: '8px', fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] py-1.5 border-b border-border-custom last:border-none">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-t1 flex-1 truncate">{d.name}</span>
                    <span className="font-mono text-wh">${d.value.toLocaleString()}</span>
                    <span className="font-mono text-[10px] text-t3">{(d.value / totalInvested * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </Card>
            )}

            <Card title="🔗 On-Chain Details">
              {[
                { k: 'Standard', v: 'Algorand ASA' },
                { k: 'Network',  v: 'Testnet → Mainnet' },
                { k: 'Settlement', v: '< 4 seconds' },
                { k: 'Custody',  v: 'Self-custody (Pera)' },
                { k: 'Compliance', v: 'SEBI DeFi Circular' },
                { k: 'Agent',    v: 'SIGMA Underwriting' },
                { k: 'Auditor',  v: 'CertiK + Nexus AI' },
              ].map(({ k, v }) => (
                <div key={k} className="flex justify-between text-[12px] py-2 border-b border-border-custom last:border-none">
                  <span className="text-t3">{k}</span>
                  <span className="text-c1 font-mono">{v}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      )}

      {/* ── ANALYTICS TAB ── */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* APY vs Risk scatter style bar */}
          <Card title="📊 APY vs Risk Comparison">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ASSETS.map(a => ({ name: a.name.split(' ')[0], apy: a.apy, risk: a.risk }))} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--color-t3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--color-t3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border-custom)', borderRadius: '8px', fontSize: 11 }} />
                  <Bar dataKey="apy" name="APY %" fill="#00ff9d" radius={[4, 4, 0, 0]} opacity={0.85} />
                  <Bar dataKey="risk" name="Risk Score" fill="#ff2255" radius={[4, 4, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Sector breakdown */}
          {sectorData.length > 0 && (
            <Card title="🏭 Sector Allocation">
              <div className="flex items-center gap-4">
                <div className="w-32 h-32 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sectorData} cx="50%" cy="50%" outerRadius={55} dataKey="value">
                        {sectorData.map((_, i) => <Cell key={i} fill={['#00e5ff', '#00ff9d', '#a855f7', '#ff6b00', '#ffd600'][i % 5]} stroke="none" />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  {sectorData.map((s, i) => (
                    <div key={s.sector}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-t1">{s.sector}</span>
                        <span className="font-mono text-wh">{(s.value / totalInvested * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-border-custom rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${s.value / totalInvested * 100}%`,
                          backgroundColor: ['#00e5ff', '#00ff9d', '#a855f7', '#ff6b00', '#ffd600'][i % 5]
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Risk heatmap */}
          <Card title="🌡 Asset Risk Heatmap">
            <div className="grid grid-cols-4 gap-2">
              {ASSETS.map(a => (
                <div key={a.id} title={`${a.name}\nRisk: ${a.risk}`}
                  className="rounded-xl p-3 text-center cursor-pointer hover:scale-105 transition-all"
                  style={{ background: `${RISK_COLOR(a.risk)}15`, border: `1px solid ${RISK_COLOR(a.risk)}33` }}>
                  <div className="text-[9px] font-mono text-t2 truncate mb-1">{a.name.split(' ')[0]}</div>
                  <div className="text-[16px] font-bold font-mono" style={{ color: RISK_COLOR(a.risk) }}>{a.risk}</div>
                  <div className="text-[8px] text-t3 font-mono">{a.grade}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Key metrics */}
          <Card title="📋 Portfolio Metrics">
            {[
              { k: 'Sharpe Ratio (est.)', v: (weightedApy / (avgRisk * 0.1 + 2)).toFixed(2), good: true },
              { k: 'Portfolio Diversification', v: myPositions.length >= 3 ? 'Well Diversified' : 'Concentrate', good: myPositions.length >= 3 },
              { k: 'Shortest Maturity', v: myPositions.length > 0 ? `${Math.min(...myPositions.map(a => a.maturityDays))} days` : 'N/A', good: true },
              { k: 'Longest Maturity', v: myPositions.length > 0 ? `${Math.max(...myPositions.map(a => a.maturityDays))} days` : 'N/A', good: true },
              { k: 'High Liquidity Assets', v: `${myPositions.filter(a => a.liquidity === 'High').length}/${myPositions.length}`, good: true },
              { k: 'Verified Issuers', v: `${myPositions.filter(a => a.verified).length}/${myPositions.length}`, good: myPositions.every(a => a.verified) },
              { k: 'Est. Monthly Income', v: `$${(estAnnual / 12).toFixed(2)}`, good: true },
              { k: 'Avg. Credit Grade', v: myPositions.length > 0 ? myPositions[0]?.grade ?? '-' : 'N/A', good: true },
            ].map(({ k, v, good }) => (
              <div key={k} className="flex justify-between items-center text-[12px] py-2 border-b border-border-custom last:border-none">
                <span className="text-t3">{k}</span>
                <span className={cn('font-mono font-semibold', good ? 'text-c1' : 'text-gold')}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* ── INVEST MODAL ── */}
      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(0,0,0,0.75)] backdrop-blur-md"
          onClick={() => { setModal(null); setInvestAmt(''); setSuccessTx(''); }}>
          <div className="bg-[rgba(5,10,18,0.98)] border border-border3 rounded-2xl p-6 w-full max-w-md mx-4 shadow-[0_0_60px_rgba(0,229,255,0.1)]"
            onClick={e => e.stopPropagation()}>

            {successTx ? (
              <div className="text-center py-6 animate-in fade-in zoom-in duration-300">
                <div className="text-5xl mb-4">✅</div>
                <div className="font-display text-[20px] font-bold text-g1 mb-1">Investment Confirmed!</div>
                <div className="text-[12px] text-t2 mb-3">Transaction submitted to Algorand via Pera Wallet</div>
                <div className="bg-[rgba(0,255,157,0.06)] border border-[rgba(0,255,157,0.2)] rounded-xl px-4 py-3">
                  <div className="text-[9px] font-mono text-t3 uppercase tracking-widest mb-1">Transaction ID</div>
                  <div className="font-mono text-[13px] text-g1">{successTx}</div>
                </div>
              </div>
            ) : (
              <>
                {/* Modal header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border"
                    style={{ borderColor: modal.color + '44', background: modal.color + '0d' }}>
                    {modal.flag}
                  </div>
                  <div className="flex-1">
                    <div className="font-display text-[17px] font-bold text-wh">{modal.name}</div>
                    <div className="text-[11px] text-t3 font-mono">{modal.type} · {modal.location} · ASA {modal.asaId}</div>
                  </div>
                  <button onClick={() => { setModal(null); setInvestAmt(''); }}
                    className="text-t3 hover:text-wh text-xl transition-colors">✕</button>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-2 mb-4 text-center">
                  {[
                    { l: 'APY', v: `${modal.apy}%`, c: 'text-g1' },
                    { l: 'Grade', v: modal.grade, c: 'text-c1' },
                    { l: 'Maturity', v: modal.maturity, c: 'text-p2' },
                    { l: 'Min', v: `$${modal.minInvest.toLocaleString()}`, c: 'text-o1' },
                  ].map(s => (
                    <div key={s.l} className="bg-[rgba(0,0,0,0.3)] rounded-xl py-2.5">
                      <div className={cn('font-mono text-[14px] font-bold', s.c)}>{s.v}</div>
                      <div className="text-[8px] text-t3 font-mono uppercase">{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Risk */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] font-mono text-t3 mb-1">
                    <span>Risk Score</span><span style={{ color: RISK_COLOR(modal.risk) }}>{modal.risk}/100</span>
                  </div>
                  <RiskBar value={modal.risk} />
                </div>

                {/* Mini sparkline in modal */}
                <div className="mb-4 rounded-xl border border-border-custom overflow-hidden bg-[rgba(0,0,0,0.2)] p-2">
                  <div className="text-[9px] font-mono text-t3 mb-1 uppercase tracking-widest">Yield Trend (simulated)</div>
                  <MiniSparkline apy={modal.apy} color={modal.color} />
                </div>

                {/* Amount input */}
                <div className="mb-2">
                  <label className="text-[10px] font-mono uppercase tracking-widest text-t3 block mb-1.5">Investment Amount (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-t3 font-mono">$</span>
                    <input type="number" value={investAmt} onChange={e => setInvestAmt(e.target.value)}
                      placeholder={modal.minInvest.toString()}
                      className="w-full bg-[rgba(0,0,0,0.4)] border border-border-custom rounded-xl pl-7 pr-3 py-3 text-[14px] font-mono text-wh placeholder:text-t3 outline-none focus:border-c1 transition-colors" />
                  </div>
                </div>

                {/* Quick amounts */}
                <div className="flex gap-1.5 mb-4">
                  {[modal.minInvest, modal.minInvest * 5, modal.minInvest * 10, modal.minInvest * 50].map(amt => (
                    <button key={amt} onClick={() => setInvestAmt(amt.toString())}
                      className="flex-1 py-1.5 rounded-lg border border-border-custom text-[10px] font-mono text-t3 hover:text-c1 hover:border-[rgba(0,229,255,0.3)] transition-all">
                      ${amt >= 1000 ? `${(amt/1000).toFixed(0)}K` : amt}
                    </button>
                  ))}
                </div>

                {/* Projection */}
                {investAmt && !isNaN(+investAmt) && +investAmt >= modal.minInvest && (
                  <div className="bg-[rgba(0,255,157,0.04)] border border-[rgba(0,255,157,0.15)] rounded-xl p-3 mb-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { l: 'Monthly', v: `$${(+investAmt * modal.apy / 100 / 12).toFixed(2)}` },
                        { l: 'Annual', v: `$${(+investAmt * modal.apy / 100).toFixed(2)}` },
                        { l: 'At Maturity', v: `$${(+investAmt * (1 + modal.apy / 100 * modal.maturityDays / 365)).toFixed(0)}` },
                      ].map(p => (
                        <div key={p.l}>
                          <div className="text-[13px] font-bold font-mono text-g1">{p.v}</div>
                          <div className="text-[9px] font-mono text-t3 uppercase">{p.l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => { setModal(null); setInvestAmt(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-border-custom text-t2 text-[12px] font-semibold hover:text-wh transition-colors">
                    Cancel
                  </button>
                  <button onClick={doInvest}
                    disabled={!investAmt || isNaN(+investAmt) || +investAmt < modal.minInvest}
                    className="flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: `linear-gradient(135deg, ${modal.color}, #00ff9d)`, color: '#000' }}>
                    💎 Invest via Pera
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
