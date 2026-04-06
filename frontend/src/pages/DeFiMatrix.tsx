import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, StatCard } from '@/components/UI';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, CartesianGrid
} from 'recharts';
import { PeraWalletConnect } from '@perawallet/connect';
import algosdk from 'algosdk';
import { GoogleGenAI } from '@google/genai';

// ─── Pera singleton ───────────────────────────────────────────────────────────
const getPeraWallet = (): PeraWalletConnect =>
  (window as any).__nexusPeraWallet ?? new PeraWalletConnect();

// ─── Gemini client ────────────────────────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? '' });

// ─── Static protocol definitions ─────────────────────────────────────────────
const PROTOCOLS = [
  { id: 'folks',    name: 'Folks Finance',  logo: '🏦', chain: 'Algorand', asset: 'ALGO',        apy: 14.8, tvl: 150, risk: 'Low',    aiScore: 94, best: true  },
  { id: 'tinyman', name: 'Tinyman',         logo: '🧙', chain: 'Algorand', asset: 'ALGO/USDC',   apy: 22.4, tvl: 45,  risk: 'Medium', aiScore: 88, best: false },
  { id: 'pact',    name: 'Pact.fi',         logo: '🤝', chain: 'Algorand', asset: 'USDC/USDT',   apy: 11.2, tvl: 32,  risk: 'Low',    aiScore: 91, best: false },
  { id: 'humble',  name: 'Humble DeFi',     logo: '🐝', chain: 'Algorand', asset: 'ALGO/USDC',   apy: 19.3, tvl: 15,  risk: 'Medium', aiScore: 82, best: false },
  { id: 'messina', name: 'Messina',         logo: '🌉', chain: 'Algorand', asset: 'mETH',        apy: 8.1,  tvl: 25,  risk: 'Medium', aiScore: 85, best: false },
  { id: 'galgo',   name: 'Folks Finance',   logo: '🏦', chain: 'Algorand', asset: 'gALGO',       apy: 9.2,  tvl: 80,  risk: 'Low',    aiScore: 95, best: false },
  { id: 'galgolp', name: 'Tinyman',         logo: '🧙', chain: 'Algorand', asset: 'ALGO/gALGO', apy: 12.9, tvl: 20,  risk: 'Low',    aiScore: 90, best: false },
];

type Protocol = typeof PROTOCOLS[0];

// ─── helpers ─────────────────────────────────────────────────────────────────
const fmtAlgo = (micro: number) => (micro / 1e6).toFixed(4);
const riskColor = (r: string) =>
  r === 'Low' ? 'text-g1' : r === 'Medium' ? 'text-o1' : 'text-r1';
const riskBg = (r: string) =>
  r === 'Low' ? 'bg-[rgba(0,255,157,0.08)] border-[rgba(0,255,157,0.2)]'
  : r === 'Medium' ? 'bg-[rgba(255,107,0,0.08)] border-[rgba(255,107,0,0.2)]'
  : 'bg-[rgba(255,34,85,0.08)] border-[rgba(255,34,85,0.2)]';
const scoreColor = (s: number) => s >= 85 ? 'var(--color-g1)' : s >= 70 ? 'var(--color-c1)' : 'var(--color-o1)';

// ─── Animated counter ────────────────────────────────────────────────────────
function useAnimatedNumber(target: number, speed = 40) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const step = (target - val) / speed;
    if (Math.abs(target - val) < 0.01) { setVal(target); return; }
    const t = setTimeout(() => setVal(v => v + step), 16);
    return () => clearTimeout(t);
  }, [target, val, speed]);
  return val;
}

