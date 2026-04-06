-- ============================================================
-- NEXUS FINANCE: Complete Database Schema v2.0
-- Full reset + recreate — safe to run on existing project
-- Project: https://ngvzhmwsmjwpurpevudm.supabase.co
-- ============================================================

-- ── STEP 1: DROP everything cleanly ──────────────────────────

DROP TABLE IF EXISTS public.user_files        CASCADE;
DROP TABLE IF EXISTS public.price_alerts      CASCADE;
DROP TABLE IF EXISTS public.investments       CASCADE;
DROP TABLE IF EXISTS public.transactions      CASCADE;
DROP TABLE IF EXISTS public.rwa_assets        CASCADE;
DROP TABLE IF EXISTS public.agent_logs        CASCADE;
DROP TABLE IF EXISTS public.agent_policies    CASCADE;
DROP TABLE IF EXISTS public.user_settings     CASCADE;
DROP TABLE IF EXISTS public.user_profiles     CASCADE;

DROP FUNCTION IF EXISTS public.handle_new_user()  CASCADE;
DROP FUNCTION IF EXISTS public.set_updated_at()   CASCADE;

-- ── STEP 2: CREATE TABLES ─────────────────────────────────────

-- 1. USER PROFILES
CREATE TABLE public.user_profiles (
    id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name       TEXT,
    avatar_url      TEXT,
    wallet_address  TEXT UNIQUE,
    algo_address    TEXT,
    role            TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'agent')),
    kyc_status      TEXT DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'verified', 'rejected')),
    risk_profile    TEXT DEFAULT 'moderate' CHECK (risk_profile IN ('conservative', 'moderate', 'aggressive')),
    total_invested  DECIMAL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. USER SETTINGS
CREATE TABLE public.user_settings (
    user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    sim_mode                BOOLEAN DEFAULT TRUE,
    daily_spending_limit    DECIMAL DEFAULT 100.0,
    per_tx_limit            DECIMAL DEFAULT 10.0,
    tx_approval_threshold   DECIMAL DEFAULT 50.0,
    preferred_currency      TEXT DEFAULT 'USD',
    notifications_enabled   BOOLEAN DEFAULT TRUE,
    sound_alerts            BOOLEAN DEFAULT FALSE,
    email_digest            BOOLEAN DEFAULT FALSE,
    compact_view            BOOLEAN DEFAULT FALSE,
    refresh_interval        INTEGER DEFAULT 15,
    pera_network            TEXT DEFAULT 'testnet',
    theme                   TEXT DEFAULT 'dark',
    updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. AGENT POLICIES
CREATE TABLE public.agent_policies (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id                 UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    agent_name              TEXT NOT NULL CHECK (agent_name IN ('ARIA', 'DELTA', 'SIGMA', 'KAPPA')),
    enabled                 BOOLEAN DEFAULT TRUE,
    auto_execute            BOOLEAN DEFAULT FALSE,
    max_tx_per_day          INTEGER DEFAULT 100,
    max_tx_usd              DECIMAL DEFAULT 10.0,
    daily_budget_usd        DECIMAL DEFAULT 100.0,
    require_approval_above  DECIMAL DEFAULT 50.0,
    risk_tolerance          TEXT DEFAULT 'moderate' CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')),
    allowed_protocols       TEXT[] DEFAULT '{}',
    allowed_chains          TEXT[] DEFAULT '{Algorand}',
    emergency_stop          BOOLEAN DEFAULT FALSE,
    version                 INTEGER DEFAULT 1,
    updated_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, agent_name)
);

