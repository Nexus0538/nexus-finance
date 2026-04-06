import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────── */
interface CookiePreferences {
  necessary: boolean;   // always true, non-toggleable
  analytics: boolean;
  marketing: boolean;
  functional: boolean;
}

interface CookieRecord {
  version: string;
  accepted: boolean;
  preferences: CookiePreferences;
  timestamp: string;
}

const STORAGE_KEY   = 'nexus_cookie_consent';
const COOKIE_VER    = '1.0';

const DEFAULT_PREFS: CookiePreferences = {
  necessary:  true,
  analytics:  false,
  marketing:  false,
  functional: true,
};

const COOKIE_CATEGORIES = [
  {
    id:       'necessary' as const,
    label:    'Strictly Necessary',
    icon:     '🔒',
    desc:     'Essential for the platform to function. Includes authentication tokens, session data, and security cookies. Cannot be disabled.',
    required: true,
    examples: ['Supabase session token', 'CSRF protection', 'Load balancing'],
  },
  {
    id:       'functional' as const,
    label:    'Functional',
    icon:     '⚙️',
    desc:     'Enhance usability by remembering your preferences, wallet address, and platform settings between sessions.',
    required: false,
    examples: ['Wallet address cache', 'Theme preference', 'SIM/LIVE mode', 'Agent configurations'],
  },
  {
    id:       'analytics' as const,
    label:    'Analytics',
    icon:     '📊',
    desc:     'Help us understand how users interact with NEXUS to improve performance and user experience. All data is anonymized.',
    required: false,
    examples: ['Page views', 'Feature usage', 'Error tracking', 'Performance metrics'],
  },
  {
    id:       'marketing' as const,
    label:    'Marketing',
    icon:     '📢',
    desc:     'Allow us to personalize content and show relevant updates about NEXUS Finance and AlgoBharat ecosystem news.',
    required: false,
    examples: ['Personalized content', 'Hackathon announcements', 'Partner integrations'],
  },
];

/* ─── Hook ───────────────────────────────────────────── */
export function useCookieConsent() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return null;
  try {
    return JSON.parse(saved) as CookieRecord;
  } catch {
    return null;
  }
}

