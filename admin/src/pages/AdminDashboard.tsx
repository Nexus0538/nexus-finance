import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users:0, txCount:0, txVolume:0, agentLogs:0, failedTx:0, kycPending:0 });
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [kycStats, setKycStats] = useState({ none:0, pending:0, verified:0, rejected:0 });
  const [agentStats, setAgentStats] = useState<Record<string,number>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    const [usersRes, txRes, logsRes, profilesRes] = await Promise.all([
      supabase.from('user_profiles').select('id,kyc_status', { count: 'exact' }),
      supabase.from('transactions').select('id,amount,status,created_at,asset_symbol,tx_type,user_id').order('created_at',{ascending:false}).limit(50),
      supabase.from('agent_logs').select('id,agent_name,action_type,status,created_at,reasoning').order('created_at',{ascending:false}).limit(20),
      supabase.from('user_profiles').select('kyc_status'),
    ]);

    const txList = txRes.data ?? [];
    const logList = logsRes.data ?? [];
    const profiles = profilesRes.data ?? [];

    // KYC breakdown
    const kyc = { none:0, pending:0, verified:0, rejected:0 };
    profiles.forEach((p:any) => { if (p.kyc_status in kyc) kyc[p.kyc_status as keyof typeof kyc]++; });
    setKycStats(kyc);

    // Agent breakdown
    const agents: Record<string,number> = {};
    logList.forEach((l:any) => { agents[l.agent_name] = (agents[l.agent_name] || 0) + 1; });
    setAgentStats(agents);

    // Activity feed (merge tx + logs)
    const feed = [
      ...txList.slice(0,8).map((t:any) => ({ type:'tx', text: `${t.tx_type} · ${t.amount} ${t.asset_symbol}`, status: t.status, time: t.created_at })),
      ...logList.slice(0,8).map((l:any) => ({ type:'agent', text: `${l.agent_name}: ${l.action_type}`, status: l.status, time: l.created_at })),
    ].sort((a,b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0,12);
    setActivityFeed(feed);

    setStats({
      users: usersRes.count ?? 0,
      txCount: txList.length,
      txVolume: txList.reduce((s:number,t:any) => s + (t.amount||0), 0),
      agentLogs: logList.length,
      failedTx: txList.filter((t:any) => t.status === 'failed').length,
      kycPending: kyc.pending,
    });
    setRecentTx(txList.slice(0,6));
    setRecentLogs(logList.slice(0,6));
    setLastUpdated(new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour12:false}));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // Live subscription
    const ch = supabase.channel('admin_live')
      .on('postgres_changes', {event:'INSERT',schema:'public',table:'transactions'}, (p) => {
        const t = p.new as any;
        setActivityFeed(prev => [{ type:'tx', text:`${t.tx_type} · ${t.amount} ${t.asset_symbol}`, status:t.status, time:t.created_at }, ...prev].slice(0,12));
        setRecentTx(prev => [t, ...prev].slice(0,6));
      })
      .on('postgres_changes', {event:'INSERT',schema:'public',table:'agent_logs'}, (p) => {
        const l = p.new as any;
        setActivityFeed(prev => [{ type:'agent', text:`${l.agent_name}: ${l.action_type}`, status:l.status, time:l.created_at }, ...prev].slice(0,12));
        setRecentLogs(prev => [l, ...prev].slice(0,6));
      })
      .subscribe();
    const interval = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(interval); };
  }, []);

  const fmt = (d:string) => new Date(d).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour12:false});
  const fmtFull = (d:string) => new Date(d).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:false});
  const sBadge = (s:string) => {
    const m:Record<string,string> = {completed:'green',success:'green',failed:'red',pending:'orange',processing:'cyan'};
    return <span className={'badge '+(m[s?.toLowerCase()]??'gray')}>{s}</span>;
  };

  const kycTotal = Object.values(kycStats).reduce((a,b)=>a+b,0) || 1;
  const kycBar = (val:number, color:string) => (
    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
      <div style={{flex:1,height:6,background:'var(--border2)',borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${(val/kycTotal)*100}%`,background:color,borderRadius:3,transition:'width .5s'}}/>
      </div>
      <span style={{fontSize:11,fontFamily:'var(--mono)',color:'var(--t2)',minWidth:24,textAlign:'right'}}>{val}</span>
    </div>
  );

  return (
    <div className="fade-in">
      {/* STAT CARDS */}
      <div className="stats-grid">
        <div className="stat-card cyan"><div className="stat-icon">👥</div><div className="stat-label">Total Users</div><div className="stat-value">{loading?'—':stats.users}</div><div className="stat-sub">registered accounts</div></div>
        <div className="stat-card green"><div className="stat-icon">📈</div><div className="stat-label">TX Volume</div><div className="stat-value">{loading?'—':stats.txVolume.toFixed(1)}</div><div className="stat-sub">ALGO (last 50 tx)</div></div>
        <div className="stat-card red"><div className="stat-icon">⚠️</div><div className="stat-label">Failed TX</div><div className="stat-value">{loading?'—':stats.failedTx}</div><div className="stat-sub">of {stats.txCount} recent</div></div>
        <div className="stat-card purple"><div className="stat-icon">🤖</div><div className="stat-label">Agent Actions</div><div className="stat-value">{loading?'—':stats.agentLogs}</div><div className="stat-sub">recent events</div></div>
        <div className="stat-card gold"><div className="stat-icon">🔐</div><div className="stat-label">KYC Pending</div><div className="stat-value">{loading?'—':stats.kycPending}</div><div className="stat-sub">awaiting review</div></div>
        <div className="stat-card cyan"><div className="stat-icon">⚡</div><div className="stat-label">Transactions</div><div className="stat-value">{loading?'—':stats.txCount}</div><div className="stat-sub">last 50 loaded</div></div>
      </div>

      {/* ROW 2: Live Feed + KYC + Agent Breakdown */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20,marginBottom:20}}>

        {/* LIVE ACTIVITY FEED */}
        <div className="card" style={{gridColumn:'1/2'}}>
          <div className="card-header">
            <span className="card-title">⚡ Live Activity</span>
            <div className="live-badge"><div className="live-dot"/>LIVE</div>
          </div>
          <div ref={feedRef} style={{display:'flex',flexDirection:'column',gap:6,maxHeight:260,overflowY:'auto'}}>
            {activityFeed.map((f,i) => (
              <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                <span style={{fontSize:14,flexShrink:0}}>{f.type==='tx'?'💸':'🤖'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:11,color:'var(--t1)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.text}</div>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                    {sBadge(f.status)}
                    <span style={{fontSize:9,color:'var(--muted)',fontFamily:'var(--mono)'}}>{fmt(f.time)} IST</span>
                  </div>
                </div>
              </div>
            ))}
            {!loading && activityFeed.length === 0 && <div style={{textAlign:'center',color:'var(--t3)',padding:24,fontSize:12}}>No activity yet</div>}
          </div>
        </div>

        {/* KYC BREAKDOWN */}
        <div className="card">
          <div className="card-header"><span className="card-title">🔐 KYC Status</span></div>
          <div style={{marginBottom:16}}>
            {[['Verified','var(--g1)',kycStats.verified],['Pending','var(--gold)',kycStats.pending],['Rejected','var(--r1)',kycStats.rejected],['None','var(--t3)',kycStats.none]].map(([label,color,val]) => (
              <div key={label as string}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:2}}>
                  <span style={{fontSize:10,color:color as string,fontWeight:700,letterSpacing:1}}>{label as string}</span>
                </div>
                {kycBar(val as number, color as string)}
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginTop:8}}>
            {[['✅ Verified',kycStats.verified,'var(--g1)'],['⏳ Pending',kycStats.pending,'var(--gold)'],['❌ Rejected',kycStats.rejected,'var(--r1)'],['— None',kycStats.none,'var(--t3)']].map(([label,val,color]) => (
              <div key={label as string} style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                <div style={{fontSize:18,fontWeight:700,color:color as string,fontFamily:'var(--disp)'}}>{val}</div>
                <div style={{fontSize:9,color:'var(--muted)',marginTop:2}}>{label as string}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AGENT BREAKDOWN */}
        <div className="card">
          <div className="card-header"><span className="card-title">🤖 Agent Activity</span></div>
          {Object.entries(agentStats).length === 0 && !loading && (
            <div style={{textAlign:'center',color:'var(--t3)',padding:24,fontSize:12}}>No agent data</div>
          )}
          {Object.entries(agentStats).map(([agent, count]) => {
            const colors: Record<string,string> = {ARIA:'var(--c1)',DELTA:'var(--g1)',SIGMA:'var(--p2)',KAPPA:'var(--gold)'};
            const col = colors[agent] ?? 'var(--t2)';
            const maxVal = Math.max(...Object.values(agentStats));
            return (
              <div key={agent} style={{marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:12,fontWeight:700,color:col,fontFamily:'var(--mono)'}}>{agent}</span>
                  <span style={{fontSize:11,color:'var(--t2)'}}>{count} actions</span>
                </div>
                <div style={{height:8,background:'var(--border2)',borderRadius:4,overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${(count/maxVal)*100}%`,background:col,borderRadius:4,transition:'width .5s'}}/>
                </div>
              </div>
            );
          })}
          <div style={{marginTop:16,padding:'10px 12px',background:'var(--s2)',border:'1px solid var(--border)',borderRadius:8}}>
            <div style={{fontSize:10,color:'var(--muted)',marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>Last refreshed</div>
            <div style={{fontSize:12,color:'var(--c1)',fontFamily:'var(--mono)'}}>{lastUpdated || '—'} IST</div>
          </div>
        </div>
      </div>

      {/* ROW 3: Recent TX + Recent Agent Logs */}
      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <span className="card-title">📊 Recent Transactions</span>
            <button className="btn-refresh" onClick={load}>↻ Refresh</button>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="admin-table">
              <thead><tr><th>Type</th><th>Amount</th><th>Asset</th><th>Status</th><th>Time (IST)</th></tr></thead>
              <tbody>
                {recentTx.map((tx,i) => (
                  <tr key={i}>
                    <td><span className="mono" style={{color:'var(--c1)',fontSize:11}}>{tx.tx_type}</span></td>
                    <td><strong style={{color:'var(--wh)'}}>{tx.amount}</strong></td>
                    <td><span className="badge cyan">{tx.asset_symbol}</span></td>
                    <td>{sBadge(tx.status)}</td>
                    <td><span className="mono" style={{fontSize:9,color:'var(--muted)'}}>{fmtFull(tx.created_at)}</span></td>
                  </tr>
                ))}
                {!loading && recentTx.length===0 && <tr><td colSpan={5} style={{textAlign:'center',color:'var(--t3)',padding:20}}>No transactions</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">🤖 Recent Agent Logs</span>
          </div>
          <div style={{overflowX:'auto'}}>
            <table className="admin-table">
              <thead><tr><th>Agent</th><th>Action</th><th>Status</th><th>Time (IST)</th></tr></thead>
              <tbody>
                {recentLogs.map((log,i) => (
                  <tr key={i}>
                    <td><span className="badge purple">{log.agent_name}</span></td>
                    <td style={{fontSize:11,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{log.action_type}</td>
                    <td>{sBadge(log.status)}</td>
                    <td><span className="mono" style={{fontSize:9,color:'var(--muted)'}}>{fmtFull(log.created_at)}</span></td>
                  </tr>
                ))}
                {!loading && recentLogs.length===0 && <tr><td colSpan={4} style={{textAlign:'center',color:'var(--t3)',padding:20}}>No agent logs</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PLATFORM HEALTH */}
      <div className="card">
        <div className="card-header"><span className="card-title">🛡️ Platform Health</span></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
          {[
            {label:'Supabase DB', status:'online', icon:'🟢'},
            {label:'Algorand Testnet', status:'online', icon:'🟢'},
            {label:'Agent Engine', status: stats.agentLogs > 0 ? 'active' : 'idle', icon: stats.agentLogs > 0 ? '🟢' : '🟡'},
            {label:'TX Processor', status: stats.failedTx > 3 ? 'degraded' : 'operational', icon: stats.failedTx > 3 ? '🟡' : '🟢'},
          ].map(s => (
            <div key={s.label} style={{background:'var(--s2)',border:'1px solid var(--border)',borderRadius:8,padding:'12px 14px',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:20}}>{s.icon}</span>
              <div>
                <div style={{fontSize:12,color:'var(--t1)',fontWeight:600}}>{s.label}</div>
                <div style={{fontSize:10,color:'var(--muted)',fontFamily:'var(--mono)',textTransform:'uppercase',letterSpacing:1}}>{s.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
