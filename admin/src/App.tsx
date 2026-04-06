import { useEffect, useState } from 'react';
import { supabase, isAllowedAdmin } from './lib/supabase';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import UserMonitor from './pages/UserMonitor';
import TxMonitor from './pages/TxMonitor';
import AuditLogs from './pages/AuditLogs';

type Page = 'dashboard' | 'users' | 'transactions' | 'audit';

const NAV = [
  { id: 'dashboard' as Page, icon: '📊', label: 'Dashboard' },
  { id: 'users'     as Page, icon: '👥', label: 'User Monitor' },
  { id: 'transactions' as Page, icon: '💸', label: 'Transactions' },
  { id: 'audit'     as Page, icon: '🛡️', label: 'Audit Logs' },
];

const TITLES: Record<Page, { title: string; sub: string }> = {
  dashboard:    { title: 'COMMAND CENTER', sub: 'Real-time overview of all platform activity' },
  users:        { title: 'USER MONITOR', sub: 'View and inspect all registered users and their activity' },
  transactions: { title: 'TRANSACTION FEED', sub: 'Live monitoring of all on-chain and off-chain transactions' },
  audit:        { title: 'AUDIT LOGS', sub: 'Agent events, risk classification and security events' },
};

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [adminEmail, setAdminEmail] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email ?? '';
      if (email && isAllowedAdmin(email)) { setAuthed(true); setAdminEmail(email); }
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const email = session?.user?.email ?? '';
      if (email && isAllowedAdmin(email)) { setAuthed(true); setAdminEmail(email); }
      else { setAuthed(false); setAdminEmail(''); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setAuthed(false); setAdminEmail('');
  }

  if (checking) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--c1)',fontFamily:'var(--mono)',fontSize:13}}>
      ⚡ Verifying session…
    </div>
  );

  if (!authed) return <AdminLogin onLogin={() => { supabase.auth.getUser().then(({data})=>setAdminEmail(data.user?.email??'')); setAuthed(true); }} />;

  const { title, sub } = TITLES[page];

  const PageComponent = { dashboard: AdminDashboard, users: UserMonitor, transactions: TxMonitor, audit: AuditLogs }[page];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🛡️</div>
          <div>
            <div className="sidebar-logo-text">NEXUS</div>
            <div className="sidebar-logo-sub">ADMIN</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(n => (
            <button key={n.id} className={`nav-link${page===n.id?' active':''}`} onClick={() => setPage(n.id)}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="admin-email">{adminEmail}</div>
          <button className="btn-logout" onClick={logout}>
            <span>⏻</span> Sign Out
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <div className="admin-topbar">
          <div>
            <div className="topbar-title">{title}</div>
            <div className="topbar-sub">{sub}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div className="live-badge"><div className="live-dot" />LIVE MONITORING</div>
            <div style={{fontSize:11,color:'var(--t3)',fontFamily:'var(--mono)'}}>
              {new Date().toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour12:false})} IST
            </div>
          </div>
        </div>

        <div className="admin-content">
          <PageComponent />
        </div>
      </main>
    </div>
  );
}
