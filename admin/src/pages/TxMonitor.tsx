import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function TxMonitor() {
  const [txs, setTxs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('transactions').select('*').order('created_at',{ascending:false}).limit(200);
    setTxs(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); const ch = supabase.channel('admin_tx').on('postgres_changes',
    {event:'INSERT',schema:'public',table:'transactions'}, p => setTxs(prev => [p.new as any, ...prev.slice(0,199)])).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = txs.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !q || (t.tx_id??'').toLowerCase().includes(q) || (t.tx_type??'').toLowerCase().includes(q) || (t.asset_symbol??'').toLowerCase().includes(q);
    const matchS = statusFilter === 'all' || t.status === statusFilter;
    return matchQ && matchS;
  });

  const fmtTime = (d: string) => new Date(d).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:false});
  const total = filtered.reduce((s,t) => s + (t.amount||0), 0);

  return (
    <div className="fade-in">
      <div className="stats-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="stat-card cyan"><div className="stat-icon">💸</div><div className="stat-label">Showing</div><div className="stat-value">{filtered.length}</div><div className="stat-sub">transactions</div></div>
        <div className="stat-card green"><div className="stat-icon">📈</div><div className="stat-label">Total Volume</div><div className="stat-value">{total.toFixed(2)}</div><div className="stat-sub">ALGO</div></div>
        <div className="stat-card red"><div className="stat-icon">⚡</div><div className="stat-label">Failed</div><div className="stat-value">{filtered.filter(t=>t.status==='failed').length}</div><div className="stat-sub">of {filtered.length}</div></div>
      </div>
      <div className="filter-bar">
        <input className="search-input" placeholder="🔍  Search TX ID, type, asset…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="filter-select" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <button className="btn-refresh" onClick={load}>↻ Refresh</button>
        <div className="live-badge"><div className="live-dot" />LIVE</div>
      </div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <div style={{overflowX:'auto'}}>
          <table className="admin-table">
            <thead><tr><th>TX ID</th><th>Type</th><th>Amount</th><th>Asset</th><th>From</th><th>To</th><th>Status</th><th>Network</th><th>Fee</th><th>Time</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={10} style={{textAlign:'center',padding:32,color:'var(--muted)'}}>Loading…</td></tr>}
              {filtered.map((tx,i) => (
                <tr key={i}>
                  <td><span className="mono" style={{fontSize:10,color:'var(--c1)'}}>{(tx.tx_id??'').slice(0,14)}…</span></td>
                  <td><span style={{fontSize:11,color:'var(--t1)'}}>{tx.tx_type}</span></td>
                  <td><strong style={{color:'var(--wh)'}}>{tx.amount}</strong></td>
                  <td><span className="badge cyan">{tx.asset_symbol}</span></td>
                  <td><span className="mono" style={{fontSize:9,color:'var(--muted)'}}>{(tx.from_address??'—').slice(0,8)}…</span></td>
                  <td><span className="mono" style={{fontSize:9,color:'var(--muted)'}}>{(tx.to_address??'—').slice(0,8)}…</span></td>
                  <td><span className={'badge '+(tx.status==='completed'||tx.status==='success'?'green':tx.status==='failed'?'red':tx.status==='pending'?'orange':'cyan')}>{tx.status}</span></td>
                  <td><span style={{fontSize:10,color:'var(--t2)'}}>{tx.network}</span></td>
                  <td><span className="mono" style={{fontSize:10}}>{tx.fee}</span></td>
                  <td><span className="mono" style={{fontSize:9,color:'var(--muted)'}}>{fmtTime(tx.created_at)}</span></td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={10} style={{textAlign:'center',padding:32,color:'var(--t3)'}}>No transactions found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
