import { useState } from 'react';
import { supabase, isAllowedAdmin } from '../lib/supabase';

type Mode = 'signin' | 'signup' | 'reset';

export default function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function reset() { setError(''); setSuccess(''); }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (!isAllowedAdmin(email)) { setError('Access denied. Email not authorized.'); return; }
    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr) { setError(authErr.message); return; }
      if (!data.user || !isAllowedAdmin(data.user.email ?? '')) {
        await supabase.auth.signOut(); setError('Access denied.'); return;
      }
      onLogin();
    } catch (err: any) { setError(err.message ?? 'Authentication failed.'); }
    finally { setLoading(false); }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (!isAllowedAdmin(email)) { setError('Access denied. Email not authorized.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signUp({ email, password });
      if (authErr) { setError(authErr.message); return; }
      setSuccess('✅ Account created! Check your email to confirm, then sign in.');
      setMode('signin');
    } catch (err: any) { setError(err.message ?? 'Registration failed.'); }
    finally { setLoading(false); }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (!isAllowedAdmin(email)) { setError('Access denied. Email not authorized.'); return; }
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (authErr) { setError(authErr.message); return; }
      setSuccess('📧 Password reset email sent! Check your inbox.');
    } catch (err: any) { setError(err.message ?? 'Reset failed.'); }
    finally { setLoading(false); }
  }

  const tabStyle = (m: Mode) => ({
    flex: 1, padding: '8px', border: 'none', cursor: 'pointer', fontSize: 11,
    fontWeight: 700, letterSpacing: '1px', fontFamily: 'var(--mono)',
    borderBottom: mode === m ? '2px solid var(--c1)' : '2px solid transparent',
    background: 'none',
    color: mode === m ? 'var(--c1)' : 'var(--t3)',
    transition: 'all .2s',
  });

  return (
    <div className="login-wrap">
      <div className="login-box fade-in">
        <div className="login-logo">
          <span className="login-logo-icon">🛡️</span>
          <div className="login-title">NEXUS ADMIN</div>
          <div className="login-sub">⚡ RESTRICTED ACCESS</div>
        </div>

        <div className="login-warning">
          <span>⚠</span>
          <span>Authorized personnel only. Access limited to pre-approved emails only.</span>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border2)', marginBottom: 20 }}>
          <button style={tabStyle('signin')} onClick={() => { setMode('signin'); reset(); }}>SIGN IN</button>
          <button style={tabStyle('signup')} onClick={() => { setMode('signup'); reset(); }}>CREATE ACCOUNT</button>
          <button style={tabStyle('reset')}  onClick={() => { setMode('reset');  reset(); }}>RESET PW</button>
        </div>

        {success && (
          <div style={{ background: 'rgba(0,255,157,.08)', border: '1px solid rgba(0,255,157,.2)',
            borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--g1)',
            marginBottom: 16, fontFamily: 'var(--mono)' }}>
            {success}
          </div>
        )}

        {/* SIGN IN */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn}>
            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <input id="admin-email" type="email" className="form-input" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input id="admin-password" type="password" className="form-input" placeholder="••••••••••••"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div className="login-error">⛔ {error}</div>}
            <button id="admin-login-btn" type="submit" className="btn-login" disabled={loading || !email || !password}>
              {loading ? 'AUTHENTICATING...' : '⚡ ACCESS COMMAND CENTER'}
            </button>
          </form>
        )}

        {/* SIGN UP */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, fontFamily: 'var(--mono)' }}>
              Only pre-approved emails can create an account.
            </div>
            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <input type="email" className="form-input" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Set Password (min 8 chars)</label>
              <input type="password" className="form-input" placeholder="Choose a strong password"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            {error && <div className="login-error">⛔ {error}</div>}
            <button type="submit" className="btn-login" disabled={loading || !email || !password}>
              {loading ? 'CREATING ACCOUNT...' : '🔐 CREATE ADMIN ACCOUNT'}
            </button>
          </form>
        )}

        {/* RESET PASSWORD */}
        {mode === 'reset' && (
          <form onSubmit={handleReset}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, fontFamily: 'var(--mono)' }}>
              Enter your email to receive a password reset link.
            </div>
            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <input type="email" className="form-input" placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {error && <div className="login-error">⛔ {error}</div>}
            <button type="submit" className="btn-login" disabled={loading || !email}>
              {loading ? 'SENDING...' : '📧 SEND RESET LINK'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
          NEXUS FINANCE v2.0 · ADMIN PORTAL · PORT 5174
        </div>
      </div>
    </div>
  );
}

