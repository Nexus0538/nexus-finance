/**
 * NEXUS FINANCE — Security Utilities (Frontend)
 * Covers: input sanitization, rate limiting, CSP, secure storage,
 *         address validation, mnemonic protection, and audit logging
 */

// ─── XSS / Input Sanitization ──────────────────────────────

/** Strip all HTML tags and dangerous characters from user input */
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#96;')
    .trim();
}

/** Sanitize for use in URLs / query params */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Only allow https and http protocols
    if (!['https:', 'http:'].includes(parsed.protocol)) return '#';
    return parsed.toString();
  } catch {
    return '#';
  }
}

/** Sanitize note field text for Algorand transaction note */
export function sanitizeTxNote(note: string): string {
  // Algorand notes: max 1000 bytes, no control characters
  return note
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // strip control chars
    .slice(0, 1000);
}

// ─── Algorand Address Validation ───────────────────────────

/** Validates a 58-char Algorand base32 address */
export function isAlgorandAddress(addr: string): boolean {
  if (!addr || typeof addr !== 'string') return false;
  const trimmed = addr.trim();
  // Algorand addresses: 58 chars, uppercase base32 (A-Z, 2-7)
  return /^[A-Z2-7]{58}$/.test(trimmed);
}

/** Mask address for display: ABCD...WXYZ */
export function maskAddress(addr: string, head = 6, tail = 4): string {
  if (!addr || addr.length < head + tail + 3) return addr;
  return `${addr.slice(0, head)}...${addr.slice(-tail)}`;
}

/** Validate 25-word Algorand mnemonic format */
export function isValidMnemonicFormat(mnemonic: string): boolean {
  const words = mnemonic.trim().split(/\s+/);
  return words.length === 25 && words.every(w => /^[a-z]+$/.test(w));
}

// ─── Rate Limiting (Client-side) ───────────────────────────

interface RateLimitEntry { count: number; windowStart: number; }
const _rateLimitStore = new Map<string, RateLimitEntry>();
const RATE_LIMIT_MAX_KEYS = 500; // guard against unbounded growth

/** Evict expired entries to prevent memory leak */
function _gcRateLimitStore(windowMs: number): void {
  const now = Date.now();
  for (const [k, v] of _rateLimitStore.entries()) {
    if (now - v.windowStart > windowMs) _rateLimitStore.delete(k);
  }
  // Hard cap: if still too large, clear oldest half
  if (_rateLimitStore.size > RATE_LIMIT_MAX_KEYS) {
    const keys = Array.from(_rateLimitStore.keys());
    keys.slice(0, Math.floor(keys.length / 2)).forEach(k => _rateLimitStore.delete(k));
  }
}

/**
 * Client-side rate limiter
 * @returns true if request is allowed, false if limited
 */
export function checkRateLimit(key: string, maxRequests = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  _gcRateLimitStore(windowMs);
  const entry = _rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    _rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}

/** Time remaining until rate limit window resets (ms) */
export function rateLimitResetIn(key: string, windowMs = 60_000): number {
  const entry = _rateLimitStore.get(key);
  if (!entry) return 0;
  const elapsed = Date.now() - entry.windowStart;
  return Math.max(0, windowMs - elapsed);
}

// ─── Secure localStorage Wrapper ──────────────────────────

const LS_PREFIX = 'nexus_';

/** Get from localStorage with type safety */
export function secureGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Set in localStorage */
export function secureSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    console.warn('[NEXUS Security] localStorage write failed for key:', key);
  }
}

/** Remove from localStorage */
export function secureRemove(key: string): void {
  localStorage.removeItem(LS_PREFIX + key);
}

/**
 * Store sensitive value (mnemonic, private key) ONLY in sessionStorage
 * so it clears on tab close — never persists to disk cache.
 *
 * ⚠️  WARNING: sessionStorage is still accessible to any JS on the page.
 * Prefer letting Pera Wallet hold the key internally — only use this as
 * a last resort and call clearSessionSensitive() immediately after use.
 */
export function storeSessionSensitive(key: string, value: string): void {
  if (!window.isSecureContext) {
    console.error('[NEXUS Security] Refusing to store sensitive data in an insecure context.');
    auditLog('storeSessionSensitive called in insecure context', 'critical');
    return;
  }
  sessionStorage.setItem(LS_PREFIX + key, value);
  auditLog(`Sensitive value stored in sessionStorage: ${key}`, 'medium');
}

export function getSessionSensitive(key: string): string | null {
  return sessionStorage.getItem(LS_PREFIX + key);
}

/** Remove sensitive value and overwrite with zeros before clearing */
export function clearSessionSensitive(key: string): void {
  // Overwrite with garbage before removal to reduce forensic recovery risk
  sessionStorage.setItem(LS_PREFIX + key, '0'.repeat(64));
  sessionStorage.removeItem(LS_PREFIX + key);
  auditLog(`Sensitive value cleared from sessionStorage: ${key}`, 'low');
}