/* ─── Component ──────────────────────────────────────── */
export const CookieConsent: React.FC = () => {
  const [visible, setVisible]         = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [prefs, setPrefs]             = useState<CookiePreferences>(DEFAULT_PREFS);
  const [saved, setSaved]             = useState(false);
  const [activeTab, setActiveTab]     = useState<string>('necessary');

  useEffect(() => {
    const record = useCookieConsent();
    if (!record || record.version !== COOKIE_VER) {
      // Delay slightly so page renders first
      setTimeout(() => setVisible(true), 1200);
    }
  }, []);

  const persist = (accepted: boolean, preferences: CookiePreferences) => {
    const record: CookieRecord = {
      version: COOKIE_VER,
      accepted,
      preferences,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    setSaved(true);
    setTimeout(() => {
      setVisible(false);
      setShowModal(false);
    }, 600);
  };

  const acceptAll = () => {
    const all: CookiePreferences = { necessary: true, analytics: true, marketing: true, functional: true };
    setPrefs(all);
    persist(true, all);
  };

  const rejectAll = () => {
    const min: CookiePreferences = { necessary: true, analytics: false, marketing: false, functional: false };
    setPrefs(min);
    persist(true, min);
  };

  const saveCustom = () => {
    persist(true, prefs);
  };

  const toggle = (id: keyof CookiePreferences) => {
    if (id === 'necessary') return;
    setPrefs(p => ({ ...p, [id]: !p[id] }));
  };

  if (!visible) return null;

  return (
    <>
      {/* ── Backdrop for modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-[998] bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        />
      )}

      {/* ── Preferences Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-[640px] max-h-[90vh] rounded-3xl border border-border2 bg-[#080e18] shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">

            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-border-custom bg-[rgba(0,229,255,0.03)] flex items-start justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <span className="text-xl">🍪</span>
                  <h2 className="font-display text-[18px] font-bold text-wh tracking-wide">Cookie Preferences</h2>
                </div>
                <p className="text-[11px] text-t2 font-mono leading-relaxed max-w-[420px]">
                  Manage how NEXUS Finance uses cookies. Strictly necessary cookies cannot be disabled as they are required for core platform functionality.
                </p>
              </div>
              <button onClick={() => setShowModal(false)}
                className="w-8 h-8 rounded-xl border border-border-custom flex items-center justify-center text-t3 hover:text-t1 hover:border-border2 transition-all shrink-0 ml-4">
                ✕
              </button>
            </div>

            {/* Tab + Content */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar tabs */}
              <div className="w-[160px] shrink-0 border-r border-border-custom py-3 flex flex-col gap-1 bg-[rgba(0,0,0,0.2)]">
                {COOKIE_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setActiveTab(cat.id)}
                    className={cn('flex items-center gap-2 px-3 py-2.5 mx-2 rounded-xl transition-all text-left',
                      activeTab === cat.id
                        ? 'bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.2)] text-c1'
                        : 'text-t2 hover:text-t1 hover:bg-[rgba(255,255,255,0.03)]')}>
                    <span className="text-sm">{cat.icon}</span>
                    <span className="text-[11px] font-medium leading-tight">{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* Detail panel */}
              <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
                {COOKIE_CATEGORIES.filter(c => c.id === activeTab).map(cat => (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{cat.icon}</span>
                        <div>
                          <div className="font-bold text-[14px] text-wh">{cat.label}</div>
                          {cat.required && (
                            <span className="font-mono text-[9px] text-g1 bg-[rgba(0,255,157,0.08)] border border-[rgba(0,255,157,0.2)] px-1.5 py-0.5 rounded-md">
                              Always Active
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Toggle */}
                      <button
                        onClick={() => toggle(cat.id as keyof CookiePreferences)}
                        disabled={cat.required}
                        className={cn(
                          'relative w-11 h-6 rounded-full transition-all duration-300 shrink-0',
                          cat.required
                            ? 'cursor-not-allowed opacity-60 bg-g1'
                            : prefs[cat.id as keyof CookiePreferences]
                              ? 'bg-c1'
                              : 'bg-[rgba(255,255,255,0.1)]'
                        )}>
                        <div className={cn(
                          'absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300',
                          (cat.required || prefs[cat.id as keyof CookiePreferences]) ? 'left-6' : 'left-1'
                        )} />
                      </button>
                    </div>

                    <p className="text-[12px] text-t2 leading-relaxed mb-4">{cat.desc}</p>

                    <div className="rounded-xl border border-border-custom bg-[rgba(0,0,0,0.2)] p-3">
                      <div className="font-mono text-[9px] text-t3 uppercase tracking-widest mb-2">Examples</div>
                      <div className="flex flex-col gap-1.5">
                        {cat.examples.map(ex => (
                          <div key={ex} className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-t3" />
                            <span className="font-mono text-[11px] text-t2">{ex}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-border-custom bg-[rgba(0,0,0,0.2)] flex items-center justify-between gap-3 shrink-0 flex-wrap">
              <div className="font-mono text-[9px] text-t3">
                Cookie Policy v{COOKIE_VER} · GDPR Compliant · <a href="https://algorand.foundation" target="_blank" rel="noreferrer" className="text-c1 hover:underline">Algorand Foundation</a>
              </div>
              <div className="flex gap-2">
                <button onClick={rejectAll}
                  className="px-4 py-2 rounded-xl border border-border-custom text-t2 text-[12px] font-semibold hover:border-border2 hover:text-t1 transition-all">
                  Reject All
                </button>
                <button onClick={saveCustom}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-c1 to-[#0099bb] text-black text-[12px] font-bold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)]">
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Banner ── */}
      {!showModal && (
        <div className={cn(
          'fixed bottom-5 left-1/2 -translate-x-1/2 z-[997] w-full max-w-[860px] px-4',
          'transition-all duration-500',
          saved ? 'opacity-0 translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'
        )}>
          <div className="rounded-2xl border border-[rgba(0,229,255,0.2)] bg-[rgba(8,14,24,0.97)] shadow-[0_0_60px_rgba(0,0,0,0.7),0_0_0_1px_rgba(0,229,255,0.05)] backdrop-blur-xl p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">

              {/* Icon + text */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[rgba(0,229,255,0.08)] border border-[rgba(0,229,255,0.2)] flex items-center justify-center text-xl shrink-0">
                  🍪
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-[14px] text-wh">We use cookies</span>
                    <span className="px-1.5 py-0.5 rounded border border-[rgba(0,229,255,0.25)] bg-[rgba(0,229,255,0.06)] font-mono text-[8px] text-c1 tracking-widest">GDPR</span>
                  </div>
                  <p className="text-[11px] text-t2 leading-relaxed max-w-[480px]">
                    NEXUS Finance uses cookies to secure your session, remember wallet preferences, and improve the platform. 
                    <button onClick={() => setShowModal(true)} className="text-c1 hover:underline ml-1 font-medium">
                      Manage preferences ↗
                    </button>
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button onClick={() => setShowModal(true)}
                  className="px-3 py-2 rounded-xl border border-border-custom text-t2 text-[11px] font-semibold hover:border-border2 hover:text-t1 transition-all whitespace-nowrap">
                  Customize
                </button>
                <button onClick={rejectAll}
                  className="px-3 py-2 rounded-xl border border-border-custom text-t2 text-[11px] font-semibold hover:border-border2 hover:text-t1 transition-all whitespace-nowrap">
                  Reject All
                </button>
                <button onClick={acceptAll}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-c1 to-[#0099bb] text-black text-[12px] font-bold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(0,229,255,0.2)] whitespace-nowrap">
                  Accept All
                </button>
              </div>
            </div>

            {/* Cookie type pills */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-custom flex-wrap">
              <span className="font-mono text-[9px] text-t3 uppercase tracking-widest mr-1">Includes:</span>
              {COOKIE_CATEGORIES.map(cat => (
                <span key={cat.id}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md border border-border-custom font-mono text-[9px] text-t3">
                  {cat.icon} {cat.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
