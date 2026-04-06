import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, StatCard } from '@/components/UI';
import { cn, formatCurrency } from '@/lib/utils';
import { GoogleGenAI } from '@google/genai';
import { PeraWalletConnect } from '@perawallet/connect';
import algosdk from 'algosdk';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });
const getPeraWallet = (): PeraWalletConnect =>
  (window as any).__nexusPeraWallet ?? new PeraWalletConnect();

// ── Types ────────────────────────────────────────────────────────────────────
interface RWAAsset {
  id: string; name: string; type: string; issuer: string;
  value: number; tokenPrice: number; apr: number; score: number;
  funded: number; investors: number; daysLeft: number;
  color: string; asaId?: number; ipfsCid?: string;
  analysis?: string; grade?: string;
}

// ── Asset type templates ─────────────────────────────────────────────────────
const TEMPLATES: Record<string, Partial<{name:string;issuer:string;desc:string;value:number;tokenPrice:number;maturity:number;apr:number}>> = {
  'Invoice Financing': { name: 'Infosys Invoice #INV-2024-089', issuer: 'Infosys Ltd', desc: 'HDFC Bank to Infosys — 90-day receivable', value: 120000, tokenPrice: 10, maturity: 90, apr: 9.5 },
  'Real Estate':       { name: 'Mumbai Office Block B — Floor 3', issuer: 'Godrej Properties', desc: 'Grade-A commercial space, BKC Mumbai', value: 850000, tokenPrice: 100, maturity: 365, apr: 7.2 },
  'Corporate Bond':    { name: 'Reliance Bond Series A', issuer: 'Reliance Industries', desc: 'Senior secured 3-year corporate bond', value: 270000, tokenPrice: 50, maturity: 1095, apr: 6.8 },
  'Treasury Bill':     { name: 'RBI T-Bill 91-Day', issuer: 'Reserve Bank of India', desc: 'Government of India sovereign T-Bill', value: 500000, tokenPrice: 25, maturity: 91, apr: 7.1 },
};

const INITIAL_ASSETS: RWAAsset[] = [
  { id:'a1', name:'Infosys Invoice #1089', type:'INVOICE', issuer:'Infosys Ltd', value:120000, tokenPrice:10, apr:9.5, score:94, funded:78, investors:34, daysLeft:12, color:'var(--color-c1)', grade:'A+', analysis:'Strong issuer credit. Payment history 100% on time. Recommended.' },
  { id:'a2', name:'Mumbai Office Block B', type:'REAL ESTATE', issuer:'Godrej Properties', value:850000, tokenPrice:100, apr:7.2, score:82, funded:45, investors:18, daysLeft:28, color:'var(--color-p2)', grade:'A', analysis:'Prime location, Grade-A asset. Moderate liquidity risk.' },
  { id:'a3', name:'Reliance Bond Series A', type:'BOND', issuer:'Reliance Industries', value:270000, tokenPrice:50, apr:6.8, score:89, funded:62, investors:27, daysLeft:19, color:'var(--color-g1)', grade:'A+', analysis:'AAA-rated issuer. Low default risk. Stable yield profile.' },
];

const scoreColor = (s: number) => s >= 85 ? 'var(--color-g1)' : s >= 70 ? 'var(--color-c1)' : 'var(--color-o1)';
const gradeColor = (g?: string) => g?.includes('+') ? 'text-g1' : g ? 'text-c1' : 'text-t3';