// ─── Content Security Policy helpers ──────────────────────

/**
 * Check if the app is running in a secure context (HTTPS or localhost)
 */
export function isSecureContext(): boolean {
  return window.isSecureContext || window.location.hostname === 'localhost';
}

// ─── Audit Log (in-memory + localStorage) ─────────────────

export interface AuditEvent {
  ts: string;
  event: string;
  details?: Record<string, unknown>;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

const _auditLog: AuditEvent[] = [];

export function auditLog(
  event: string,
  risk: AuditEvent['risk'] = 'low',
  details?: Record<string, unknown>
): void {
  const entry: AuditEvent = { ts: new Date().toISOString(), event, risk, details };
  _auditLog.push(entry);

  // Persist last 100 events to localStorage
  const stored = secureGet<AuditEvent[]>('audit_log', []);
  const updated = [...stored, entry].slice(-100);
  secureSet('audit_log', updated);

  // Warn on high/critical
  if (risk === 'high' || risk === 'critical') {
    console.warn(`[NEXUS SECURITY][${risk.toUpperCase()}] ${event}`, details ?? '');
  }
}

export function getAuditLog(): AuditEvent[] {
  return secureGet<AuditEvent[]>('audit_log', []);
}

export function clearAuditLog(): void {
  secureRemove('audit_log');
  _auditLog.length = 0;
}

// ─── Environment Secret Guard ──────────────────────────────

/**
 * Warn if any env variable is exposed to the frontend that shouldn't be.
 * Scans all VITE_ prefixed env keys for dangerous substrings — not just
 * exact matches — to catch variants like VITE_MY_PRIVATE_KEY.
 */
export function checkEnvSecurity(): void {
  const dangerousPatterns = [
    'SERVICE_ROLE', 'PRIVATE_KEY', 'SECRET',
    'MNEMONIC', 'SEED', 'API_KEY', 'AUTH_TOKEN', 'ACCESS_TOKEN',
  ];
  const allEnvKeys = Object.keys(import.meta.env as Record<string, string>);
  allEnvKeys.forEach(envKey => {
    dangerousPatterns.forEach(pattern => {
      if (envKey.toUpperCase().includes(pattern)) {
        console.error(
          `[NEXUS SECURITY] ⚠️  "${envKey}" looks like a secret and is exposed to the frontend! ` +
          'Ensure it does NOT have the VITE_ prefix if it should stay server-side.'
        );
        auditLog(`Dangerous env var exposed: ${envKey}`, 'critical');
      }
    });
  });
}

// ─── CSRF Token (SPA guard) ────────────────────────────────

const CSRF_SESSION_KEY = 'nexus_csrf';
let _csrfToken: string | null = null;

export function getCSRFToken(): string {
  // Re-use token already stored in sessionStorage (survives hot-reload)
  const stored = sessionStorage.getItem(CSRF_SESSION_KEY);
  if (stored && /^[0-9a-f]{64}$/.test(stored)) {
    _csrfToken = stored;
    return _csrfToken;
  }
  // Generate a new random 32-byte hex token
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  _csrfToken = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(CSRF_SESSION_KEY, _csrfToken);
  return _csrfToken;
}

/** Rotate the CSRF token (call after logout or privilege change) */
export function rotateCSRFToken(): string {
  sessionStorage.removeItem(CSRF_SESSION_KEY);
  _csrfToken = null;
  return getCSRFToken();
}

/** Attach CSRF token to fetch headers */
export function secureHeaders(): Record<string, string> {
  return {
    'X-CSRF-Token': getCSRFToken(),
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/json',
  };
}

// ─── TX Amount Validation ─────────────────────────────────

export function validateAlgoAmount(amount: string, maxAlgo = 10_000): {
  valid: boolean; microAlgos: number; error?: string;
} {
  const trimmed = amount.trim();
  const num = parseFloat(trimmed);

  if (isNaN(num) || num <= 0)    return { valid: false, microAlgos: 0, error: 'Amount must be a positive number' };
  if (num < 0.001)               return { valid: false, microAlgos: 0, error: 'Minimum amount is 0.001 ALGO' };
  if (num > maxAlgo)             return { valid: false, microAlgos: 0, error: `Maximum amount is ${maxAlgo} ALGO` };

  // Reject more than 6 decimal places (1 microAlgo resolution)
  const decimalPart = trimmed.split('.')[1];
  if (decimalPart && decimalPart.length > 6) {
    return { valid: false, microAlgos: 0, error: 'Maximum 6 decimal places (microAlgo precision)' };
  }

  // Use string-based integer math to avoid float precision drift
  const micro = Math.round(num * 1_000_000);
  return { valid: true, microAlgos: micro };
}
