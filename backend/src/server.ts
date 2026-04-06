import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { body, param, query, validationResult } from "express-validator";

// ─── Supabase Admin Client ───────────────────────────────────────────────────
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── App ─────────────────────────────────────────────────────────────────────
async function startServer() {
  const app = express();
  const PORT = 3000;
  const isDev = process.env.NODE_ENV !== 'production';

  // ══ 1. SECURITY HEADERS via Helmet ═══════════════════════════════════════
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc:     ["'self'"],
        scriptSrc:      ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc:        ["'self'", "https://fonts.gstatic.com"],
        imgSrc:         ["'self'", "data:", "https:", "blob:"],
        connectSrc:     [
          "'self'",
          "https://*.supabase.co",
          "wss://*.supabase.co",
          "https://testnet-api.algonode.cloud",
          "https://testnet-idx.algonode.cloud",
          "https://api.coingecko.com",
          "https://generativelanguage.googleapis.com",
          "wss://ws.walletconnect.com",
          "https://bridge.walletconnect.org",
        ],
        workerSrc:      ["'self'", "blob:"],
        frameSrc:       ["'none'"],
        objectSrc:      ["'none'"],
        upgradeInsecureRequests: isDev ? null : [],
      },
    },
    crossOriginEmbedderPolicy:  false, // Required for WalletConnect
    crossOriginOpenerPolicy:    { policy: 'same-origin-allow-popups' }, // Allow Pera Wallet popup
    referrerPolicy:             { policy: 'strict-origin-when-cross-origin' },
    hsts:                       isDev ? false : { maxAge: 31536000, includeSubDomains: true, preload: true },
    xFrameOptions:              { action: 'deny' },
    xContentTypeOptions:        true,
    dnsPrefetchControl:         { allow: false },
    permittedCrossDomainPolicies: false,
  }));

  // ══ 2. BODY PARSING with size limits ════════════════════════════════════
  app.use(express.json({ limit: '50kb' }));
  app.use(express.urlencoded({ extended: true, limit: '50kb' }));

  // ══ 3. CORS (strict) ════════════════════════════════════════════════════
  const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    ...(process.env.APP_URL ? [process.env.APP_URL] : []),
  ];

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin ?? '*');
    }
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-CSRF-Token, X-Requested-With');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  // ══ 4. RATE LIMITING ════════════════════════════════════════════════════

  // Global limiter: 100 req/min per IP
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests — please slow down', retryAfter: 60 },
    skip: (req) => req.path === '/api/health',
  });

  // Auth routes: strict — 10 req/15min per IP
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many auth attempts — try again in 15 minutes' },
  });

  // TX routes: 20 req/min (prevent TX spam)
  const txLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Transaction rate limit exceeded — max 20/min' },
  });

  app.use(globalLimiter);
  app.use('/api/auth', authLimiter);
  app.use('/api/transactions', txLimiter);
  app.use('/api/agent-logs', txLimiter);

  // ══ 5. REQUEST VALIDATION MIDDLEWARE ════════════════════════════════════
  const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }
    next();
  };

  // ══ 6. AUTH MIDDLEWARE ═══════════════════════════════════════════════════
  const requireAuth = async (req: any, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized — missing token' });

    // Basic token format check before hitting Supabase
    if (token.length < 100 || !/^[A-Za-z0-9\-_.]+$/.test(token)) {
      return res.status(401).json({ error: 'Unauthorized — malformed token' });
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized — invalid token' });
    req.user = user;
    next();
  };

  // ══ 7. SECURITY LOGGER ═══════════════════════════════════════════════════
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      const color = res.statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
      if (res.statusCode >= 400) {
        console.warn(`${color}[${res.statusCode}]\x1b[0m ${req.method} ${req.path} — ${ms}ms — IP: ${req.ip}`);
      }
    });
    next();
  });

  // ════════════════════════════════════════════════════════════════════════
  // API ROUTES
  // ════════════════════════════════════════════════════════════════════════

  // ── Health ──────────────────────────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'NEXUS FINANCE Backend',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      security: {
        helmet: true,
        rateLimiting: true,
        corsStrict: true,
        inputValidation: true,
      },
    });
  });

  // ── Auth ──────────────────────────────────────────────────────────────
  app.post('/api/auth/signup',
    body('email').isEmail().normalizeEmail().trim(),
    body('password').isLength({ min: 8, max: 128 }).trim(),
    body('full_name').optional().trim().escape().isLength({ max: 100 }),
    validate,
    async (req: Request, res: Response) => {
      const { email, password, full_name } = req.body;
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email, password,
        user_metadata: { full_name: full_name ?? '' },
        email_confirm: true,
      });
      if (error) return res.status(400).json({ error: error.message });
      res.json({ user: { id: data.user.id, email: data.user.email }, message: 'User created' });
    }
  );

  app.post('/api/auth/signin',
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().isLength({ max: 128 }),
    validate,
    async (req: Request, res: Response) => {
      const { email, password } = req.body;
      const client = createClient(
        process.env.VITE_SUPABASE_URL ?? '',
        process.env.VITE_SUPABASE_ANON_KEY ?? ''
      );
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return res.status(401).json({ error: error.message });
      res.json({ session: data.session, user: { id: data.user.id, email: data.user.email } });
    }
  );

  app.post('/api/auth/signout', requireAuth, async (req: any, res: Response) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    await supabaseAdmin.auth.admin.signOut(token!);
    res.json({ message: 'Signed out' });
  });

  // OAuth callback
  app.get('/auth/callback', (req: Request, res: Response) => {
    res.send(`
      <html>
        <head>
          <title>NEXUS — Authentication</title>
          <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
        </head>
        <body style="font-family:monospace;padding:20px;background:#020408;color:#00e5ff;min-height:100vh">
          <p>⬡ NEXUS — Completing authentication...</p>
          <script>
            const client = supabase.createClient("${process.env.VITE_SUPABASE_URL}", "${process.env.VITE_SUPABASE_ANON_KEY}");
            const code = new URL(window.location.href).searchParams.get('code');
            if (code) {
              client.auth.exchangeCodeForSession(code).then(({ error }) => {
                if (!error && window.opener) { window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, window.location.origin); window.close(); }
                else document.body.innerHTML += '<p style="color:#ff2255">Error: ' + (error?.message ?? 'Unknown') + '</p>';
              });
            } else {
              client.auth.getSession().then(({ data: { session } }) => {
                if (session && window.opener) { window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, window.location.origin); window.close(); }
              });
            }
          </script>
        </body>
      </html>
    `);
  });

  // ── Profile ─────────────────────────────────────────────────────────────
  app.get('/api/profile', requireAuth, async (req: any, res: Response) => {
    const { data, error } = await supabaseAdmin
      .from('user_profiles').select('*').eq('id', req.user.id).single();
    if (error) return res.status(404).json({ error: 'Profile not found' });
    res.json(data);
  });

  app.patch('/api/profile',
    requireAuth,
    body('full_name').optional().trim().escape().isLength({ max: 100 }),
    body('algo_address').optional().trim().isLength({ min: 58, max: 58 }),
    body('wallet_address').optional().trim().isLength({ min: 10, max: 150 }),
    validate,
    async (req: any, res: Response) => {
      const allowed = ['full_name', 'wallet_address', 'algo_address', 'risk_profile', 'avatar_url'];
      const updates: Record<string, any> = {};
      allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('user_profiles').update(updates).eq('id', req.user.id).select().single();
      if (error) return res.status(400).json({ error: error.message });
      res.json(data);
    }
  );

  // ── Agent Logs ─────────────────────────────────────────────────────────
  app.get('/api/agent-logs',
    query('limit').optional().isInt({ min: 1, max: 200 }),
    query('agent').optional().isIn(['ARIA', 'DELTA', 'SIGMA', 'KAPPA']),
    validate,
    async (req: Request, res: Response) => {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const agent = req.query.agent as string | undefined;
      let q = supabaseAdmin.from('agent_logs').select('*')
        .order('created_at', { ascending: false }).limit(limit);
      if (agent) q = q.eq('agent_name', agent);
      const { data, error } = await q;
      if (error) return res.status(400).json({ error: error.message });
      res.json(data);
    }
  );

  app.post('/api/agent-logs',
    body('agent_name').isIn(['ARIA', 'DELTA', 'SIGMA', 'KAPPA']),
    body('action_type').notEmpty().trim().escape().isLength({ max: 100 }),
    body('reasoning').optional().trim().isLength({ max: 5000 }),
    body('tx_id').optional().trim().isAlphanumeric().isLength({ max: 64 }),
    body('amount').optional().isFloat({ min: 0 }),
    validate,
    async (req: Request, res: Response) => {
      const { agent_name, action_type, reasoning, tx_id, amount, metadata } = req.body;
      const { data, error } = await supabaseAdmin.from('agent_logs').insert({
        agent_name, action_type, reasoning, tx_id, amount,
        status: 'completed',
        metadata: typeof metadata === 'object' ? metadata : {},
      }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      res.status(201).json(data);
    }
  );

  // ── RWA Assets ─────────────────────────────────────────────────────────
  app.get('/api/rwa-assets', async (_req: Request, res: Response) => {
    const { data, error } = await supabaseAdmin
      .from('rwa_assets').select('*').eq('status', 'active').order('apy', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  app.get('/api/rwa-assets/:id',
    param('id').isUUID(),
    validate,
    async (req: Request, res: Response) => {
      const { data, error } = await supabaseAdmin
        .from('rwa_assets').select('*').eq('id', req.params.id).single();
      if (error) return res.status(404).json({ error: 'Asset not found' });
      res.json(data);
    }
  );

  // ── Transactions ────────────────────────────────────────────────────────
  app.get('/api/transactions',
    requireAuth,
    query('limit').optional().isInt({ min: 1, max: 500 }),
    validate,
    async (req: any, res: Response) => {
      const limit = Math.min(Number(req.query.limit ?? 100), 500);
      const { data, error } = await supabaseAdmin
        .from('transactions').select('*').eq('user_id', req.user.id)
        .order('created_at', { ascending: false }).limit(limit);
      if (error) return res.status(400).json({ error: error.message });
      res.json(data);
    }
  );

  app.post('/api/transactions',
    requireAuth,
    body('tx_id').notEmpty().isAlphanumeric().isLength({ min: 10, max: 64 }),
    body('tx_type').isIn(['TRANSFER', 'MINT', 'SWAP', 'BRIDGE', 'YIELD', 'INVEST', 'WITHDRAW']),
    body('amount').isFloat({ min: 0, max: 1_000_000_000 }),
    body('asset_symbol').optional().trim().isAlphanumeric().isLength({ max: 20 }),
    body('from_address').optional().trim().isLength({ max: 62 }),
    body('to_address').optional().trim().isLength({ max: 62 }),
    body('note').optional().trim().isLength({ max: 1000 }),
    validate,
    async (req: any, res: Response) => {
      const { tx_id, tx_type, amount, asset_symbol, from_address, to_address, agent_name, note } = req.body;
      const { data, error } = await supabaseAdmin.from('transactions').insert({
        user_id: req.user.id, tx_id, tx_type, amount,
        asset_symbol: asset_symbol ?? 'ALGO',
        from_address, to_address, agent_name, note,
        fee: 0.001, status: 'confirmed', network: 'algorand-testnet',
      }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      res.status(201).json(data);
    }
  );

  // ── Agent Policies ─────────────────────────────────────────────────────
  app.get('/api/agent-policies', requireAuth, async (req: any, res: Response) => {
    const { data, error } = await supabaseAdmin
      .from('agent_policies').select('*').eq('user_id', req.user.id);
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  app.put('/api/agent-policies/:agent',
    requireAuth,
    param('agent').isIn(['ARIA', 'DELTA', 'SIGMA', 'KAPPA']),
    body('max_tx_usd').optional().isFloat({ min: 0, max: 10_000_000 }),
    body('daily_budget_usd').optional().isFloat({ min: 0, max: 100_000_000 }),
    body('max_tx_per_day').optional().isInt({ min: 0, max: 10_000 }),
    body('enabled').optional().isBoolean(),
    body('auto_execute').optional().isBoolean(),
    body('emergency_stop').optional().isBoolean(),
    body('risk_tolerance').optional().isIn(['conservative', 'moderate', 'aggressive']),
    validate,
    async (req: any, res: Response) => {
      const agent = req.params.agent.toUpperCase();
      const safe = ['enabled','auto_execute','max_tx_per_day','max_tx_usd','daily_budget_usd',
        'require_approval_above','risk_tolerance','allowed_protocols','allowed_chains','emergency_stop'];
      const updates: Record<string, any> = { user_id: req.user.id, agent_name: agent };
      safe.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
      updates.updated_at = new Date().toISOString();
      const { data, error } = await supabaseAdmin
        .from('agent_policies').upsert(updates).select().single();
      if (error) return res.status(400).json({ error: error.message });
      res.json(data);
    }
  );

  // ── Price Alerts ───────────────────────────────────────────────────────
  app.get('/api/alerts', requireAuth, async (req: any, res: Response) => {
    const { data, error } = await supabaseAdmin
      .from('price_alerts').select('*').eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data);
  });

  app.post('/api/alerts',
    requireAuth,
    body('asset_symbol').notEmpty().trim().isAlphanumeric().isLength({ max: 20 }),
    body('condition').isIn(['above', 'below', 'change_pct']),
    body('target_value').isFloat({ min: 0 }),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    validate,
    async (req: any, res: Response) => {
      const { asset_symbol, condition, target_value, priority } = req.body;
      const { data, error } = await supabaseAdmin.from('price_alerts').insert({
        user_id: req.user.id, asset_symbol, condition, target_value,
        priority: priority ?? 'medium', triggered: false, active: true,
      }).select().single();
      if (error) return res.status(400).json({ error: error.message });
      res.status(201).json(data);
    }
  );

  app.delete('/api/alerts/:id',
    requireAuth,
    param('id').isUUID(),
    validate,
    async (req: any, res: Response) => {
      const { error } = await supabaseAdmin
        .from('price_alerts').delete().eq('id', req.params.id).eq('user_id', req.user.id);
      if (error) return res.status(400).json({ error: error.message });
      res.json({ message: 'Alert deleted' });
    }
  );

  // ══ 8. ERROR HANDLERS ════════════════════════════════════════════════════

  // 404 handler
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Global error handler — never leak stack traces to client
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[NEXUS Server Error]', err);
    res.status(err.status ?? 500).json({
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    });
  });

  // ══ 9. VITE / STATIC SERVING ════════════════════════════════════════════
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: path.join(process.cwd(), 'frontend'),
      configFile: path.join(process.cwd(), 'vite.config.ts'),
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  // ══ START ════════════════════════════════════════════════════════════════
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ⬡ NEXUS FINANCE Backend  →  http://localhost:${PORT}`);
    console.log(`  🔒 Security              →  Helmet · RateLimit · CORS · Validation`);
    console.log(`  📡 Health               →  http://localhost:${PORT}/api/health`);
    console.log(`  🔑 Supabase             →  ${process.env.VITE_SUPABASE_URL ? '✅ Connected' : '❌ Missing'}`);
    console.log(`  🤖 Gemini AI            →  ${process.env.GEMINI_API_KEY ? '✅ Configured' : '❌ Missing'}\n`);
  });
}

startServer();
