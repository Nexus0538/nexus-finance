/**
 * NEXUS FINANCE — Supabase Service Layer
 * Handles: Auth, User Profiles, Agent Policies, Transactions,
 *          RWA Assets, Investments, Alerts, File Storage
 */
import { supabase } from './supabase';
import type { User, Session } from '@supabase/supabase-js';

// ─── Types ─────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  algo_address: string | null;
  role: 'user' | 'admin' | 'agent';
  kyc_status: 'none' | 'pending' | 'verified' | 'rejected';
  risk_profile: 'conservative' | 'moderate' | 'aggressive';
  total_invested: number;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  sim_mode: boolean;
  daily_spending_limit: number;
  per_tx_limit: number;
  tx_approval_threshold: number;
  preferred_currency: string;
  notifications_enabled: boolean;
  sound_alerts: boolean;
  email_digest: boolean;
  compact_view: boolean;
  refresh_interval: number;
  pera_network: string;
  theme: string;
}

export interface AgentPolicy {
  id: string;
  user_id: string;
  agent_name: 'ARIA' | 'DELTA' | 'SIGMA' | 'KAPPA';
  enabled: boolean;
  auto_execute: boolean;
  max_tx_per_day: number;
  max_tx_usd: number;
  daily_budget_usd: number;
  require_approval_above: number;
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  allowed_protocols: string[];
  allowed_chains: string[];
  emergency_stop: boolean;
  version: number;
}

export interface AgentLog {
  id: string;
  user_id: string | null;
  agent_name: string;
  action_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  reasoning: string | null;
  tx_id: string | null;
  amount: number | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface RWAAsset {
  id: string;
  asset_name: string;
  asset_type: string;
  issuer: string | null;
  location: string | null;
  total_value: number;
  funded_pct: number;
  apy: number;
  credit_grade: string | null;
  risk_score: number | null;
  maturity_days: number | null;
  min_investment: number;
  asa_id: number | null;
  sector: string | null;
  status: string;
  verified: boolean;
}

export interface Transaction {
  id: string;
  agent_name: string | null;
  tx_id: string;
  tx_type: string;
  amount: number;
  asset_symbol: string;
  from_address: string | null;
  to_address: string | null;
  fee: number;
  status: string;
  network: string;
  note: string | null;
  created_at: string;
}

export interface PriceAlert {
  id: string;
  asset_symbol: string;
  condition: 'above' | 'below' | 'change_pct';
  target_value: number;
  current_value: number | null;
  triggered: boolean;
  active: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

// ─── AUTH ──────────────────────────────────────────────────

export const authService = {
  /** Sign up with email + password */
  async signUp(email: string, password: string, fullName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName ?? '' },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { data, error };
  },

  /** Sign in with email + password */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  },

  /** Sign in with Google OAuth */
  async signInWithGoogle() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    return { data, error };
  },

  /** Sign out */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  /** Get current session */
  async getSession(): Promise<{ session: Session | null; error: any }> {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  },

  /** Get current user */
  async getUser(): Promise<{ user: User | null; error: any }> {
    const { data, error } = await supabase.auth.getUser();
    return { user: data.user, error };
  },

  /** Reset password */
  async resetPassword(email: string) {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    return { data, error };
  },

  /** Subscribe to auth state changes */
  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// ─── USER PROFILE ──────────────────────────────────────────

export const profileService = {
  /** Get current user's profile */
  async getProfile(userId: string): Promise<{ data: UserProfile | null; error: any }> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  /** Update user profile */
  async updateProfile(userId: string, updates: Partial<UserProfile>) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  /** Update Pera Wallet address */
  async setAlgoAddress(userId: string, address: string) {
    return profileService.updateProfile(userId, { algo_address: address });
  },

  /** Upload avatar to Supabase Storage */
  async uploadAvatar(userId: string, file: File) {
    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });
    if (error) return { data: null, error };
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    await profileService.updateProfile(userId, { avatar_url: publicUrl });
    return { data: { path, publicUrl }, error: null };
  },
};

// ─── USER SETTINGS ─────────────────────────────────────────

