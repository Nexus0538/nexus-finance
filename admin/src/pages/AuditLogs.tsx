import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Risk = 'low'|'medium'|'high'|'critical';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    // Pull agent_logs as security/audit events
    const { data } = await supabase.from('agent_logs')
      .select('*').order('created_at',{ascending:false}).limit(300);
    setLogs(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const riskOf = (log: any): Risk => {
    if (log.status === 'failed') return 'high';
    if ((log.action_type??'').toLowerCase().includes('emergency')) return 'critical';
    if ((log.action_type??'').toLowerCase().includes('transfer')) return 'medium';
    return 'low';
  };

  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || (l.agent_name??'').toLowerCase().includes(q) || (l.action_type??'').toLowerCase().includes(q) || (l.status??'').toLowerCase().includes(q);
    const matchR = riskFilter === 'all' || riskOf(l) === riskFilter;
    return matchQ && matchR;
  });

  const fmtTime = (d: string) => new Date(d).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:false});

  const riskBadge = (r: Risk) => {
    const map: Record<Risk,string> = {low:'green',medium:'gold',high:'orange',critical:'red'};
    return <span className={'badge '+map[r]}>{r.toUpperCase()}</span>;
  };

  const counts: Record<Risk,number> = {low:0,medium:0,high:0,critical:0};
  filtered.forEach(l => { counts[riskOf(l)]++; });

  return (
    <div className="fade-in">
      <div className="stats-grid">
        <div className="stat-card green"><div className="stat-icon">✅</div><div className="stat-label">Low Risk</div><div className="stat-value">{counts.low}</div><div className="stat-sub">events</div></div>
        <div className="stat-card gold"><div className="stat-icon">⚠️</div><div className="stat-label">Medium</div><div className="stat-value">{counts.medium}</div><div className="stat-sub">events</div></div>
        <div className="stat-card red"><div className="stat-icon">🔴</div><div className="stat-label">High</div><div className="stat-value">{counts.high}</div><div className="stat-sub">events</div></div>
        <div className="stat-card red" style={{borderColor:'rgba(255,34,85,.4)'}}><div className="stat-icon">⛔</div><div className="stat-label">Critical</div><div className="stat-value">{counts.critical}</div><div className="stat-sub">events</div></div>
      </div>
      <div className="filter-bar">
        <input className="search-input" placeholder="🔍  Search agent, action, status…" value={search} onChange={e=>setSearch(e.target.value)} />
        <select className="filter-select" value={riskFilter} onChange={e=>setRiskFilter(e.target.value)}>
          <option value="all">All Risk Levels</option>
          <option value="critical">🔴 Critical</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        <button className="btn-refresh" onClick={load}>↻ Refresh</button>
      </div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        <table className="admin-table">
          <thead><tr><th>#</th><th>Agent</th><th>Action</th><th>Status</th><th>Risk</th><th>Note</th><th>Time (IST)</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{textAlign:'center',padding:32,color:'var(--muted)'}}>Loading…</td></tr>}
            {filtered.map((l,i) => (
              <tr key={l.id}>
                <td><span className="mono" style={{fontSize:10,color:'var(--t3)'}}>{i+1}</span></td>
                <td><span className="badge purple">{l.agent_name}</span></td>
                <td style={{maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:11}}>{l.action_type}</td>
                <td><span className={'badge '+(l.status==='completed'?'green':l.status==='failed'?'red':'orange')}>{l.status}</span></td>
                <td>{riskBadge(riskOf(l))}</td>
                <td><span className="mono" style={{fontSize:9,color:'var(--muted)',maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',display:'block'}}>{l.reasoning ?? l.tx_id ?? '—'}</span></td>
                <td><span className="mono" style={{fontSize:9,color:'var(--muted)'}}>{fmtTime(l.created_at)}</span></td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{textAlign:'center',padding:32,color:'var(--t3)'}}>No logs found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