-- 4. AGENT LOGS
CREATE TABLE public.agent_logs (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    agent_name   TEXT NOT NULL CHECK (agent_name IN ('ARIA', 'DELTA', 'SIGMA', 'KAPPA')),
    action_type  TEXT NOT NULL,
    status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    reasoning    TEXT,
    tx_id        TEXT,
    amount       DECIMAL,
    asset_id     TEXT,
    metadata     JSONB DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. RWA ASSETS
CREATE TABLE public.rwa_assets (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    asset_name      TEXT NOT NULL,
    asset_type      TEXT NOT NULL CHECK (asset_type IN ('Invoice','Real Estate','Receivable','Infra Bond','AR Pool','Muni Bond')),
    issuer          TEXT,
    location        TEXT,
    total_value     DECIMAL NOT NULL DEFAULT 0,
    funded_pct      DECIMAL DEFAULT 0 CHECK (funded_pct >= 0 AND funded_pct <= 100),
    apy             DECIMAL DEFAULT 0,
    credit_grade    TEXT,
    risk_score      INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    maturity_days   INTEGER,
    min_investment  DECIMAL DEFAULT 100,
    asa_id          BIGINT,
    sector          TEXT,
    status          TEXT DEFAULT 'active' CHECK (status IN ('pending','active','funded','matured','defaulted')),
    verified        BOOLEAN DEFAULT FALSE,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. INVESTMENTS
CREATE TABLE public.investments (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_id    UUID REFERENCES public.rwa_assets(id) ON DELETE CASCADE,
    amount      DECIMAL NOT NULL,
    tx_id       TEXT,
    status      TEXT DEFAULT 'active' CHECK (status IN ('pending','active','matured','withdrawn')),
    invested_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    matured_at  TIMESTAMPTZ
);

-- 7. TRANSACTIONS
CREATE TABLE public.transactions (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    agent_name   TEXT CHECK (agent_name IN ('ARIA','DELTA','SIGMA','KAPPA')),
    tx_id        TEXT UNIQUE NOT NULL,
    tx_type      TEXT NOT NULL CHECK (tx_type IN ('TRANSFER','MINT','SWAP','BRIDGE','YIELD','INVEST','WITHDRAW')),
    amount       DECIMAL NOT NULL,
    asset_symbol TEXT DEFAULT 'ALGO',
    asset_id     BIGINT,
    from_address TEXT,
    to_address   TEXT,
    fee          DECIMAL DEFAULT 0.001,
    status       TEXT DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','failed')),
    network      TEXT DEFAULT 'algorand-testnet',
    block_number BIGINT,
    note         TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. PRICE ALERTS
CREATE TABLE public.price_alerts (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    asset_symbol  TEXT NOT NULL,
    condition     TEXT NOT NULL CHECK (condition IN ('above','below','change_pct')),
    target_value  DECIMAL NOT NULL,
    current_value DECIMAL,
    triggered     BOOLEAN DEFAULT FALSE,
    active        BOOLEAN DEFAULT TRUE,
    priority      TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
    triggered_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. USER FILES
CREATE TABLE public.user_files (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name    TEXT NOT NULL,
    file_type    TEXT NOT NULL CHECK (file_type IN ('avatar','kyc_doc','invoice','contract','other')),
    storage_path TEXT NOT NULL,
    file_size    INTEGER,
    mime_type    TEXT,
    public_url   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ── STEP 3: ROW LEVEL SECURITY ────────────────────────────────

ALTER TABLE public.user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rwa_assets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_alerts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_files     ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY "Users read own profile"   ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- user_settings
CREATE POLICY "Users read own settings"   ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- agent_policies
CREATE POLICY "Users manage own policies" ON public.agent_policies FOR ALL USING (auth.uid() = user_id);

-- agent_logs
CREATE POLICY "Public can view logs"   ON public.agent_logs FOR SELECT USING (true);
CREATE POLICY "Agents can insert logs" ON public.agent_logs FOR INSERT WITH CHECK (true);

-- rwa_assets
CREATE POLICY "View active assets"   ON public.rwa_assets FOR SELECT USING (status = 'active' OR auth.uid() = owner_id);
CREATE POLICY "Owners insert assets" ON public.rwa_assets FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners update assets" ON public.rwa_assets FOR UPDATE USING (auth.uid() = owner_id);

-- investments
CREATE POLICY "Users view own investments" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create investments"   ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- transactions
CREATE POLICY "Users view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert transactions"   ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- price_alerts
CREATE POLICY "Users manage own alerts" ON public.price_alerts FOR ALL USING (auth.uid() = user_id);

-- user_files
CREATE POLICY "Users manage own files" ON public.user_files FOR ALL USING (auth.uid() = user_id);

-- ── STEP 4: FUNCTIONS & TRIGGERS ─────────────────────────────

-- Auto-create profile + settings + agent policies on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );

    INSERT INTO public.user_settings (user_id) VALUES (NEW.id);

    INSERT INTO public.agent_policies (user_id, agent_name, max_tx_per_day, max_tx_usd, daily_budget_usd, allowed_chains)
    VALUES
        (NEW.id, 'ARIA',  200, 0.01,   2,       '{Algorand,Base}'),
        (NEW.id, 'DELTA', 50,  500,    2000,    '{Algorand,Arbitrum}'),
        (NEW.id, 'KAPPA', 20,  10000,  50000,   '{Algorand,Base,Polygon}'),
        (NEW.id, 'SIGMA', 10,  500000, 1000000, '{Algorand}');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TRIGGER set_agent_policies_updated_at
    BEFORE UPDATE ON public.agent_policies
    FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ── STEP 5: SEED DATA ─────────────────────────────────────────

INSERT INTO public.rwa_assets (asset_name, asset_type, issuer, location, total_value, funded_pct, apy, credit_grade, risk_score, maturity_days, min_investment, sector, status, verified, asa_id)
VALUES
    ('Infosys Invoice #1089',     'Invoice',     'Infosys Ltd',      'Mumbai',    120000,   78, 9.2,  'A+',  18, 42,   100,   'Tech',  'active', true, 981234501),
    ('Chennai Warehouse Complex', 'Real Estate', 'TN Realty REIT',   'Chennai',   5000000,  62, 7.8,  'A',   31, 1800, 1000,  'Infra', 'active', true, 981234502),
    ('TCS Export Receivable',     'Receivable',  'Tata Consultancy', 'Pune',      450000,   91, 11.2, 'AA',  12, 30,   500,   'Tech',  'active', true, 981234503),
    ('Mumbai Port Logistics',     'Infra Bond',  'JNPT Authority',   'Mumbai',    8000000,  34, 6.4,  'A-',  42, 3600, 5000,  'Infra', 'active', true, 981234504),
    ('Wipro AR Pool Q4',          'AR Pool',     'Wipro Ltd',        'Bangalore', 290000,   55, 10.1, 'A+',  22, 28,   250,   'Tech',  'active', true, 981234505),
    ('Delhi Metro Bond 2025',     'Muni Bond',   'DMRC Ltd',         'Delhi',     20000000, 22, 5.8,  'AA-', 9,  2520, 10000, 'Govt',  'active', true, 981234506);