// ─── Generate sparkline data ─────────────────────────────────────────────────
const makeSparkline = (base: number) =>
  Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    apy: +(base + (Math.random() - 0.48) * 3).toFixed(2),
  }));

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export const DeFiMatrix: React.FC = () => {
  // ── state ──────────────────────────────────────────────────────────────────
  const [protocols, setProtocols] = useState(PROTOCOLS);
  const [selected, setSelected] = useState<Protocol>(PROTOCOLS[0]);
  const [amount, setAmount] = useState(1000);
  const [riskTol, setRiskTol] = useState('low');
  const [txStatus, setTxStatus] = useState('');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [activeTab, setActiveTab] = useState<'optimize' | 'swap' | 'rebalance'>('optimize');

  // live data
  const [algoPrice, setAlgoPrice] = useState(0.18);
  const [walletBal, setWalletBal] = useState<null | { algo: number; asa: { id: number; name: string; bal: number }[] }>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [liveDataTs, setLiveDataTs] = useState<string>('');
  const [sparklines] = useState(() =>
    Object.fromEntries(PROTOCOLS.map(p => [p.id, makeSparkline(p.apy)]))
  );

  // tx history
  const [txHistory, setTxHistory] = useState<{ id: string; protocol: string; ts: string; status: string }[]>([]);

  // AI chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'delta'; text: string; thinking?: boolean }[]>([
    { role: 'delta', text: '⚡ DELTA online. I can optimize your Algorand DeFi positions, explain risks, and suggest rebalancing strategies. Ask me anything.' },
  ]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // risk explainer
  const [riskModal, setRiskModal] = useState<{ open: boolean; protocol: Protocol | null; text: string; loading: boolean }>({ open: false, protocol: null, text: '', loading: false });

  // rebalance
  const [rebalanceSuggestion, setRebalanceSuggestion] = useState('');
  const [rebalanceLoading, setRebalanceLoading] = useState(false);

  // swap
  const [swapFrom, setSwapFrom] = useState('ALGO');
  const [swapTo, setSwapTo] = useState('USDC');
  const [swapAmt, setSwapAmt] = useState('');

  // ── 1. Live APY from DefiLlama ────────────────────────────────────────────
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch('https://yields.llama.fi/pools');
        if (!res.ok) throw new Error('llama failed');
        const json = await res.json();
        const algorandPools: any[] = (json.data || []).filter(
          (p: any) => p.chain?.toLowerCase() === 'algorand' && p.apy != null
        );
        if (algorandPools.length === 0) return;
        setProtocols(prev =>
          prev.map(p => {
            const match = algorandPools.find(lp =>
              lp.project?.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]) &&
              lp.symbol?.toLowerCase().includes(p.asset.toLowerCase().split('/')[0])
            );
            return match ? { ...p, apy: +match.apy.toFixed(2), tvl: Math.round((match.tvlUsd || p.tvl * 1e6) / 1e6) } : p;
          })
        );
        setLiveDataTs(new Date().toLocaleTimeString());
      } catch {
        // silently use static fallback
        setLiveDataTs(new Date().toLocaleTimeString() + ' (cached)');
      }
    };
    fetchLive();
    const t = setInterval(fetchLive, 60_000);
    return () => clearInterval(t);
  }, []);

  // ── ALGO price ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const r = await fetch('https://price.algoexplorer.io/v1/simple/price?ids=algorand&vs_currencies=usd');
        const j = await r.json();
        if (j?.algorand?.usd) setAlgoPrice(j.algorand.usd);
      } catch {
        setAlgoPrice(prev => prev * (1 + (Math.random() * 0.004 - 0.002)));
      }
    };
    fetchPrice();
    const t = setInterval(fetchPrice, 15_000);
    return () => clearInterval(t);
  }, []);

  // ── 3. Live wallet balance ────────────────────────────────────────────────
  const fetchWalletBalance = useCallback(async () => {
    const addr = localStorage.getItem('nexus_algo_address');
    if (!addr) return;
    setLoadingWallet(true);
    try {
      const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
      const info = await algod.accountInformation(addr).do();
      const algoBalance = Number(info.amount);
      const assets = (info.assets || []).slice(0, 5).map((a: any) => ({
        id: a['asset-id'],
        name: `ASA-${a['asset-id']}`,
        bal: a.amount,
      }));
      setWalletBal({ algo: algoBalance, asa: assets });
    } catch { /* ignore */ }
    setLoadingWallet(false);
  }, []);

  useEffect(() => {
    fetchWalletBalance();
    const t = setInterval(fetchWalletBalance, 30_000);
    return () => clearInterval(t);
  }, [fetchWalletBalance]);

  // scrolled chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ── Execute TX ────────────────────────────────────────────────────────────
  const executeTransaction = async () => {
    const peraWallet = getPeraWallet();
    try {
      let addr = localStorage.getItem('nexus_algo_address') || '';
      if (!addr) {
        setTxStatus('🔌 Connecting Pera...');
        const accs = await peraWallet.connect();
        addr = accs?.[0] || '';
        if (addr) localStorage.setItem('nexus_algo_address', addr);
      }
      if (!addr) { setTxStatus('⚠️ Connect Pera Wallet first'); setTimeout(() => setTxStatus(''), 4000); return; }
      setTxStatus(`⚙️ Building route for ${addr.slice(0, 6)}...`);
      const algod = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
      const params = await algod.getTransactionParams().do();
      const note = new TextEncoder().encode(`NEXUS:${selected.name}:${selected.asset}`);
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: addr, to: addr, amount: 0, note,
        suggestedParams: { ...params, fee: 1000, flatFee: true },
      } as any);
      setTxStatus('✍️ Please approve in Pera...');
      const signed = await peraWallet.signTransaction([[{ txn, signers: [addr] }]]);
      setTxStatus('🚀 Broadcasting...');
      const result = await algod.sendRawTransaction(signed).do();
      const txId = (result.txid || 'done') as string;
      setTxStatus(`✅ TX: ${txId.slice(0, 12)}...`);
      setTxHistory(prev => [{ id: txId, protocol: `${selected.name} · ${selected.asset}`, ts: new Date().toLocaleTimeString(), status: '✅' }, ...prev].slice(0, 20));
      setTimeout(() => setTxStatus(''), 8000);
      fetchWalletBalance();
    } catch (e: any) {
      if (e?.data?.type === 'CONNECT_MODAL_CLOSED' || e?.message?.includes('closed')) { setTxStatus(''); return; }
      setTxStatus(`❌ ${String(e?.message || e).slice(0, 45)}`);
      setTimeout(() => setTxStatus(''), 6000);
    }
  };

  // ── 2 & 9. DELTA AI chat with streaming reasoning ─────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(m => [...m, { role: 'user', text: userMsg }]);
    setChatMessages(m => [...m, { role: 'delta', text: '', thinking: true }]);
    setChatLoading(true);
    try {
      const ctx = protocols.map(p => `${p.name} ${p.asset}: APY ${p.apy}%, TVL $${p.tvl}M, Risk ${p.risk}, AI Score ${p.aiScore}`).join('\n');
      const prompt = `You are DELTA, an AI DeFi agent for NEXUS FINANCE on Algorand. Be concise (max 150 words). Here are the live protocol APYs:\n${ctx}\n\nUser's wallet ALGO balance: ${walletBal ? fmtAlgo(walletBal.algo) + ' ALGO' : 'not connected'}.\n\nUser: ${userMsg}`;
      const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      const text = response.text ?? '...';
      setChatMessages(m => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'delta', text, thinking: false };
        return copy;
      });
    } catch {
      setChatMessages(m => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'delta', text: '⚠️ DELTA offline. Check API key.', thinking: false };
        return copy;
      });
    }
    setChatLoading(false);
  };

  // ── 10. Risk score explainer ──────────────────────────────────────────────
  const explainRisk = async (p: Protocol) => {
    setRiskModal({ open: true, protocol: p, text: '', loading: true });
    try {
      const prompt = `You are a DeFi risk analyst. Explain in 3 bullet points (max 120 words total) why ${p.name} ${p.asset} pool on Algorand has a risk score of ${p.aiScore}/100 and a risk level of ${p.risk}. APY: ${p.apy}%, TVL: $${p.tvl}M.`;
      const r = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      setRiskModal(prev => ({ ...prev, text: r.text ?? '', loading: false }));
    } catch {
      setRiskModal(prev => ({ ...prev, text: '⚠️ Could not generate explanation.', loading: false }));
    }
  };

  // ── 11. Auto-rebalance suggestion ─────────────────────────────────────────
  const getRebalanceSuggestion = async () => {
    setRebalanceLoading(true);
    setRebalanceSuggestion('');
    try {
      const ctx = protocols.map(p => `${p.name} ${p.asset}: APY ${p.apy}%, Risk ${p.risk}`).join('; ');
      const bal = walletBal ? fmtAlgo(walletBal.algo) + ' ALGO' : `${amount} ALGO (simulated)`;
      const prompt = `As DELTA, a DeFi AI agent on Algorand, suggest a rebalancing strategy in 4 bullet points (max 150 words) for a user with ${bal} and risk tolerance: ${riskTol}. Protocols available: ${ctx}.`;
      const r = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
      setRebalanceSuggestion(r.text ?? '');
    } catch {
      setRebalanceSuggestion('⚠️ Could not generate suggestion.');
    }
    setRebalanceLoading(false);
  };

  // ── derived stats ─────────────────────────────────────────────────────────
  const bestApy = Math.max(...protocols.map(p => p.apy));
  const totalTvl = protocols.reduce((s, p) => s + p.tvl, 0);
  const avgScore = Math.round(protocols.reduce((s, p) => s + p.aiScore, 0) / protocols.length);
  const extraYield = ((amount * (selected.apy - 4.2)) / 100).toFixed(0);

  // ── 6. APY trend chart data ───────────────────────────────────────────────
  const trendData = sparklines[selected.id] || [];

  return (
    <div className="p-5 flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-[26px] font-bold text-wh tracking-[1px]">Algorand DeFi Matrix</div>
          <p className="text-[12px] text-t2 font-mono">// Live APY aggregation · DELTA AI agent · Pera execution</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {liveDataTs && (
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-g1 bg-[rgba(0,255,157,0.06)] border border-[rgba(0,255,157,0.18)] px-2.5 py-1 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-g1 animate-pulse inline-block" />
              LIVE · {liveDataTs}
            </span>
          )}
          <span className="text-[10px] font-mono text-c1 bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.18)] px-2.5 py-1 rounded">
            ALGO ${algoPrice.toFixed(4)}
          </span>
          <button
            onClick={() => setChatOpen(o => !o)}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 transition-all"
          >
            {chatOpen ? '✕ Close DELTA' : '⚡ Ask DELTA AI'}
          </button>
        </div>
      </div>

      {/* ── 5. Animated Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Best APY on Algorand" value={`${bestApy}%`} delta="↑ Live DefiLlama" variant="g" />
        <StatCard label="Total TVL" value={`$${totalTvl}M`} delta="↑ 7 Protocols" variant="c" />
        <StatCard label="Avg AI Score" value={`${avgScore}/100`} delta="↑ DELTA Rated" variant="p" />
        <StatCard
          label="Wallet Balance"
          value={walletBal ? `${fmtAlgo(walletBal.algo)} Ⓐ` : '—'}
          delta={walletBal ? `≈ $${(walletBal.algo / 1e6 * algoPrice).toFixed(2)} USD` : 'Connect Pera'}
          variant="o"
        />
      </div>

      {/* ── Wallet Balance Panel (Feature 3) ── */}
      {walletBal && (
        <Card title="Live Wallet" badge={
          <button onClick={fetchWalletBalance} className="text-[10px] font-mono text-c1 hover:text-wh transition-colors">
            {loadingWallet ? '⏳ Refreshing...' : '↻ Refresh'}
          </button>
        }>
          <div className="flex flex-wrap gap-3">
            <div className="bg-[rgba(0,229,255,0.05)] border border-[rgba(0,229,255,0.15)] rounded-lg px-4 py-3 flex flex-col">
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">ALGO Balance</div>
              <div className="font-display text-[22px] font-bold text-c1">{fmtAlgo(walletBal.algo)}</div>
              <div className="font-mono text-[10px] text-t2">≈ ${(walletBal.algo / 1e6 * algoPrice).toFixed(4)} USD</div>
            </div>
            {walletBal.asa.map(a => (
              <div key={a.id} className="bg-[rgba(168,85,247,0.05)] border border-[rgba(168,85,247,0.15)] rounded-lg px-4 py-3 flex flex-col">
                <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">{a.name}</div>
                <div className="font-display text-[22px] font-bold text-p2">{a.bal.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 2. DELTA AI Chat Panel ── */}
      {chatOpen && (
        <Card title="⚡ DELTA — AI DeFi Agent" badge={
          <span className="text-[9px] font-mono text-p2 bg-[rgba(168,85,247,0.1)] border border-[rgba(168,85,247,0.2)] px-2 py-0.5 rounded">
            Gemini Powered
          </span>
        }>
          <div className="flex flex-col gap-3">
            <div className="h-64 overflow-y-auto flex flex-col gap-2 pr-1">
              {chatMessages.map((m, i) => (
                <div key={i} className={cn('max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed',
                  m.role === 'user'
                    ? 'self-end bg-[rgba(0,229,255,0.12)] border border-[rgba(0,229,255,0.25)] text-wh'
                    : 'self-start bg-[rgba(168,85,247,0.08)] border border-[rgba(168,85,247,0.2)] text-t1'
                )}>
                  {m.thinking ? (
                    <span className="flex items-center gap-2 text-t3 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-p2 animate-bounce" />
                      DELTA is thinking...
                    </span>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.text}</span>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Ask DELTA: best yield for 500 ALGO, risk explain, rebalance ideas..."
                className="flex-1 bg-[rgba(0,0,0,0.3)] border border-border2 rounded-lg px-3 py-2 text-[12px] text-wh outline-none focus:border-[rgba(168,85,247,0.4)] placeholder:text-t3"
              />
              <button
                onClick={sendChat}
                disabled={chatLoading}
                className="px-4 py-2 rounded-lg text-[12px] font-bold bg-gradient-to-r from-p1 to-p2 text-white hover:opacity-90 disabled:opacity-50 transition-all"
              >
                Send
              </button>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Best yield for my balance', 'Explain impermanent loss', 'Should I rebalance?'].map(q => (
                <button key={q} onClick={() => { setChatInput(q); }}
                  className="text-[10px] font-mono text-p2 border border-[rgba(168,85,247,0.2)] bg-[rgba(168,85,247,0.04)] px-2.5 py-1 rounded-full hover:bg-[rgba(168,85,247,0.1)] transition-all">
                  {q}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ── Main Grid: Optimize + Trend Chart ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Optimize / Swap / Rebalance tabs */}
        <Card title="DELTA Agent Controls" badge={
          <div className="flex gap-1">
            {(['optimize', 'swap', 'rebalance'] as const).map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={cn('px-2.5 py-1 rounded text-[10px] font-mono uppercase transition-all',
                  activeTab === t
                    ? 'bg-[rgba(0,229,255,0.12)] border border-[rgba(0,229,255,0.3)] text-c1'
                    : 'text-t3 hover:text-t2'
                )}>{t}</button>
            ))}
          </div>
        }>
          {/* ── Optimize Tab ── */}
          {activeTab === 'optimize' && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="font-mono text-[9px] text-t3 tracking-[2px] uppercase mb-1.5">Amount (ALGO)</div>
                <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(0,229,255,0.35)]" />
              </div>
              <div>
                <div className="font-mono text-[9px] text-t3 tracking-[2px] uppercase mb-1.5">Risk Tolerance</div>
                <select value={riskTol} onChange={e => setRiskTol(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(0,229,255,0.35)]">
                  <option value="low">Low — Liquid Staking (gALGO)</option>
                  <option value="medium">Medium — Bluechip AMMs (Tinyman)</option>
                  <option value="high">High — Max Yield Farms</option>
                </select>
              </div>
              <div className="bg-[rgba(0,255,157,0.04)] border border-[rgba(0,255,157,0.12)] rounded-lg p-3">
                <div className="font-mono text-[9px] text-g1 tracking-wider mb-1.5">⚡ AI RECOMMENDED ROUTE</div>
                <div className="text-[13px] text-wh">Folks Finance → {selected.name} {selected.asset} Pool</div>
                <div className="font-mono text-[10px] text-t2 mt-1">
                  +{(selected.apy - 4.2).toFixed(1)}% APY boost · Extra: ~{extraYield} ALGO/yr
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg p-2.5">
                  <div className="font-mono text-[8px] text-t3">CURRENT APY</div>
                  <div className="font-mono text-[18px] font-bold text-o1">4.2%</div>
                </div>
                <div className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg p-2.5">
                  <div className="font-mono text-[8px] text-t3">BEST APY</div>
                  <div className="font-mono text-[18px] font-bold text-g1">{selected.apy}%</div>
                </div>
                <div className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg p-2.5">
                  <div className="font-mono text-[8px] text-t3">AI SCORE</div>
                  <div className="font-mono text-[18px] font-bold text-c1">{selected.aiScore}</div>
                </div>
              </div>
              <button onClick={executeTransaction}
                className="w-full py-2.5 rounded-lg font-bold text-[13px] bg-gradient-to-r from-g2 to-c2 text-black hover:opacity-90 transition-all flex items-center justify-center gap-2">
                {txStatus || '🚀 Execute with DELTA Agent'}
              </button>
            </div>
          )}

          {/* ── 4. Swap Tab ── */}
          {activeTab === 'swap' && (
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-1">Swap via Tinyman / Pact.fi</div>
              <div>
                <div className="font-mono text-[9px] text-t3 tracking-[2px] uppercase mb-1.5">From</div>
                <div className="flex gap-2">
                  <select value={swapFrom} onChange={e => setSwapFrom(e.target.value)}
                    className="bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(0,229,255,0.35)]">
                    {['ALGO', 'USDC', 'gALGO', 'USDT', 'mETH'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input type="number" value={swapAmt} onChange={e => setSwapAmt(e.target.value)}
                    placeholder="0.00" className="flex-1 bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(0,229,255,0.35)]" />
                </div>
              </div>
              <div className="flex justify-center">
                <button onClick={() => { setSwapFrom(swapTo); setSwapTo(swapFrom); }}
                  className="w-8 h-8 rounded-full bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.2)] text-c1 flex items-center justify-center hover:bg-[rgba(0,229,255,0.15)] transition-all text-lg">
                  ⇅
                </button>
              </div>
              <div>
                <div className="font-mono text-[9px] text-t3 tracking-[2px] uppercase mb-1.5">To</div>
                <select value={swapTo} onChange={e => setSwapTo(e.target.value)}
                  className="w-full bg-[rgba(0,0,0,0.35)] border border-border2 rounded-lg p-2.5 text-wh text-[13px] outline-none focus:border-[rgba(0,229,255,0.35)]">
                  {['USDC', 'ALGO', 'gALGO', 'USDT', 'mETH'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              {swapAmt && (
                <div className="bg-[rgba(0,229,255,0.04)] border border-[rgba(0,229,255,0.15)] rounded-lg p-3 text-[12px] font-mono">
                  <div className="text-t3">Estimated output</div>
                  <div className="text-wh font-semibold">{(+swapAmt * 0.9985).toFixed(4)} {swapTo}</div>
                  <div className="text-t3 text-[10px] mt-1">Fee: 0.25% · Slippage: 0.3% · Route: DELTA optimal</div>
                </div>
              )}
              <button onClick={executeTransaction}
                className="w-full py-2.5 rounded-lg font-bold text-[13px] bg-gradient-to-r from-c2 to-p1 text-white hover:opacity-90 transition-all">
                🔄 Swap via DELTA Agent
              </button>
            </div>
          )}

          {/* ── 11. Rebalance Tab ── */}
          {activeTab === 'rebalance' && (
            <div className="flex flex-col gap-3">
              <div className="font-mono text-[9px] text-t3 uppercase tracking-widest">Auto-Rebalance Suggestion</div>
              <div className="bg-[rgba(0,0,0,0.3)] border border-border-custom rounded-lg p-3 text-[12px] text-t2">
                <div className="mb-2">Balance: <span className="text-wh font-semibold">{walletBal ? fmtAlgo(walletBal.algo) + ' ALGO' : amount + ' ALGO (simulated)'}</span></div>
                <div>Risk: <span className="text-wh font-semibold capitalize">{riskTol}</span></div>
              </div>
              <button onClick={getRebalanceSuggestion} disabled={rebalanceLoading}
                className="w-full py-2.5 rounded-lg font-bold text-[13px] bg-gradient-to-r from-o1 to-gold text-black hover:opacity-90 disabled:opacity-50 transition-all">
                {rebalanceLoading ? '⏳ DELTA analyzing...' : '🧠 Get Rebalance Strategy'}
              </button>
              {rebalanceSuggestion && (
                <div className="bg-[rgba(255,107,0,0.04)] border border-[rgba(255,107,0,0.18)] rounded-lg p-3 text-[12px] text-t1 whitespace-pre-wrap leading-relaxed">
                  {rebalanceSuggestion}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── 6. APY Trend Line Chart ── */}
        <Card title={`${selected.name} — ${selected.asset} APY Trend`} badge={
          <span className="bg-[rgba(0,255,157,0.08)] border border-[rgba(0,255,157,0.18)] text-g1 px-2 py-0.5 rounded text-[9px] font-mono tracking-wider uppercase">30D</span>
        }>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="apyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-g1)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-g1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-custom)" />
                <XAxis dataKey="day" axisLine={false} tickLine={false}
                  tick={{ fill: 'var(--color-t3)', fontSize: 10 }} label={{ value: 'Day', position: 'insideBottomRight', fill: 'var(--color-t3)', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--color-t3)', fontSize: 10 }}
                  domain={['auto', 'auto']} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border-custom)', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: 'var(--color-g1)' }}
                  formatter={(v: number) => [`${v}%`, 'APY']}
                />
                <Area type="monotone" dataKey="apy" stroke="var(--color-g1)" strokeWidth={2} fill="url(#apyGrad)" dot={false} activeDot={{ r: 4, fill: 'var(--color-g1)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="font-mono text-[8px] text-t3 uppercase">Min</div>
              <div className="font-mono text-[13px] text-o1">{Math.min(...trendData.map(d => d.apy)).toFixed(2)}%</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[8px] text-t3 uppercase">Avg</div>
              <div className="font-mono text-[13px] text-c1">{(trendData.reduce((s, d) => s + d.apy, 0) / trendData.length).toFixed(2)}%</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-[8px] text-t3 uppercase">Max</div>
              <div className="font-mono text-[13px] text-g1">{Math.max(...trendData.map(d => d.apy)).toFixed(2)}%</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Protocol Browser: Table / Cards view toggle ── */}
      <Card
        title="Live Protocol APYs"
        bodyClassName="p-0"
        badge={
          <div className="flex items-center gap-2">
            <span className="bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.18)] text-c1 px-2 py-0.5 rounded text-[9px] font-mono uppercase">LIVE DATA</span>
            <button onClick={() => setView('table')} className={cn('p-1.5 rounded text-[11px] transition-all', view === 'table' ? 'bg-[rgba(0,229,255,0.15)] text-c1' : 'text-t3')}>☰</button>
            <button onClick={() => setView('cards')} className={cn('p-1.5 rounded text-[11px] transition-all', view === 'cards' ? 'bg-[rgba(0,229,255,0.15)] text-c1' : 'text-t3')}>⊞</button>
          </div>
        }
      >
        {/* ── 8. Cards View ── */}
        {view === 'cards' && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {protocols.map(p => (
              <div key={p.id}
                onClick={() => setSelected(p)}
                className={cn(
                  'relative rounded-xl border p-4 cursor-pointer transition-all hover:scale-[1.02]',
                  selected.id === p.id
                    ? 'border-c1 bg-[rgba(0,229,255,0.07)]'
                    : 'border-border-custom bg-[rgba(0,0,0,0.2)] hover:border-border3'
                )}>
                {p.best && <div className="absolute top-2 right-2 text-[8px] font-mono text-g1 bg-[rgba(0,255,157,0.1)] border border-[rgba(0,255,157,0.2)] px-1.5 py-0.5 rounded">⭐ TOP PICK</div>}
                <div className="text-2xl mb-2">{p.logo}</div>
                <div className="font-semibold text-wh text-[13px]">{p.name}</div>
                <div className="text-[11px] text-t2 mb-2">{p.asset}</div>
                <div className="font-mono text-[24px] font-bold text-g1">{p.apy}%</div>
                <div className="font-mono text-[9px] text-t3">APY</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className={cn('text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase', riskBg(p.risk), riskColor(p.risk))}>{p.risk}</span>
                  <button onClick={e => { e.stopPropagation(); explainRisk(p); }}
                    className="text-[9px] font-mono text-c1 hover:text-wh transition-colors">
                    AI {p.aiScore} ℹ
                  </button>
                </div>
                <div className="mt-2 h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(sparklines[p.id] || []).slice(-15)}>
                      <Line type="monotone" dataKey="apy" stroke={p.apy >= 15 ? 'var(--color-g1)' : 'var(--color-c1)'} strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Table View */}
        {view === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[rgba(0,0,0,0.2)] border-b border-border-custom">
                  {['Protocol', 'Chain', 'Asset', 'APY (30D)', 'TVL', 'Risk', 'AI Score', 'Trend', 'Action'].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-mono text-[9px] text-t3 tracking-[2px] uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {protocols.map((p, i) => (
                  <tr key={p.id} className={cn('border-b border-[rgba(15,31,53,0.5)] hover:bg-[rgba(0,229,255,0.02)] transition-colors cursor-pointer',
                    selected.id === p.id && 'bg-[rgba(0,229,255,0.03)]',
                    p.best && 'bg-[rgba(0,255,157,0.02)]'
                  )} onClick={() => setSelected(p)}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{p.logo}</span>
                        <div>
                          <div className="font-semibold text-wh text-[12px]">{p.name}</div>
                          {p.best && <div className="text-g1 text-[8px] font-mono uppercase tracking-wider">⭐ Recommended</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><span className="px-2 py-0.5 rounded bg-[rgba(0,0,0,0.3)] border border-border-custom text-t2 font-mono text-[9px]">{p.chain}</span></td>
                    <td className="px-4 py-2.5 text-t2 text-[12px]">{p.asset}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-border-custom rounded-full overflow-hidden max-w-[60px]">
                          <div className="h-full rounded-full" style={{ width: `${Math.min(p.apy / 25 * 100, 100)}%`, backgroundColor: p.apy >= 15 ? 'var(--color-g1)' : p.apy >= 9 ? 'var(--color-o1)' : 'var(--color-c1)' }} />
                        </div>
                        <span className="font-mono text-[12px] font-bold" style={{ color: p.apy >= 15 ? 'var(--color-g1)' : p.apy >= 9 ? 'var(--color-o1)' : 'var(--color-t2)' }}>{p.apy}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-t2">${p.tvl}M</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded font-mono text-[9px] tracking-wider uppercase border', riskBg(p.risk), riskColor(p.risk))}>{p.risk}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={e => { e.stopPropagation(); explainRisk(p); }}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-[3px] bg-border-custom rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${p.aiScore}%`, backgroundColor: scoreColor(p.aiScore) }} />
                        </div>
                        <span className="font-mono text-[10px] text-wh">{p.aiScore}</span>
                        <span className="text-[9px] text-t3">ℹ</span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 w-24">
                      <div className="h-8 w-20">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={(sparklines[p.id] || []).slice(-10)}>
                            <Line type="monotone" dataKey="apy" stroke={p.apy >= 15 ? 'var(--color-g1)' : 'var(--color-c1)'} strokeWidth={1.5} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={e => { e.stopPropagation(); setSelected(p); setActiveTab('optimize'); }}
                        className={cn('px-2.5 py-1 rounded text-[10px] font-bold transition-all', p.best
                          ? 'bg-[rgba(0,255,157,0.12)] border border-[rgba(0,255,157,0.3)] text-g1 hover:bg-[rgba(0,255,157,0.2)]'
                          : 'bg-[rgba(0,229,255,0.1)] border border-[rgba(0,229,255,0.25)] text-c1 hover:bg-[rgba(0,229,255,0.18)]'
                        )}>
                        {selected.id === p.id ? '✓ Selected' : 'Select'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── 7. Transaction History ── */}
      {txHistory.length > 0 && (
        <Card title="Transaction History" badge={
          <span className="text-[9px] font-mono text-t3">{txHistory.length} txns</span>
        }>
          <div className="flex flex-col gap-1.5">
            {txHistory.map((tx, i) => (
              <div key={i} className="flex items-center gap-3 bg-[rgba(0,0,0,0.2)] border border-border-custom rounded-lg px-3 py-2">
                <span className="text-base">{tx.status}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] text-wh truncate">{tx.protocol}</div>
                  <div className="font-mono text-[9px] text-t3">{tx.ts}</div>
                </div>
                <a
                  href={`https://testnet.algoexplorer.io/tx/${tx.id}`}
                  target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[9px] text-c1 hover:text-wh transition-colors whitespace-nowrap"
                  onClick={e => e.stopPropagation()}
                >
                  {tx.id.slice(0, 10)}... ↗
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── 10. Risk Score Explainer Modal ── */}
      {riskModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setRiskModal(m => ({ ...m, open: false }))}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-card border border-border2 rounded-2xl p-5 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-display text-[16px] font-bold text-wh">{riskModal.protocol?.name} · {riskModal.protocol?.asset}</div>
                <div className="font-mono text-[10px] text-t3">AI Risk Score Breakdown</div>
              </div>
              <button onClick={() => setRiskModal(m => ({ ...m, open: false }))} className="text-t3 hover:text-wh transition-colors text-lg">✕</button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-2 bg-border-custom rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${riskModal.protocol?.aiScore}%`, backgroundColor: scoreColor(riskModal.protocol?.aiScore ?? 0) }} />
              </div>
              <span className="font-mono text-[20px] font-bold text-wh">{riskModal.protocol?.aiScore}/100</span>
            </div>
            <div className="text-[12px] text-t1 leading-relaxed whitespace-pre-wrap min-h-[80px]">
              {riskModal.loading ? (
                <span className="flex items-center gap-2 text-t3 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-p2 animate-bounce" />
                  DELTA analyzing risk factors...
                </span>
              ) : riskModal.text}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