export const settingsService = {
  async getSettings(userId: string): Promise<{ data: UserSettings | null; error: any }> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    return { data, error };
  },

  async updateSettings(userId: string, updates: Partial<UserSettings>) {
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, ...updates, updated_at: new Date().toISOString() })
      .select()
      .single();
    return { data, error };
  },
};

// ─── AGENT POLICIES ────────────────────────────────────────

export const agentPolicyService = {
  /** Get all agent policies for a user */
  async getPolicies(userId: string): Promise<{ data: AgentPolicy[] | null; error: any }> {
    const { data, error } = await supabase
      .from('agent_policies')
      .select('*')
      .eq('user_id', userId)
      .order('agent_name');
    return { data, error };
  },

  /** Update a specific agent's policy */
  async updatePolicy(userId: string, agentName: string, updates: Partial<AgentPolicy>) {
    const { data, error } = await supabase
      .from('agent_policies')
      .upsert({
        user_id: userId,
        agent_name: agentName,
        ...updates,
        version: (updates.version ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    return { data, error };
  },

  /** Emergency stop an agent */
  async emergencyStop(userId: string, agentName: string) {
    return agentPolicyService.updatePolicy(userId, agentName, {
      emergency_stop: true, enabled: false, auto_execute: false,
    });
  },
};

// ─── AGENT LOGS ────────────────────────────────────────────

export const agentLogService = {
  /** Fetch recent agent logs */
  async getLogs(userId?: string, limit = 50): Promise<{ data: AgentLog[] | null; error: any }> {
    let query = supabase
      .from('agent_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query;
    return { data, error };
  },

  /** Insert a new agent log */
  async insertLog(log: Omit<AgentLog, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('agent_logs')
      .insert(log)
      .select()
      .single();
    return { data, error };
  },

  /** Subscribe to real-time agent logs */
  subscribeToLogs(callback: (log: AgentLog) => void) {
    return supabase
      .channel('agent_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_logs' },
        (payload) => callback(payload.new as AgentLog))
      .subscribe();
  },
};

// ─── RWA ASSETS ────────────────────────────────────────────

export const rwaService = {
  /** Get all active RWA assets */
  async getAssets(): Promise<{ data: RWAAsset[] | null; error: any }> {
    const { data, error } = await supabase
      .from('rwa_assets')
      .select('*')
      .eq('status', 'active')
      .order('apy', { ascending: false });
    return { data, error };
  },

  /** Get a single asset by ID */
  async getAsset(id: string): Promise<{ data: RWAAsset | null; error: any }> {
    const { data, error } = await supabase
      .from('rwa_assets')
      .select('*')
      .eq('id', id)
      .single();
    return { data, error };
  },

  /** Submit a new RWA asset for underwriting */
  async submitAsset(asset: Omit<RWAAsset, 'id' | 'status' | 'funded_pct'> & { owner_id: string }) {
    const { data, error } = await supabase
      .from('rwa_assets')
      .insert({ ...asset, status: 'pending', funded_pct: 0 })
      .select()
      .single();
    return { data, error };
  },

  /** Get user's investments */
  async getUserInvestments(userId: string) {
    const { data, error } = await supabase
      .from('investments')
      .select('*, rwa_assets(*)')
      .eq('user_id', userId)
      .eq('status', 'active');
    return { data, error };
  },

  /** Create an investment */
  async invest(userId: string, assetId: string, amount: number, txId?: string) {
    const { data, error } = await supabase
      .from('investments')
      .insert({ user_id: userId, asset_id: assetId, amount, tx_id: txId })
      .select()
      .single();
    return { data, error };
  },
};

// ─── TRANSACTIONS ──────────────────────────────────────────

export const txService = {
  /** Get user's transaction history */
  async getTransactions(userId: string, limit = 100): Promise<{ data: Transaction[] | null; error: any }> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    return { data, error };
  },

  /** Record a new transaction */
  async recordTransaction(userId: string, tx: Omit<Transaction, 'id' | 'created_at'>) {
    const { data, error } = await supabase
      .from('transactions')
      .insert({ user_id: userId, ...tx })
      .select()
      .single();
    return { data, error };
  },

  /** Subscribe to real-time transactions */
  subscribeToTransactions(userId: string, callback: (tx: Transaction) => void) {
    return supabase
      .channel(`transactions_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'transactions',
        filter: `user_id=eq.${userId}`,
      }, (payload) => callback(payload.new as Transaction))
      .subscribe();
  },
};

// ─── PRICE ALERTS ──────────────────────────────────────────

export const alertService = {
  async getAlerts(userId: string): Promise<{ data: PriceAlert[] | null; error: any }> {
    const { data, error } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  async createAlert(userId: string, alert: Omit<PriceAlert, 'id' | 'triggered' | 'triggered_at' | 'created_at'>) {
    const { data, error } = await supabase
      .from('price_alerts')
      .insert({ user_id: userId, ...alert, triggered: false })
      .select()
      .single();
    return { data, error };
  },

  async deleteAlert(alertId: string) {
    const { error } = await supabase.from('price_alerts').delete().eq('id', alertId);
    return { error };
  },

  async toggleAlert(alertId: string, active: boolean) {
    const { data, error } = await supabase
      .from('price_alerts')
      .update({ active })
      .eq('id', alertId)
      .select()
      .single();
    return { data, error };
  },
};

// ─── FILE STORAGE ──────────────────────────────────────────

export const storageService = {
  /** Upload a KYC document */
  async uploadKycDoc(userId: string, file: File) {
    const path = `${userId}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('kyc-docs')
      .upload(path, file, { upsert: false });
    if (error) return { data: null, error };
    // Record file reference in DB
    await supabase.from('user_files').insert({
      user_id: userId, file_name: file.name,
      file_type: 'kyc_doc', storage_path: path,
      file_size: file.size, mime_type: file.type,
    });
    return { data, error: null };
  },

  /** Upload an invoice document */
  async uploadInvoice(userId: string, file: File) {
    const path = `${userId}/${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(path, file);
    if (error) return { data: null, error };
    const { data: { publicUrl } } = supabase.storage.from('invoices').getPublicUrl(path);
    await supabase.from('user_files').insert({
      user_id: userId, file_name: file.name,
      file_type: 'invoice', storage_path: path,
      file_size: file.size, mime_type: file.type, public_url: publicUrl,
    });
    return { data: { path, publicUrl }, error: null };
  },

  /** Get all files for a user */
  async getUserFiles(userId: string) {
    const { data, error } = await supabase
      .from('user_files')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return { data, error };
  },

  /** Delete a file */
  async deleteFile(userId: string, path: string, bucket: string) {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (!error) {
      await supabase.from('user_files').delete().eq('storage_path', path).eq('user_id', userId);
    }
    return { error };
  },
};

// ─── REAL-TIME HELPERS ─────────────────────────────────────

export const realtimeService = {
  /** Subscribe to all relevant tables for a user */
  subscribeAll(userId: string, handlers: {
    onTransaction?: (tx: Transaction) => void;
    onAgentLog?: (log: AgentLog) => void;
    onAlert?: (alert: PriceAlert) => void;
  }) {
    const channels: ReturnType<typeof supabase.channel>[] = [];

    if (handlers.onTransaction) {
      channels.push(txService.subscribeToTransactions(userId, handlers.onTransaction));
    }
    if (handlers.onAgentLog) {
      channels.push(agentLogService.subscribeToLogs(handlers.onAgentLog));
    }

    return () => channels.forEach(c => supabase.removeChannel(c));
  },
};

// ─── UTILITY: Fetch complete user context ─────────────────

export async function fetchUserContext(userId: string) {
  const [profile, settings, policies, recentTx] = await Promise.all([
    profileService.getProfile(userId),
    settingsService.getSettings(userId),
    agentPolicyService.getPolicies(userId),
    txService.getTransactions(userId, 20),
  ]);
  return {
    profile: profile.data,
    settings: settings.data,
    policies: policies.data,
    recentTransactions: recentTx.data,
  };
}
