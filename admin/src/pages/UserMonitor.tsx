import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function UserMonitor() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [userTx, setUserTx] = useState<any[]>([]);
  const [userLogs, setUserLogs] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('user_profiles').select('*').order('created_at',{ascending:false});
    setUsers(data ?? []);
    setLoading(false);
  }

  async function selectUser(u: any) {
    setSelected(u);
    const [txRes, logRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', u.id).order('created_at',{ascending:false}).limit(10),
      supabase.from('agent_logs').select('*').eq('user_id', u.id).order('created_at',{ascending:false}).limit(10),
    ]);
    setUserTx(txRes.data ?? []);
    setUserLogs(logRes.data ?? []);
  }

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (u.id ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const fmtTime = (d: string) => new Date(d).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:false});
  const initials = (name: string) => (name ?? '?').slice(0,2).toUpperCase();

  const kycBadge = (s: string) => {
    const map: Record<string,string> = {verified:'green',pending:'orange',rejected:'red',none:'gray'};
    return <span className={'badge '+(map[s]??'gray')}>{s}</span>;
  };

  return (
    <div className="fade-in">
      {!selected ? (
        <>
          <div className="filter-bar">
            <input className="search-input" placeholder="🔍  Search by name or user ID…"
              value={search} onChange={e => setSearch(e.target.value)} />
            <button className="btn-refresh" onClick={load}>↻ Refresh</button>
          </div>
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <table className="admin-table">
              <thead><tr>
                <th>User</th><th>Wallet</th><th>KYC</th><th>Role</th><th>Risk</th><th>Invested</th><th>Joined</th><th></th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'var(--muted)'}}>Loading users…</td></tr>}
                {filtered.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="user-info">
                        <div className="user-avatar">{initials(u.full_name ?? u.id)}</div>
                        <div>
                          <div className="user-name">{u.full_name ?? '(unnamed)'}</div>
                          <div className="user-email mono" style={{fontSize:10}}>{u.id.slice(0,12)}…</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="mono" style={{fontSize:10,color:'var(--c1)'}}>{u.algo_address ? u.algo_address.slice(0,10)+'…' : '—'}</span></td>
                    <td>{kycBadge(u.kyc_status)}</td>
                    <td><span className={'badge '+(u.role==='admin'?'gold':u.role==='agent'?'purple':'gray')}>{u.role}</span></td>
                    <td><span style={{color:u.risk_profile==='aggressive'?'var(--r1)':u.risk_profile==='moderate'?'var(--gold)':'var(--g1)',fontSize:11}}>{u.risk_profile}</span></td>
                    <td><strong>{u.total_invested ?? 0}</strong> <span style={{fontSize:10,color:'var(--muted)'}}>USD</span></td>
                    <td><span className="mono" style={{fontSize:10,color:'var(--muted)'}}>{fmtTime(u.created_at)}</span></td>
                    <td><button className="btn-refresh" onClick={() => selectUser(u)}>View →</button></td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && <tr><td colSpan={8} style={{textAlign:'center',padding:32,color:'var(--t3)'}}>No users found</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="fade-in">
          <button className="btn-refresh" style={{marginBottom:16}} onClick={() => setSelected(null)}>← Back to all users</button>
          <div className="grid-2" style={{marginBottom:20}}>
            <div className="card">
              <div className="card-header"><span className="card-title">👤 User Profile</span>{kycBadge(selected.kyc_status)}</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {[
                  ['Full Name', selected.full_name ?? '(unnamed)'],
                  ['User ID', selected.id],
                  ['Role', selected.role],
                  ['Risk Profile', selected.risk_profile],
                  ['Total Invested', (selected.total_invested ?? 0) + ' USD'],
                  ['Algo Address', selected.algo_address ?? '—'],
                  ['Joined', fmtTime(selected.created_at)],
                ].map(([k,v]) => (
                  <div key={k as string} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                    <span style={{fontSize:11,color:'var(--muted)',textTransform:'uppercase',letterSpacing:1}}>{k}</span>
                    <span className="mono" style={{fontSize:11,color:'var(--t1)',maxWidth:'60%',textAlign:'right',wordBreak:'break-all'}}>{v as string}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">🤖 Agent Logs</span></div>
              <table className="admin-table">
                <thead><tr><th>Agent</th><th>Action</th><th>Status</th><th>Time</th></tr></thead>
                <tbody>
                  {userLogs.map((l,i) => (
                    <tr key={i}>
                      <td><span className="badge purple">{l.agent_name}</span></td>
                      <td style={{fontSize:11}}>{l.action_type}</td>
                      <td><span className={'badge '+(l.status==='completed'?'green':l.status==='failed'?'red':'orange')}>{l.status}</span></td>
                      <td><span className="mono" style={{fontSize:9,color:'var(--muted)'}}>{fmtTime(l.created_at)}</span></td>
                    </tr>
                  ))}
                  {userLogs.length === 0 && <tr><td colSpan={4} style={{textAlign:'center',color:'var(--t3)',padding:16}}>No logs</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">💸 Transaction History</span></div>
            <table className="admin-table">
              <thead><tr><th>TX ID</th><th>Type</th><th>Amount</th><th>Asset</th><th>Status</th><th>Network</th><th>Time</th></tr></thead>
              <tbody>
                {userTx.map((tx,i) => (
                  <tr key={i}>
                    <td><span className="mono" style={{fontSize:10,color:'var(--c1)'}}>{tx.tx_id?.slice(0,12)}…</span></td>
                    <td style={{fontSize:11}}>{tx.tx_type}</td>
                    <td><strong>{tx.amount}</strong></td>
                    <td><span className="badge cyan">{tx.asset_symbol}</span></td>
                    <td><span className={'badge '+(tx.status==='completed'||tx.status==='success'?'green':tx.status==='failed'?'red':'orange')}>{tx.status}</span></td>
                    <td><span style={{fontSize:11,color:'var(--muted)'}}>{tx.network}</span></td>
                    <td><span className="mono" style={{fontSize:9,color:'var(--muted)'}}>{fmtTime(tx.created_at)}</span></td>
                  </tr>
                ))}
                {userTx.length === 0 && <tr><td colSpan={7} style={{textAlign:'center',color:'var(--t3)',padding:16}}>No transactions</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
