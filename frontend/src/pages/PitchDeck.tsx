import React, { useState, useEffect } from 'react';
import { Card } from '@/components/UI';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';

// ── Data ──────────────────────────────────────────────────────────────────────
const MARKET_DATA = [
  { year: '2024', tam: 120,  sam: 18,  som: 0.4  },
  { year: '2025', tam: 280,  sam: 42,  som: 1.2  },
  { year: '2026', tam: 680,  sam: 102, som: 3.8  },
  { year: '2027', tam: 1400, sam: 210, som: 9.2  },
  { year: '2028', tam: 2600, sam: 390, som: 22.4 },
  { year: '2029', tam: 4100, sam: 615, som: 48.0 },
  { year: '2030', tam: 5000, sam: 750, som: 95.0 },
];

const REVENUE_DATA = [
  { q: 'Q1\'25', rev: 0 },{ q: 'Q2\'25', rev: 0.04 },{ q: 'Q3\'25', rev: 0.18 },
  { q: 'Q4\'25', rev: 0.52 },{ q: 'Q1\'26', rev: 1.1 },{ q: 'Q2\'26', rev: 2.4 },
  { q: 'Q3\'26', rev: 4.8 },{ q: 'Q4\'26', rev: 9.2 },
];

const ALGO_ADVANTAGES = [
  { label:'Transaction Speed', nexus:98, trad:20, unit:'TPS score' },
  { label:'Finality Time',     nexus:95, trad:30, unit:'<1s vs 15min' },
  { label:'Cost per TX',       nexus:99, trad:15, unit:'$0.001 vs $30' },
  { label:'Decentralization',  nexus:90, trad:60, unit:'Nakamoto coeff' },
  { label:'Smart Contract',    nexus:85, trad:70, unit:'PyTeal/AVM' },
];

const USE_OF_FUNDS = [
  { name:'Product Dev',    pct:40, color:'#00e5ff' },
  { name:'AI Research',    pct:25, color:'#a855f7' },
  { name:'BD & Ecosystem', pct:20, color:'#00ff9d' },
  { name:'Legal / Ops',    pct:10, color:'#ff6b00' },
  { name:'Reserve',        pct:5,  color:'#ffd600' },
];

const MILESTONES = [
  { phase:'Phase 0',  date:'Apr 2025', status:'done',     label:'AlgoBharat Hackathon — MVP Launch',   desc:'NEXUS Finance deployed on Algorand Testnet. DELTA + KAPPA + SIGMA agents live.' },
  { phase:'Phase 1',  date:'Jun 2025', status:'done',     label:'Mainnet Alpha — Closed Beta',         desc:'500 early users. $1.2M TVL. DELTA yield optimizer live on Folks Finance.' },
  { phase:'Phase 2',  date:'Sep 2025', status:'active',   label:'Series A — $4M Round',                desc:'Chainlink CCIP integration. SIGMA RWA tokenization. KAPPA cross-chain bridge.' },
  { phase:'Phase 3',  date:'Jan 2026', status:'upcoming', label:'Public Launch — 10K Users',           desc:'Full x402 micropayment rails. ARIA autonomous agent economy. RWA marketplace.' },
  { phase:'Phase 4',  date:'Jun 2026', status:'upcoming', label:'Institutional — $500M TVL Target',    desc:'Licensed RWA products. Institutional API. White-label agent OS.' },
  { phase:'Phase 5',  date:'2027+',    status:'upcoming', label:'Global Expansion — $5T Economy',     desc:'Full agentic economy. Cross-border payments. 1M+ active AI agent wallets.' },
];

const TEAM = [
  { name:'Alex Winters',    role:'CEO & Co-founder',  bg:'AI/ML researcher, ex-Google DeepMind. Llama contributor.', icon:'👤' },
  { name:'Priya Sharma',    role:'CTO & Co-founder',  bg:'Algorand core dev, ex-Coinbase. PyTeal expert.', icon:'👤' },
  { name:'Marcus Chen',     role:'Head of DeFi',      bg:'Ex-Aave protocol engineer. DeFi liquidity expert.', icon:'👤' },
  { name:'Aisha Patel',     role:'Head of RWA',       bg:'Structured finance background. Ex-Goldman Sachs.', icon:'👤' },
];