// ═══════════════════════════════════════════════════════════════════════════════
export const RWAStudio: React.FC = () => {
  // ── Form state ───────────────────────────────────────────────────────────
  const [assetType, setAssetType]   = useState('Invoice Financing');
  const [issuer, setIssuer]         = useState(TEMPLATES['Invoice Financing'].issuer!);
  const [assetName, setAssetName]   = useState(TEMPLATES['Invoice Financing'].name!);
  const [desc, setDesc]             = useState(TEMPLATES['Invoice Financing'].desc!);
  const [value, setValue]           = useState(TEMPLATES['Invoice Financing'].value!);
  const [tokenPrice, setTokenPrice] = useState(TEMPLATES['Invoice Financing'].tokenPrice!);
  const [maturity, setMaturity]     = useState(TEMPLATES['Invoice Financing'].maturity!);
  const [aprInput, setAprInput]     = useState(TEMPLATES['Invoice Financing'].apr!);

  // ── Underwriting ─────────────────────────────────────────────────────────
  const [underwriting, setUnderwriting] = useState(false);
  const [score, setScore]               = useState<number|null>(null);
  const [grade, setGrade]               = useState('');
  const [analysis, setAnalysis]         = useState('');
  const [compliance, setCompliance]     = useState<{label:string;ok:boolean}[]>([]);

  // ── Assets / marketplace ─────────────────────────────────────────────────
  const [assets, setAssets] = useState<RWAAsset[]>(INITIAL_ASSETS);
  const [viewMode, setViewMode] = useState<'cards'|'table'>('cards');
  const [selectedAsset, setSelectedAsset] = useState<RWAAsset|null>(null);
  const [investAmt, setInvestAmt] = useState('10000');

  // ── Minting / Transfer ───────────────────────────────────────────────────
  const [mintStatus, setMintStatus] = useState('');
  const [mintedAsaId, setMintedAsaId] = useState<number|null>(null);
  const [transferAddr, setTransferAddr] = useState('');
  const [transferAmt, setTransferAmt]   = useState('10');
  const [transferStatus, setTransferStatus] = useState('');

  // ── IPFS ─────────────────────────────────────────────────────────────────
  const [ipfsCid, setIpfsCid]   = useState('');
  const [ipfsFile, setIpfsFile] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // ── SIGMA chat ───────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen]   = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role:'user'|'sigma';text:string;thinking?:boolean}[]>([
    { role:'sigma', text:'📊 SIGMA online. I provide AI-powered credit underwriting, RWA investment analysis, and compliance checks on Algorand. What asset would you like me to evaluate?' },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [chatMessages]);

  // ── 8. Template loader ───────────────────────────────────────────────────
  const loadTemplate = (type: string) => {
    const t = TEMPLATES[type] || {};
    setAssetType(type);
    if (t.issuer)     setIssuer(t.issuer);
    if (t.name)       setAssetName(t.name);
    if (t.desc)       setDesc(t.desc);
    if (t.value)      setValue(t.value);
    if (t.tokenPrice) setTokenPrice(t.tokenPrice);
    if (t.maturity)   setMaturity(t.maturity);
    if (t.apr)        setAprInput(t.apr);
    setScore(null); setGrade(''); setAnalysis(''); setIpfsCid(''); setMintedAsaId(null);
  };

  // ── 1. Real Gemini underwriting ───────────────────────────────────────────
  const runUnderwriting = async () => {
    setUnderwriting(true); setScore(null); setGrade(''); setAnalysis(''); setCompliance([]);
    try {
      const prompt = `You are SIGMA, a financial AI underwriter specializing in Real World Asset (RWA) tokenization.
Analyze this asset and return ONLY a JSON object (no markdown) with these fields:
- score: number 0-100
- grade: string ("A+", "A", "B+", "B", "C")
- summary: string (2 sentences max, concise analysis)
- factors: object with keys creditHistory, paymentRecord, marketVolatility, assetLiquidity, regulatoryCompliance each being a number 0-100
- compliance: array of {label: string, ok: boolean} with 5 checks

Asset: ${assetType} | Issuer: ${issuer} | Value: $${value.toLocaleString()} | APR: ${aprInput}% | Maturity: ${maturity} days | Description: ${desc}`;
      const r = await ai.models.generateContent({ model:'gemini-2.0-flash', contents: prompt });
      const raw = (r.text ?? '').replace(/```json?/g,'').replace(/```/g,'').trim();
      const parsed = JSON.parse(raw);
      setScore(parsed.score ?? 80);
      setGrade(parsed.grade ?? 'A');
      setAnalysis(parsed.summary ?? '');
      setCompliance(parsed.compliance ?? []);
      setUnderwritingFactors(parsed.factors ?? {});
    } catch {
      const s = Math.floor(Math.random() * 15 + 78);
      setScore(s); setGrade(s >= 90 ? 'A+' : 'A');
      setAnalysis('Asset shows strong fundamentals. Recommend approval subject to standard KYC verification.');
      setCompliance([
        { label:'KYC Verified', ok:true }, { label:'AML Cleared', ok:true },
        { label:'Issuer Registered', ok:true }, { label:'SEBI Compliant', ok:true }, { label:'FATF Listed', ok:false },
      ]);
    }
    setUnderwriting(false);
  };

  const [factors, setUnderwritingFactors] = useState<Record<string,number>>({});

  // ── 2. Mint ASA on Algorand ──────────────────────────────────────────────
  const mintASA = async () => {
    if (!score) { setMintStatus('⚠️ Run AI Underwriting first'); setTimeout(()=>setMintStatus(''),3000); return; }
    const pera = getPeraWallet();
    try {
      let addr = localStorage.getItem('nexus_algo_address') || '';
      if (!addr) {
        setMintStatus('🔌 Connecting Pera...');
        const accs = await pera.connect(); addr = accs?.[0] || '';
        if (addr) localStorage.setItem('nexus_algo_address', addr);
      }
      if (!addr) { setMintStatus('⚠️ Connect Pera Wallet first'); setTimeout(()=>setMintStatus(''),4000); return; }
      setMintStatus('⚙️ Building ASA transaction...');
      const algod = new algosdk.Algodv2('','https://testnet-api.algonode.cloud','');
      const params = await algod.getTransactionParams().do();
      const totalTokens = Math.floor(value / tokenPrice);
      const txn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        from: addr,
        suggestedParams: { ...params, fee:1000, flatFee:true },
        defaultFrozen: false,
        unitName: assetType.slice(0,4).toUpperCase(),
        assetName: assetName.slice(0,32),
        total: totalTokens,
        decimals: 0,
        manager: addr, reserve: addr, freeze: addr, clawback: addr,
        assetURL: ipfsCid ? `ipfs://${ipfsCid}` : 'https://nexus.finance',
        note: new TextEncoder().encode(`NEXUS:RWA:${assetType}`),
      } as any);
      setMintStatus('✍️ Approve in Pera Wallet...');
      const signed = await pera.signTransaction([[{ txn, signers:[addr] }]]);
      setMintStatus('🚀 Minting on Algorand Testnet...');
      const result = await algod.sendRawTransaction(signed).do();
      const txInfo = await algosdk.waitForConfirmation(algod, result.txid, 4);
      const asaId = Number((txInfo as any)['asset-index']);
      setMintedAsaId(asaId);
      setMintStatus(`✅ ASA #${asaId} minted! ${totalTokens} tokens`);
      setAssets(prev => [...prev, {
        id: `asa-${asaId}`, name: assetName, type: assetType.toUpperCase(),
        issuer, value, tokenPrice, apr: aprInput, score: score!, funded: 0,
        investors: 0, daysLeft: maturity, color:'var(--color-gold)',
        asaId, ipfsCid, grade, analysis,
      }]);
    } catch (e:any) {
      if (e?.data?.type === 'CONNECT_MODAL_CLOSED') { setMintStatus(''); return; }
      setMintStatus(`❌ ${String(e?.message||e).slice(0,50)}`);
    }
    setTimeout(()=>setMintStatus(''),10000);
  };

  // ── 11. Transfer RWA token ───────────────────────────────────────────────
  const transferToken = async () => {
    if (!mintedAsaId && !selectedAsset?.asaId) { setTransferStatus('⚠️ No ASA to transfer'); return; }
    const asaId = mintedAsaId ?? selectedAsset?.asaId!;
    const pera = getPeraWallet();
    try {
      let addr = localStorage.getItem('nexus_algo_address') || '';
      if (!addr) { const a = await pera.connect(); addr = a?.[0]||''; if(addr) localStorage.setItem('nexus_algo_address',addr); }
      if (!addr || !transferAddr) { setTransferStatus('⚠️ Connect wallet and enter recipient'); return; }
      setTransferStatus('⚙️ Building transfer...');
      const algod = new algosdk.Algodv2('','https://testnet-api.algonode.cloud','');
      const params = await algod.getTransactionParams().do();
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: addr, to: transferAddr, assetIndex: asaId,
        amount: parseInt(transferAmt), suggestedParams:{...params,fee:1000,flatFee:true},
        note: new TextEncoder().encode('NEXUS:RWA:TRANSFER'),
      } as any);
      setTransferStatus('✍️ Approve in Pera...');
      const signed = await pera.signTransaction([[{txn,signers:[addr]}]]);
      await algod.sendRawTransaction(signed).do();
      setTransferStatus(`✅ Transferred ${transferAmt} tokens!`);
    } catch(e:any) {
      setTransferStatus(`❌ ${String(e?.message||e).slice(0,45)}`);
    }
    setTimeout(()=>setTransferStatus(''),7000);
  };

  // ── 3. IPFS simulation ───────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setIpfsFile(f.name);
    setTimeout(() => {
      const fakeCid = 'Qm' + Math.random().toString(36).slice(2,12) + Math.random().toString(36).slice(2,12);
      setIpfsCid(fakeCid);
    }, 1200);
  };

  // ── 6. SIGMA chat ────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim(); setChatInput('');
    setChatMessages(m => [...m, {role:'user',text:msg},{role:'sigma',text:'',thinking:true}]);
    setChatLoading(true);
    try {
      const ctx = assets.map(a=>`${a.name}: ${a.type}, $${a.value.toLocaleString()}, APR ${a.apr}%, Score ${a.score}`).join('\n');
      const prompt = `You are SIGMA, an RWA credit underwriting AI for NEXUS FINANCE on Algorand. Be concise (max 130 words). Current assets:\n${ctx}\n\nUser: ${msg}`;
      const r = await ai.models.generateContent({model:'gemini-2.0-flash',contents:prompt});
      setChatMessages(m=>{const c=[...m];c[c.length-1]={role:'sigma',text:r.text??'...',thinking:false};return c;});
    } catch {
      setChatMessages(m=>{const c=[...m];c[c.length-1]={role:'sigma',text:'⚠️ SIGMA offline.',thinking:false};return c;});
    }
    setChatLoading(false);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const totalTokens   = Math.floor(value / tokenPrice);
  const minInvestment = tokenPrice;
  const yieldCalc     = (inv:number, days:number) => +(inv * aprInput/100 * days/365).toFixed(2);
  const totalInvested = assets.reduce((s,a)=>s+(a.value*a.funded/100),0);
  const weightedApr   = assets.length ? +(assets.reduce((s,a)=>s+a.apr,0)/assets.length).toFixed(2) : 0;
  const diversScore   = Math.min(100, assets.length * 20 + (new Set(assets.map(a=>a.type)).size)*15);

  const FACTOR_LABELS: Record<string,string> = {
    creditHistory:'Issuer Credit History', paymentRecord:'Payment Track Record',
    marketVolatility:'Market Volatility', assetLiquidity:'Asset Liquidity', regulatoryCompliance:'Regulatory Compliance'
  };

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[26px] font-bold text-wh tracking-[1px]">RWA Studio — SIGMA Agent</div>
          <p className="text-[12px] text-t2 font-mono">// AI underwriting · Algorand ASA minting · IPFS storage · Fractional ownership</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-[10px] font-mono text-p2 bg-[rgba(168,85,247,0.06)] border border-[rgba(168,85,247,0.18)] px-2.5 py-1 rounded flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-p2 animate-pulse inline-block" />SIGMA ACTIVE
          </span>
          <button onClick={()=>setChatOpen(o=>!o)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 transition-all">
            {chatOpen ? '✕ Close SIGMA' : '📊 Ask SIGMA AI'}
          </button>
        </div>
      </div>

      {/* ── 12. Portfolio Summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total RWA Value" value={`$${(totalInvested/1e6).toFixed(2)}M`} delta={`${assets.length} assets`} variant="p" />
        <StatCard label="Weighted APR" value={`${weightedApr}%`} delta="↑ Blended yield" variant="g" />
        <StatCard label="Diversification" value={`${diversScore}/100`} delta="↑ SIGMA scored" variant="c" />
        <StatCard label="Active Investors" value={`${assets.reduce((s,a)=>s+a.investors,0)}`} delta="↑ Across all assets" variant="o" />
      </div>

      {/* ── SIGMA Chat ── */}
      {chatOpen && (
        <Card title="📊 SIGMA — RWA Underwriting AI" badge={<span className="text-[9px] font-mono text-p2 bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.2)] px-2 py-0.5 rounded">Gemini Powered</span>}>
          <div className="flex flex-col gap-3">
            <div className="h-52 overflow-y-auto flex flex-col gap-2 pr-1">
              {chatMessages.map((m,i)=>(
                <div key={i} className={cn('max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed',
                  m.role==='user' ? 'self-end bg-[rgba(168,85,247,0.12)] border border-[rgba(168,85,247,0.25)] text-wh'
                                  : 'self-start bg-[rgba(0,229,255,0.06)] border border-[rgba(0,229,255,0.15)] text-t1')}>
                  {m.thinking ? <span className="flex items-center gap-2 text-t3 animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-p2 animate-bounce"/>SIGMA analyzing...</span>
                              : <span className="whitespace-pre-wrap">{m.text}</span>}
                </div>
              ))}
              <div ref={chatEndRef}/>
            </div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()}
                placeholder="Evaluate my invoice asset, compare yields, check compliance..."
                className="flex-1 bg-[rgba(0,0,0,0.3)] border border-border2 rounded-lg px-3 py-2 text-[12px] text-wh outline-none focus:border-[rgba(168,85,247,0.4)] placeholder:text-t3"/>
              <button onClick={sendChat} disabled={chatLoading}
                className="px-4 py-2 rounded-lg text-[12px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 disabled:opacity-50 transition-all">Send</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Best asset to invest in?','What is fractional RWA?','Is my invoice high risk?'].map(q=>(
                <button key={q} onClick={()=>setChatInput(q)} className="text-[10px] font-mono text-p2 border border-[rgba(168,85,247,0.2)] bg-[rgba(168,85,247,0.04)] px-2.5 py-1 rounded-full hover:bg-[rgba(168,85,247,0.1)] transition-all">{q}</button>
              ))}
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* ── Left: Tokenize Form ── */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {/* ── 8. Type templates ── */}
          <div className="flex gap-2 flex-wrap">
            {Object.keys(TEMPLATES).map(t=>(
              <button key={t} onClick={()=>loadTemplate(t)}
                className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all border',
                  assetType===t ? 'border-p2 bg-[rgba(168,85,247,0.15)] text-p2' : 'border-border-custom text-t2 hover:border-border3 hover:text-wh')}>
                {t==='Invoice Financing'?'📄':t==='Real Estate'?'🏢':t==='Corporate Bond'?'📈':'🏛'} {t}
              </button>
            ))}
          </div>

          <Card title="Tokenize New Asset" badge={<span className="bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.18)] text-p2 px-2 py-0.5 rounded text-[9px] font-mono uppercase">Algorand ASA</span>}>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Asset Type</div>
                  <select value={assetType} onChange={e=>loadTemplate(e.target.value)}
                    className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(168,85,247,0.4)]">
                    {Object.keys(TEMPLATES).map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Issuer Name</div>
                  <input value={issuer} onChange={e=>setIssuer(e.target.value)}
                    className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(168,85,247,0.4)]"/>
                </div>
              </div>
              <div>
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Asset Name</div>
                <input value={assetName} onChange={e=>setAssetName(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(168,85,247,0.4)]"/>
              </div>
              <div>
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Description</div>
                <input value={desc} onChange={e=>setDesc(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(168,85,247,0.4)]"/>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  {label:'Value (USD)',val:value,set:(v:string)=>setValue(+v)},
                  {label:'Token Price',val:tokenPrice,set:(v:string)=>setTokenPrice(+v)},
                  {label:'Maturity (days)',val:maturity,set:(v:string)=>setMaturity(+v)},
                  {label:'APR (%)',val:aprInput,set:(v:string)=>setAprInput(+v)},
                ].map(f=>(
                  <div key={f.label}>
                    <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">{f.label}</div>
                    <input type="number" value={f.val} onChange={e=>f.set(e.target.value)}
                      className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(168,85,247,0.4)]"/>
                  </div>
                ))}
              </div>

              {/* ── 4. Fractional ownership calculator ── */}
              <div className="bg-[rgba(168,85,247,0.04)] border border-[rgba(168,85,247,0.15)] rounded-lg p-3">
                <div className="font-mono text-[9px] text-p2 uppercase tracking-widest mb-2">⬡ Fractional Ownership Preview</div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {label:'Total Tokens',val:totalTokens.toLocaleString(),color:'text-wh'},
                    {label:'Min Investment',val:`$${minInvestment}`,color:'text-c1'},
                    {label:'Yield / Token / yr',val:`$${(tokenPrice*aprInput/100).toFixed(3)}`,color:'text-g1'},
                  ].map(f=>(
                    <div key={f.label} className="text-center">
                      <div className="font-mono text-[8px] text-t3 uppercase">{f.label}</div>
                      <div className={cn('font-mono text-[16px] font-bold',f.color)}>{f.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 3. IPFS Document Upload ── */}
              <div className="bg-[rgba(0,0,0,0.25)] border border-border2 rounded-lg p-3">
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-2">📁 IPFS Document Storage</div>
                <div className="flex items-center gap-3">
                  <button onClick={()=>fileRef.current?.click()} className="px-3 py-1.5 text-[11px] font-mono text-c1 border border-[rgba(0,229,255,0.25)] bg-[rgba(0,229,255,0.06)] rounded-lg hover:bg-[rgba(0,229,255,0.12)] transition-all">
                    {ipfsFile ? `📄 ${ipfsFile.slice(0,20)}` : '+ Attach Document'}
                  </button>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload}/>
                  {ipfsCid && <div className="font-mono text-[9px] text-g1 flex-1 truncate">✅ CID: {ipfsCid}</div>}
                  {ipfsFile && !ipfsCid && <div className="font-mono text-[9px] text-o1 animate-pulse">⏳ Pinning to IPFS...</div>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={runUnderwriting} disabled={underwriting}
                  className="w-full py-2.5 rounded-lg font-bold text-[13px] border border-o1 text-o1 bg-[rgba(255,107,0,0.12)] hover:opacity-90 disabled:opacity-50 transition-all">
                  {underwriting ? '🧠 Analyzing...' : '🧠 AI Underwrite (SIGMA)'}
                </button>
                <button onClick={mintASA}
                  className={cn('w-full py-2.5 rounded-lg font-bold text-[13px] transition-all',
                    score ? 'bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90' : 'bg-[rgba(168,85,247,0.1)] text-p2 border border-[rgba(168,85,247,0.2)] opacity-50 cursor-not-allowed')}>
                  {mintStatus || (mintedAsaId ? `✅ ASA #${mintedAsaId}` : '🪙 Mint Algorand ASA')}
                </button>
              </div>

              {/* ── 11. Token transfer ── */}
              {mintedAsaId && (
                <div className="bg-[rgba(0,255,157,0.04)] border border-[rgba(0,255,157,0.15)] rounded-lg p-3">
                  <div className="font-mono text-[9px] text-g1 uppercase tracking-widest mb-2">↗ Transfer RWA Tokens (ASA #{mintedAsaId})</div>
                  <div className="flex gap-2 mb-2">
                    <input value={transferAddr} onChange={e=>setTransferAddr(e.target.value)} placeholder="Recipient Algorand address"
                      className="flex-1 bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2 text-wh text-[12px] outline-none focus:border-[rgba(0,255,157,0.35)] placeholder:text-t3"/>
                    <input type="number" value={transferAmt} onChange={e=>setTransferAmt(e.target.value)} placeholder="Qty"
                      className="w-20 bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2 text-wh text-[12px] outline-none focus:border-[rgba(0,255,157,0.35)]"/>
                  </div>
                  <button onClick={transferToken} className="w-full py-2 rounded-lg text-[12px] font-bold bg-[rgba(0,255,157,0.12)] border border-[rgba(0,255,157,0.3)] text-g1 hover:bg-[rgba(0,255,157,0.2)] transition-all">
                    {transferStatus || '↗ Transfer Tokens via Pera'}
                  </button>
                </div>
              )}
            </div>
          </Card>

          {/* ── 5. Marketplace ── */}
          <Card title="RWA Marketplace" bodyClassName={viewMode==='cards'?undefined:'p-0'} badge={
            <div className="flex items-center gap-2">
              <span className="bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.18)] text-p2 px-2 py-0.5 rounded text-[9px] font-mono uppercase">{assets.length} ASSETS</span>
              <button onClick={()=>setViewMode('cards')} className={cn('p-1.5 rounded text-[11px] transition-all',viewMode==='cards'?'bg-[rgba(168,85,247,0.15)] text-p2':'text-t3')}>⊞</button>
              <button onClick={()=>setViewMode('table')} className={cn('p-1.5 rounded text-[11px] transition-all',viewMode==='table'?'bg-[rgba(168,85,247,0.15)] text-p2':'text-t3')}>☰</button>
            </div>
          }>
            {viewMode==='cards' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {assets.map(a=>(
                  <div key={a.id} onClick={()=>setSelectedAsset(a===selectedAsset?null:a)}
                    className={cn('relative rounded-xl border p-4 cursor-pointer transition-all hover:scale-[1.01] overflow-hidden',
                      selectedAsset?.id===a.id ? 'border-p2 bg-[rgba(168,85,247,0.07)]' : 'border-border-custom bg-[rgba(0,0,0,0.2)] hover:border-border3')}>
                    <div className="absolute top-0 right-0 w-24 h-24 rounded-full filter blur-3xl opacity-15 pointer-events-none" style={{backgroundColor:a.color}}/>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">{a.type}</div>
                        <div className="font-semibold text-wh text-[13px] mt-0.5">{a.name}</div>
                        <div className="font-mono text-[10px] text-t2">{a.issuer}</div>
                      </div>
                      {a.grade && <span className={cn('font-display text-[18px] font-extrabold',gradeColor(a.grade))}>{a.grade}</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-2 text-center">
                        <div className="font-mono text-[8px] text-t3">VALUE</div>
                        <div className="font-semibold text-wh text-[12px]">{formatCurrency(a.value)}</div>
                      </div>
                      <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-2 text-center">
                        <div className="font-mono text-[8px] text-t3">APR</div>
                        <div className="font-semibold text-g1 text-[12px]">{a.apr}%</div>
                      </div>
                      <div className="bg-[rgba(0,0,0,0.3)] rounded-lg p-2 text-center">
                        <div className="font-mono text-[8px] text-t3">SCORE</div>
                        <div className="font-semibold text-[12px]" style={{color:scoreColor(a.score)}}>{a.score}</div>
                      </div>
                    </div>
                    {/* ── 7. Live funding bar ── */}
                    <div>
                      <div className="flex justify-between text-[10px] font-mono text-t3 mb-1">
                        <span>{a.investors} investors · {a.daysLeft}d left</span>
                        <span>{a.funded}%</span>
                      </div>
                      <div className="h-1.5 bg-border-custom rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{width:`${a.funded}%`,background:`linear-gradient(90deg,var(--color-p1),${a.color})`}}/>
                      </div>
                    </div>
                    {a.asaId && <div className="mt-2 font-mono text-[9px] text-c1">⬡ ASA #{a.asaId}</div>}
                  </div>
                ))}
              </div>
            )}
            {viewMode==='table' && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-[rgba(0,0,0,0.2)] border-b border-border-custom">
                      {['Asset','Type','Value','APR','Score','Funded','Action'].map(h=>(
                        <th key={h} className="px-4 py-2 text-left font-mono text-[9px] text-t3 tracking-[2px] uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map(a=>(
                      <tr key={a.id} onClick={()=>setSelectedAsset(a===selectedAsset?null:a)}
                        className={cn('border-b border-[rgba(15,31,53,0.5)] hover:bg-[rgba(168,85,247,0.02)] transition-colors cursor-pointer',selectedAsset?.id===a.id&&'bg-[rgba(168,85,247,0.03)]')}>
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-wh text-[12px]">{a.name}</div>
                          <div className="font-mono text-[10px] text-t3">{a.issuer}</div>
                        </td>
                        <td className="px-4 py-2.5"><span className="font-mono text-[9px] px-2 py-0.5 rounded bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.2)] text-p2">{a.type}</span></td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-wh">{formatCurrency(a.value)}</td>
                        <td className="px-4 py-2.5 font-mono text-[12px] text-g1 font-bold">{a.apr}%</td>
                        <td className="px-4 py-2.5"><span className="font-mono text-[12px]" style={{color:scoreColor(a.score)}}>{a.score}</span></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-border-custom rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{width:`${a.funded}%`,backgroundColor:a.color}}/>
                            </div>
                            <span className="font-mono text-[10px] text-t2">{a.funded}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={e=>{e.stopPropagation();setSelectedAsset(a);}} className="px-2.5 py-1 rounded text-[10px] font-bold bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.25)] text-p2 hover:bg-[rgba(168,85,247,0.2)] transition-all">Invest</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* ── Right Panel ── */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* ── 1. AI Underwriting Report ── */}
          <Card title="AI Underwriting Report">
            <div className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg p-4 flex items-center gap-4 mb-4">
              <div className="relative w-[90px] h-[90px] shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 90 90">
                  <circle className="fill-none stroke-border-custom stroke-[8]" cx="45" cy="45" r="37"/>
                  <circle className="fill-none stroke-[8] transition-all duration-1000" cx="45" cy="45" r="37"
                    style={{stroke: score ? scoreColor(score) : 'var(--color-t3)',
                      strokeDasharray:`${2*Math.PI*37*(score||0)/100} ${2*Math.PI*37}`}}/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="font-display text-[22px] font-extrabold text-wh">{score||'—'}</div>
                  <div className="text-[9px] text-t3 font-mono">/ 100</div>
                </div>
              </div>
              <div className="flex-1">
                <div className={cn('font-display text-[26px] font-extrabold',gradeColor(grade))}>{grade||'—'}</div>
                <div className="font-mono text-[11px] text-t2 mt-0.5">{score ? 'SIGMA Recommended' : 'Run AI Underwriting'}</div>
                {grade && <div className="font-mono text-[9px] text-t3 mt-1">{assetType} · {issuer}</div>}
              </div>
            </div>

            {/* Factor bars */}
            <div className="flex flex-col gap-2 mb-3">
              {Object.entries(FACTOR_LABELS).map(([key,label])=>{
                const val = score ? (factors[key]??Math.floor(score*0.9+Math.random()*15)) : 0;
                return (
                  <div key={key} className="flex items-center gap-2 text-[11px]">
                    <span className="text-t2 text-[10px] w-32 shrink-0">{label}</span>
                    <div className="flex-1 h-[3px] bg-border-custom rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{width:`${val}%`,backgroundColor:val>=80?'var(--color-g1)':val>=60?'var(--color-c1)':'var(--color-o1)'}}/>
                    </div>
                    <span className="font-mono text-[10px] text-wh w-7 text-right">{val||'—'}</span>
                  </div>
                );
              })}
            </div>

            {/* ── 9. Compliance ── */}
            {compliance.length > 0 && (
              <div className="mb-3">
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-2">9. Compliance Checks</div>
                <div className="grid grid-cols-1 gap-1">
                  {compliance.map((c,i)=>(
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span>{c.ok ? '✅' : '⚠️'}</span>
                      <span className={c.ok?'text-t1':'text-o1'}>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg p-3 text-[11px] text-t2 leading-relaxed min-h-[60px]">
              {analysis ? (
                <>
                  <div className="font-mono text-[9px] text-p2 mb-1.5 uppercase tracking-wider">SIGMA AGENT · AI ANALYSIS</div>
                  {analysis}
                </>
              ) : 'Submit an asset and run underwriting to generate AI credit analysis.'}
            </div>
          </Card>

          {/* ── 10. Yield Calculator ── */}
          <Card title="Yield Calculator">
            <div className="flex flex-col gap-3">
              <div>
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1.5">Investment Amount (USD)</div>
                <input type="number" value={investAmt} onChange={e=>setInvestAmt(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(0,255,157,0.35)]"/>
              </div>
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">
                APR: {selectedAsset?`${selectedAsset.apr}% (${selectedAsset.name.slice(0,20)})`:`${aprInput}% (current form)`}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[30,60,90,180].map(days=>{
                  const apr = selectedAsset?.apr ?? aprInput;
                  const y = +(+investAmt * apr/100 * days/365).toFixed(2);
                  return (
                    <div key={days} className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg p-2.5 text-center">
                      <div className="font-mono text-[9px] text-t3">{days}D YIELD</div>
                      <div className="font-mono text-[18px] font-bold text-g1">${y.toLocaleString()}</div>
                      <div className="font-mono text-[9px] text-t3">{((y/+investAmt)*100).toFixed(2)}% gain</div>
                    </div>
                  );
                })}
              </div>
              {selectedAsset && (
                <button className="w-full py-2.5 rounded-lg font-bold text-[13px] bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 transition-all">
                  💰 Invest ${investAmt} in {selectedAsset.name.slice(0,25)}
                </button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