const INVESTORS = [
  { name:'Algorand Foundation', type:'Strategic', icon:'⬡', amount:'$500K' },
  { name:'Chainlink BUILD',     type:'Program',   icon:'🔗', amount:'Benefits' },
  { name:'AngelList',           type:'Seed',      icon:'👼', amount:'$1.2M' },
  { name:'AlgoBharat',         type:'Hackathon',  icon:'🏆', amount:'Grant' },
];

const SLIDES = [
  'Problem','Solution','Algorand','Technology','Traction','Market','Business Model','Roadmap','Team','Use of Funds','Ask'
];

// ─── Slide components ─────────────────────────────────────────────────────────
const Slide: React.FC<{active:boolean;children:React.ReactNode}> = ({active,children}) => (
  <div className={cn('transition-all duration-500',active?'opacity-100':'opacity-0 pointer-events-none absolute w-full')}>
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
export const PitchDeck: React.FC = () => {
  const [slide, setSlide]     = useState(0);
  const [presenting, setPresenting] = useState(false);
  const [timer, setTimer]     = useState(0);
  const [counter, setCounter] = useState(0);

  // Presentation timer
  useEffect(() => {
    if (!presenting) return;
    const t = setInterval(() => setTimer(s => s+1), 1000);
    return () => clearInterval(t);
  }, [presenting]);

  // Animated counters on problem slide
  useEffect(() => {
    if (slide !== 0) return;
    let n = 0;
    const t = setInterval(() => { n += 50; setCounter(Math.min(n,5000)); if(n>=5000) clearInterval(t); },20);
    return () => clearInterval(t);
  }, [slide]);

  const nextSlide = () => setSlide(s=>Math.min(s+1,SLIDES.length-1));
  const prevSlide = () => setSlide(s=>Math.max(s-1,0));

  const timerStr = `${Math.floor(timer/60).toString().padStart(2,'0')}:${(timer%60).toString().padStart(2,'0')}`;

  return (
    <div className="p-5 flex flex-col gap-4 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[26px] font-bold text-wh tracking-[1px]">Pitch Deck — AlgoBharat 2025</div>
          <p className="text-[12px] text-t2 font-mono">// NEXUS FINANCE · AI Financial OS on Algorand · Seed Round $4M</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] text-t3">{slide+1} / {SLIDES.length}</span>
          {presenting && (
            <span className="font-mono text-[11px] text-g1 bg-[rgba(0,255,157,0.08)] border border-[rgba(0,255,157,0.2)] px-2.5 py-1 rounded flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-r1 animate-pulse inline-block"/>LIVE · {timerStr}
            </span>
          )}
          <button onClick={()=>{setPresenting(p=>!p);if(!presenting)setTimer(0);}}
            className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
              presenting?'bg-[rgba(255,34,85,0.15)] border border-[rgba(255,34,85,0.3)] text-r1':'bg-gradient-to-r from-gold to-o1 text-black hover:opacity-90')}>
            {presenting?'⏹ End Presentation':'🎯 Present Mode'}
          </button>
        </div>
      </div>

      {/* Slide navigation tabs */}
      <div className="flex flex-wrap gap-1.5">
        {SLIDES.map((s,i)=>(
          <button key={s} onClick={()=>setSlide(i)}
            className={cn('px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all border',
              slide===i?'border-gold bg-[rgba(255,214,0,0.12)] text-gold':'border-border-custom text-t3 hover:text-t2 hover:border-border3')}>
            {i+1}. {s}
          </button>
        ))}
      </div>

      {/* Slides */}
      <div className="flex-1 relative">
        {/* ── Slide 0: Problem ── */}
        <Slide active={slide===0}>
          <div className="text-center mb-8 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">The Problem</div>
            <div className="font-display text-[42px] font-extrabold text-wh leading-tight mb-3">
              AI Agents Can't Handle Money.<br/>
              <span className="bg-gradient-to-r from-c1 to-p2 bg-clip-text text-transparent">Yet.</span>
            </div>
            <p className="text-[15px] text-t2 max-w-2xl mx-auto leading-relaxed">
              AI agents process $0 autonomously. Every payment needs human approval. Meanwhile, $2.4T in capital earns 4% when 15%+ is available — and $500T in real assets are locked behind 3-week underwriting.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {[
              { num:'$'+counter.toLocaleString()+'T', label:'Agentic Commerce by 2030', sub:'McKinsey projection. Zero payment infrastructure exists today.', color:'text-wh', accent:'border-t-wh' },
              { num:'+253%',           label:'DeFi Yield Gap',             sub:'Average user earns 4.2%. Optimal: 14.8%. $2.4T in suboptimal positions.', color:'text-g1', accent:'border-t-g1' },
              { num:'$500T',           label:'Illiquid Real-World Assets',  sub:'3 weeks to underwrite. NEXUS reduces it to 5 seconds via AI + Algorand.', color:'text-p2', accent:'border-t-p2' },
            ].map((c,i)=>(
              <div key={i} className={cn('bg-[rgba(0,0,0,0.35)] border border-t-4 border-border-custom rounded-xl p-6 text-center',c.accent)}>
                <div className={cn('font-display text-[40px] font-extrabold mb-2',c.color)}>{c.num}</div>
                <div className="font-bold text-wh text-[14px] mb-2">{c.label}</div>
                <div className="text-[11px] text-t2 leading-relaxed">{c.sub}</div>
              </div>
            ))}
          </div>
        </Slide>

        {/* ── Slide 1: Solution ── */}
        <Slide active={slide===1}>
          <div className="text-center mb-8 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">The Solution</div>
            <div className="font-display text-[36px] font-extrabold text-wh mb-3">NEXUS FINANCE — AI Financial OS</div>
            <p className="text-[14px] text-t2 max-w-xl mx-auto">The first autonomous financial operating system where AI agents earn, spend, and optimize capital without human intervention.</p>
          </div>

          {/* Elevator pitch */}
          <div className="max-w-3xl mx-auto mb-6">
            <div className="bg-[rgba(255,214,0,0.04)] border border-[rgba(255,214,0,0.2)] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gold text-lg">🏆</span>
                <span className="font-mono text-[9px] text-gold uppercase tracking-widest">30-Second Elevator Pitch</span>
              </div>
              <p className="text-[13px] text-wh leading-loose italic">
                "AI agents will mediate $5 trillion in commerce by 2030 — but today, they can't pay for a single API call. NEXUS FINANCE solves this with three layers: <span className="text-c1 font-bold">ARIA</span>, an autonomous agent with a smart payment wallet; <span className="text-g1 font-bold">DELTA</span>, a yield optimizer capturing the 10%+ APY gap on Algorand; and <span className="text-p2 font-bold">SIGMA</span>, an AI underwriter that tokenizes real-world assets in seconds. Together: the financial OS for the agentic economy — built natively on Algorand."
              </p>
            </div>
          </div>

          {/* 4 agents */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto">
            {[
              {name:'ARIA',  role:'Market Intelligence',    color:'text-c1',  bg:'border-c1',  icon:'🤖', desc:'Real-time scanning, signal generation, autonomous reasoning' },
              {name:'DELTA', role:'DeFi Yield Optimizer',   color:'text-g1',  bg:'border-g1',  icon:'⚡', desc:'Auto-rebalancing across Folks Finance, Tinyman, Vestige' },
              {name:'KAPPA', role:'Cross-Chain Bridge',     color:'text-p2',  bg:'border-p2',  icon:'🌉', desc:'CCIP + Wormhole + Messina — cheapest route selection' },
              {name:'SIGMA', role:'RWA Underwriting',       color:'text-o1',  bg:'border-o1',  icon:'📊', desc:'AI credit scoring, ASA minting, fractional ownership' },
            ].map(ag=>(
              <div key={ag.name} className={cn('bg-[rgba(0,0,0,0.35)] border-t-2 border border-border-custom rounded-xl p-4',ag.bg)}>
                <div className="text-2xl mb-2">{ag.icon}</div>
                <div className={cn('font-display text-[18px] font-bold mb-1',ag.color)}>{ag.name}</div>
                <div className="font-mono text-[9px] text-t3 uppercase tracking-wider mb-2">{ag.role}</div>
                <div className="text-[11px] text-t2 leading-relaxed">{ag.desc}</div>
              </div>
            ))}
          </div>
        </Slide>

        {/* ── Slide 2: Algorand ── */}
        <Slide active={slide===2}>
          <div className="text-center mb-8 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">Why Algorand</div>
            <div className="font-display text-[36px] font-extrabold text-wh mb-3">Built for the <span className="text-c1">Speed of AI</span></div>
            <p className="text-[14px] text-t2 max-w-2xl mx-auto">AI agents make thousands of micro-decisions per second. Only Algorand's 4-second finality, $0.001 fees, and instant ASA minting can keep up.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-3">Algorand vs Traditional Finance</div>
              <div className="flex flex-col gap-3">
                {ALGO_ADVANTAGES.map((a,i)=>(
                  <div key={i}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-t2">{a.label}</span>
                      <span className="font-mono text-[9px] text-t3">{a.unit}</span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 h-2 bg-border-custom rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-c1 to-g1 transition-all duration-1000" style={{width:`${a.nexus}%`}}/>
                      </div>
                      <span className="font-mono text-[10px] text-c1 w-8 text-right">{a.nexus}</span>
                    </div>
                    <div className="flex gap-2 items-center mt-1">
                      <div className="flex-1 h-1.5 bg-border-custom rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[rgba(255,107,0,0.5)]" style={{width:`${a.trad}%`}}/>
                      </div>
                      <span className="font-mono text-[10px] text-o1 w-8 text-right">{a.trad}</span>
                    </div>
                    <div className="flex gap-2 text-[8px] font-mono text-t3 mt-0.5">
                      <span className="text-c1">● ALGO</span><span className="text-o1 ml-4">● Traditional</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {[
                {icon:'⬡',label:'4-Second Finality',     val:'Instant settlement',     sub:'AI agent decisions confirmed before next API call returns'},
                {icon:'💸',label:'$0.001 Per Transaction',val:'Near-zero cost',         sub:'Enables true micropayment rails for AI agent economy'},
                {icon:'🪙',label:'Algorand ASA Standard', val:'Native tokenization',    sub:'RWA tokens minted in 1 block — no EVM complexity'},
                {icon:'🌱',label:'Carbon Negative',        val:'ESG compliant',          sub:'3× more offset than emitted — future-proof for ESG mandates'},
                {icon:'🔒',label:'Pure PoS Security',      val:'99.99% uptime',          sub:'Byzantine fault tolerant — no forks, no rollbacks'},
                {icon:'🏛',label:'AlgoBharat Ecosystem',  val:'India-first',            sub:'Algorand Foundation backing for Bharat DeFi market entry'},
              ].map((f,i)=>(
                <div key={i} className="flex items-center gap-3 bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.12)] rounded-xl p-3">
                  <span className="text-xl shrink-0">{f.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-wh text-[12px]">{f.label}</span>
                      <span className="font-mono text-[9px] text-c1 bg-[rgba(0,229,255,0.1)] px-1.5 py-0.5 rounded">{f.val}</span>
                    </div>
                    <div className="text-[10px] text-t3 mt-0.5">{f.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* ── Slide 3: Technology ── */}
        <Slide active={slide===3}>
          <div className="text-center mb-6 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">Technology Stack</div>
            <div className="font-display text-[36px] font-extrabold text-wh mb-2">Production-Ready Architecture</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              {title:'AI Layer',color:'border-c1',items:[
                {name:'Google Gemini 2.0 Flash',icon:'🤖',desc:'Powers all 4 agents - ARIA, DELTA, KAPPA, SIGMA'},
                {name:'Gemini Streaming',icon:'⚡',desc:'Real-time reasoning streams visible in UI'},
                {name:'Structured Output',icon:'📊',desc:'JSON-mode for credit scoring & signal generation'},
              ]},
              {title:'Blockchain Layer',color:'border-g1',items:[
                {name:'Algorand Testnet',icon:'⬡',desc:'Native ASA minting, fast finality, $0.001 fees'},
                {name:'Pera Wallet SDK',icon:'🔐',desc:'TransactionSigner, multi-signature support'},
                {name:'Chainlink CCIP',icon:'🔗',desc:'Secure cross-chain messaging + token bridge'},
                {name:'Wormhole + Messina',icon:'🌉',desc:'ALGO ↔ EVM bridge — widest chain coverage'},
              ]},
              {title:'Data / Infra',color:'border-p2',items:[
                {name:'DefiLlama API',icon:'📈',desc:'Live APY feeds for 8,000+ protocols globally'},
                {name:'CoinGecko API',icon:'💹',desc:'Real-time prices for 10+ assets in Scanner'},
                {name:'Algonode RPC',icon:'⬡',desc:'Free Algorand node — testnet + mainnet'},
                {name:'Supabase',icon:'🗄',desc:'Auth, user data, agent event logs'},
              ]},
            ].map(col=>(
              <div key={col.title} className={cn('bg-[rgba(0,0,0,0.25)] border-t-2 border border-border-custom rounded-xl p-4',col.color)}>
                <div className="font-display text-[15px] font-bold text-wh mb-3">{col.title}</div>
                <div className="flex flex-col gap-2.5">
                  {col.items.map(item=>(
                    <div key={item.name} className="flex gap-2.5">
                      <span className="text-base shrink-0">{item.icon}</span>
                      <div>
                        <div className="font-semibold text-[12px] text-wh">{item.name}</div>
                        <div className="text-[10px] text-t3 mt-0.5">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Slide>

        {/* ── Slide 4: Traction ── */}
        <Slide active={slide===4}>
          <div className="text-center mb-6 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">Traction</div>
            <div className="font-display text-[36px] font-extrabold text-wh mb-2">Built. Shipped. <span className="text-g1">Working.</span></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto mb-6">
            {[
              {val:'6',     label:'AI Modules Live',    sub:'DeFi · Bridge · RWA · Scanner · Portfolio · Alerts',color:'text-c1'},
              {val:'4',     label:'AI Agents Deployed', sub:'ARIA · DELTA · KAPPA · SIGMA',                        color:'text-p2'},
              {val:'8',     label:'Chains Supported',   sub:'Algorand + 7 EVM chains via CCIP',                    color:'text-g1'},
              {val:'$0.64M',label:'Demo TVL (Testnet)', sub:'Across DeFi, RWA, and Bridge modules',                color:'text-o1'},
            ].map((m,i)=>(
              <div key={i} className="bg-[rgba(0,0,0,0.35)] border border-border-custom rounded-xl p-5 text-center">
                <div className={cn('font-display text-[32px] font-extrabold',m.color)}>{m.val}</div>
                <div className="font-bold text-wh text-[13px] mt-1 mb-1">{m.label}</div>
                <div className="text-[10px] text-t3">{m.sub}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              {title:'✅ Complete',color:'border-g1',items:['Live DeFi Matrix with DefiLlama APY feeds','Cross-Chain Bridge with CCIP + Wormhole routing','RWA Tokenization with Algorand ASA minting','AI Portfolio Optimizer with Gemini rebalancing','Market Scanner with CoinGecko live prices','Smart Alert System with Gemini daily digest','Pera Wallet full integration (connect/sign/send)']},
              {title:'🚀 In Progress',color:'border-c1',items:['Mainnet deployment on Algorand','Chainlink Functions for verifiable off-chain data','x402 micropayment protocol integration','ARIA autonomous transaction execution','Folks Finance / Tinyman direct SDK integration','IPFS pinning via web3.storage for RWA docs','Institutional API for white-label deployment']},
            ].map(col=>(
              <div key={col.title} className={cn('bg-[rgba(0,0,0,0.25)] border-l-4 border border-border-custom rounded-xl p-4',col.color)}>
                <div className="font-bold text-wh text-[14px] mb-3">{col.title}</div>
                <div className="flex flex-col gap-1.5">
                  {col.items.map((item,i)=>(
                    <div key={i} className="font-mono text-[11px] text-t2">› {item}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Slide>

        {/* ── Slide 5: Market ── */}
        <Slide active={slide===5}>
          <div className="text-center mb-6 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">Market Opportunity</div>
            <div className="font-display text-[36px] font-extrabold text-wh mb-2">TAM · SAM · SOM</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-3">Market Size Growth ($B)</div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MARKET_DATA}>
                    <XAxis dataKey="year" tick={{fill:'var(--color-t3)',fontSize:10}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'var(--color-t3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={(v:number)=>`$${v}B`}/>
                    <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:11}} formatter={(v:number)=>[`$${v}B`]}/>
                    <Bar dataKey="tam" fill="rgba(0,229,255,0.2)" radius={[3,3,0,0]} name="TAM"/>
                    <Bar dataKey="sam" fill="rgba(168,85,247,0.4)" radius={[3,3,0,0]} name="SAM"/>
                    <Bar dataKey="som" fill="var(--color-g1)" radius={[3,3,0,0]} name="SOM"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex gap-4 mt-2 text-[10px] font-mono">
                <span className="text-c1">● TAM: Agentic Commerce</span>
                <span className="text-p2">● SAM: DeFi + RWA</span>
                <span className="text-g1">● SOM: Nexus Target</span>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {[
                {label:'TAM — Total Addressable',val:'$5 Trillion',  sub:'Agentic commerce, DeFi, RWA tokenization globally by 2030',color:'text-c1'},
                {label:'SAM — Serviceable',       val:'$750 Billion', sub:'DeFi protocol TVL + institutional RWA tokenization market',color:'text-p2'},
                {label:'SOM — Obtainable',        val:'$95 Billion',  sub:'1.3% of SAM — realistic for a focused Algorand-native platform', color:'text-g1'},
                {label:'Land-and-Expand',         val:'India First',  sub:'AlgoBharat ecosystem + SEBI DeFi sandbox + 1.4B population', color:'text-o1'},
              ].map((m,i)=>(
                <div key={i} className="bg-[rgba(0,0,0,0.25)] border border-border-custom rounded-xl p-4">
                  <div className="font-mono text-[9px] text-t3 uppercase">{m.label}</div>
                  <div className={cn('font-display text-[24px] font-extrabold mt-1',m.color)}>{m.val}</div>
                  <div className="text-[11px] text-t2 mt-1">{m.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* ── Slide 6: Business Model ── */}
        <Slide active={slide===6}>
          <div className="text-center mb-6 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">Business Model</div>
            <div className="font-display text-[36px] font-extrabold text-wh mb-2">Revenue Streams</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 gap-3">
              {[
                {stream:'Protocol Fee',    pct:'0.12%',  on:'All bridged volume',      model:'Per TX',       rev:'$2.4M yr-1 @ $2B vol',  color:'text-g1'},
                {stream:'Yield Spread',    pct:'10-15%', on:'AUM yield generated',     model:'Performance',  rev:'$1.8M yr-1 @ $20M AUM', color:'text-c1'},
                {stream:'RWA Origination', pct:'0.5%',   on:'Asset tokenization',      model:'One-time',     rev:'$5M yr-1 @ $1B assets', color:'text-p2'},
                {stream:'AI Agent API',    pct:'$299/mo', on:'Institutional white-label',model:'SaaS',       rev:'$3.6M yr-1 @ 1K users', color:'text-o1'},
                {stream:'x402 Micro-TX',   pct:'0.001%', on:'Agent payment rails',     model:'Per micro-tx', rev:'$8M yr-1 @ $8T vol',    color:'text-gold'},
              ].map((r,i)=>(
                <div key={i} className="flex items-center gap-3 bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-xl px-4 py-3">
                  <div className={cn('font-display text-[22px] font-extrabold w-16 shrink-0',r.color)}>{r.pct}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-wh text-[13px]">{r.stream}</div>
                    <div className="text-[10px] text-t3">{r.on} · {r.model}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-[10px] text-g1">{r.rev}</div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-3">Revenue Projection ($M)</div>
              <div className="h-56 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={REVENUE_DATA}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-gold)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--color-gold)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="q" tick={{fill:'var(--color-t3)',fontSize:9}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:'var(--color-t3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={(v:number)=>`$${v}M`}/>
                    <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:11}} formatter={(v:number)=>[`$${v}M`,'Revenue']}/>
                    <Area type="monotone" dataKey="rev" stroke="var(--color-gold)" strokeWidth={2} fill="url(#revGrad)" dot={{fill:'var(--color-gold)',r:3}}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-[rgba(255,214,0,0.04)] border border-[rgba(255,214,0,0.15)] rounded-xl p-4">
                <div className="font-mono text-[9px] text-gold uppercase tracking-widest mb-2">Unit Economics (Year 2)</div>
                {[
                  ['ARR Target','$9.2M'],['CAC','$120'],['LTV','$3,400'],['LTV:CAC','28x'],['Gross Margin','78%'],
                ].map(([l,v])=>(
                  <div key={l} className="flex justify-between text-[12px] py-1 border-b border-[rgba(255,214,0,0.06)] last:border-none">
                    <span className="text-t2">{l}</span><span className="font-mono font-bold text-gold">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Slide>

        {/* ── Slide 7: Roadmap ── */}
        <Slide active={slide===7}>
          <div className="text-center mb-6 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">Roadmap</div>
            <div className="font-display text-[36px] font-extrabold text-wh mb-2">From Hackathon to <span className="text-p2">$5T Economy</span></div>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="relative flex flex-col gap-0">
              <div className="absolute left-[100px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-c1 via-p2 to-t3 opacity-30"/>
              {MILESTONES.map((m,i)=>(
                <div key={i} className="flex gap-4 pb-6 last:pb-0 relative">
                  <div className="w-[100px] shrink-0 text-right">
                    <div className="font-mono text-[9px] text-t3 uppercase">{m.phase}</div>
                    <div className="font-mono text-[10px] text-t2">{m.date}</div>
                  </div>
                  <div className="relative z-10 mt-1">
                    <div className={cn('w-3 h-3 rounded-full border-2 transition-all',
                      m.status==='done'?'bg-g1 border-g1':m.status==='active'?'bg-c1 border-c1 animate-pulse shadow-[0_0_8px_rgba(0,229,255,0.6)]':'bg-transparent border-t3'
                    )}/>
                  </div>
                  <div className={cn('flex-1 bg-[rgba(0,0,0,0.25)] border rounded-xl p-3 transition-all',
                    m.status==='done'?'border-[rgba(0,255,157,0.2)]':m.status==='active'?'border-[rgba(0,229,255,0.3)] shadow-[0_0_12px_rgba(0,229,255,0.08)]':'border-border-custom opacity-60'
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('font-mono text-[8px] px-1.5 py-0.5 rounded uppercase',
                        m.status==='done'?'text-g1 bg-[rgba(0,255,157,0.1)]':m.status==='active'?'text-c1 bg-[rgba(0,229,255,0.1)] animate-pulse':'text-t3 bg-transparent'
                      )}>{m.status==='done'?'✅ COMPLETE':m.status==='active'?'⚡ ACTIVE':'⏳ UPCOMING'}</span>
                      <span className="font-semibold text-wh text-[13px]">{m.label}</span>
                    </div>
                    <div className="text-[11px] text-t2">{m.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* ── Slide 8: Team ── */}
        <Slide active={slide===8}>
          <div className="text-center mb-6 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">Team</div>
            <div className="font-display text-[36px] font-extrabold text-wh mb-2">Built by Builders</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto mb-6">
            {TEAM.map((t,i)=>(
              <div key={i} className="bg-[rgba(0,0,0,0.35)] border border-border-custom rounded-xl p-5 text-center hover:border-border3 transition-all">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-c2 to-p1 flex items-center justify-center text-2xl mx-auto mb-3">👤</div>
                <div className="font-bold text-wh text-[14px] mb-0.5">{t.name}</div>
                <div className="font-mono text-[10px] text-p2 mb-2">{t.role}</div>
                <div className="text-[11px] text-t3 leading-relaxed">{t.bg}</div>
              </div>
            ))}
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-3 text-center">Backers & Partners</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {INVESTORS.map((inv,i)=>(
                <div key={i} className="bg-[rgba(255,214,0,0.03)] border border-[rgba(255,214,0,0.12)] rounded-xl p-3 text-center">
                  <div className="text-2xl mb-1">{inv.icon}</div>
                  <div className="font-semibold text-wh text-[12px]">{inv.name}</div>
                  <div className="font-mono text-[9px] text-t3">{inv.type}</div>
                  <div className="font-mono text-[10px] text-gold mt-1">{inv.amount}</div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* ── Slide 9: Use of Funds ── */}
        <Slide active={slide===9}>
          <div className="text-center mb-6 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest mb-3">Use of Funds</div>
            <div className="font-display text-[36px] font-extrabold text-wh mb-2">Raising <span className="text-gold">$4M Seed</span></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="flex flex-col items-center">
              <div className="relative w-[200px] h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={USE_OF_FUNDS} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="pct">
                      {USE_OF_FUNDS.map((e,i)=><Cell key={i} fill={e.color} stroke="none"/>)}
                    </Pie>
                    <Tooltip contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border-custom)',borderRadius:'8px',fontSize:11}} formatter={(v:number)=>[`${v}%`]}/>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="font-display text-[22px] font-extrabold text-gold">$4M</div>
                  <div className="text-[9px] text-t3 font-mono">SEED</div>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mt-4 w-full">
                {USE_OF_FUNDS.map((f,i)=>(
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:f.color}}/>
                    <span className="text-t1 flex-1">{f.name}</span>
                    <span className="font-mono text-wh">${(f.pct*40000).toLocaleString()}</span>
                    <span className="font-mono text-t3 text-[10px] w-8 text-right">{f.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {[
                {cat:'Product Dev (40%)',  amt:'$1.6M', items:['Mainnet deployment','x402 payment rails','Chainlink Functions','Mobile app (iOS/Android)']},
                {cat:'AI Research (25%)',  amt:'$1.0M', items:['On-device agent inference','ARIA autonomous execution','Model fine-tuning for DeFi','Risk model research']},
                {cat:'BD & Ecosystem (20%)',amt:'$800K',items:['Algorand Foundation partnership','Indian institutional clients','Chainlink BUILD perks','AlgoBharat market entry']},
              ].map((b,i)=>(
                <div key={i} className="bg-[rgba(0,0,0,0.25)] border border-border-custom rounded-xl p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold text-wh text-[12px]">{b.cat}</div>
                    <div className="font-mono text-gold text-[13px] font-bold">{b.amt}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3">
                    {b.items.map((item,j)=><div key={j} className="font-mono text-[10px] text-t3">› {item}</div>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* ── Slide 10: Ask ── */}
        <Slide active={slide===10}>
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-6 pt-4">
            <div className="font-mono text-[11px] text-gold uppercase tracking-widest">The Ask</div>
            <div className="font-display text-[52px] font-extrabold text-wh leading-tight">
              Join the <span className="bg-gradient-to-r from-c1 via-p2 to-gold bg-clip-text text-transparent">Agentic Economy.</span>
            </div>
            <p className="text-[16px] text-t2 max-w-2xl leading-relaxed">
              We're raising <span className="text-gold font-bold">$4M seed</span> to launch NEXUS FINANCE on Algorand mainnet, reach <span className="text-c1 font-bold">10,000 users</span>, and deploy the first AI agent payment rails for the $5T autonomous economy.
            </p>
            <div className="grid grid-cols-3 gap-6 my-4">
              {[
                {val:'$4M',  label:'Seed Raise',     sub:'Pre-money val: $20M'},
                {val:'18mo', label:'Runway',          sub:'To Series A milestone'},
                {val:'10K',  label:'User Target',     sub:'DAU within 12 months'},
              ].map((s,i)=>(
                <div key={i} className="bg-[rgba(255,214,0,0.06)] border border-[rgba(255,214,0,0.2)] rounded-2xl px-8 py-5">
                  <div className="font-display text-[36px] font-extrabold text-gold">{s.val}</div>
                  <div className="font-bold text-wh text-[14px] mt-1">{s.label}</div>
                  <div className="text-[10px] text-t3 mt-0.5">{s.sub}</div>
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="font-mono text-[12px] text-t2">Contact us to invest or partner:</div>
              <div className="font-mono text-[14px] text-c1">team@nexus.finance · @NexusFinanceOS</div>
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              {['🏆 AlgoBharat 2025 Submission','⬡ Built on Algorand','🔗 Powered by Chainlink','🤖 Google Gemini AI'].map(tag=>(
                <span key={tag} className="font-mono text-[10px] text-t2 bg-[rgba(0,0,0,0.3)] border border-border-custom px-3 py-1.5 rounded-full">{tag}</span>
              ))}
            </div>
          </div>
        </Slide>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-4 pt-2">
        <button onClick={prevSlide} disabled={slide===0}
          className="px-5 py-2 rounded-lg text-[12px] font-bold border border-border-custom text-t2 hover:text-wh hover:border-border3 disabled:opacity-30 transition-all">← Prev</button>
        <div className="flex gap-1.5">
          {SLIDES.map((_,i)=>(
            <button key={i} onClick={()=>setSlide(i)}
              className={cn('w-2 h-2 rounded-full transition-all',slide===i?'bg-gold w-5':'bg-border3 hover:bg-t3')}/>
          ))}
        </div>
        <button onClick={nextSlide} disabled={slide===SLIDES.length-1}
          className="px-5 py-2 rounded-lg text-[12px] font-bold border border-border-custom text-t2 hover:text-wh hover:border-border3 disabled:opacity-30 transition-all">Next →</button>
      </div>
    </div>
  );
};
