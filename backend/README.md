# NEXUS FINANCE — Supabase Backend Setup Guide

## ✅ Status: Already Configured

Your Supabase project is **already live and connected**:

| Item | Value |
|---|---|
| **Project URL** | `https://ngvzhmwsmjwpurpevudm.supabase.co` |
| **Anon Key** | `sb_publishable_nuP1JLo...` (in `.env`) |
| **Dashboard** | https://supabase.com/dashboard/project/ngvzhmwsmjwpurpevudm |

---

## 📋 Step 1: Run the Database Schema

Go to **Supabase Dashboard → SQL Editor** and run the full schema:

```
nexus-finance/backend/database/schema.sql
```

This creates **9 tables**:

| Table | Purpose |
|---|---|
| `user_profiles` | Extended user data (wallet, KYC, risk profile) |
| `user_settings` | Per-user app preferences (SIM mode, currency, limits) |
| `agent_policies` | Per-agent spending rules for ARIA/DELTA/KAPPA/SIGMA |
| `agent_logs` | All AI agent activity with reasoning + TX IDs |
| `rwa_assets` | Tokenized real-world assets marketplace |
| `investments` | User investment positions in RWA assets |
| `transactions` | All Algorand blockchain transactions |
| `price_alerts` | User-defined price trigger alerts |
| `user_files` | File metadata (avatars, KYC docs, invoices) |

---

## 📦 Step 2: Create Storage Buckets

Go to **Supabase → Storage → New Bucket**:

| Bucket Name | Public | Purpose |
|---|---|---|
| `avatars` | ✅ Public | User profile pictures |
| `kyc-docs` | ❌ Private | KYC identity documents |
| `invoices` | ❌ Private | RWA invoice documents |

Then add Storage RLS policies:
```sql
-- Allow public avatar reads
CREATE POLICY "Public avatars" ON storage.objects 
  FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
CREATE POLICY "User upload avatar" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 🔑 Step 3: Enable Authentication Providers

Go to **Supabase → Authentication → Providers**:

1. **Email** — already enabled by default
2. **Google OAuth**:
   - Enable Google provider
   - Add Client ID + Secret from [Google Cloud Console](https://console.cloud.google.com)
   - Add redirect URL: `https://ngvzhmwsmjwpurpevudm.supabase.co/auth/v1/callback`
   - Add site URL: `http://localhost:3000`

---

## 🔐 Step 4: Add Service Role Key (Optional — for server-side admin)

For secure server-side operations, add to `.env`:

```bash
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
```

Get it from: **Supabase → Settings → API → service_role (secret)**

> ⚠️ Never expose this key in frontend code or commit to git.

---

## 🏗 Architecture Overview

```
Frontend (React + Vite)
    ↓
frontend/src/lib/supabase.ts          ← Supabase JS client
frontend/src/lib/supabaseService.ts   ← Typed service layer

Backend (Express + TypeScript)
    ↓
backend/src/server.ts                 ← REST API + Supabase Admin

Database (Supabase PostgreSQL)
    ↓
backend/database/schema.sql           ← Full schema + RLS + triggers
```

---

## 📡 REST API Endpoints

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create new account |
| POST | `/api/auth/signin` | Email + password login |
| POST | `/api/auth/signout` | Invalidate session |
| GET  | `/auth/callback` | OAuth redirect handler |

### Profile
| Method | Endpoint | Description |
|---|---|---|
| GET   | `/api/profile` | Get current user profile |
| PATCH | `/api/profile` | Update profile fields |

### Agent Logs
| Method | Endpoint | Description |
|---|---|---|
| GET  | `/api/agent-logs?agent=ARIA&limit=50` | Fetch agent activity |
| POST | `/api/agent-logs` | Record new agent action |

### RWA Assets
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/rwa-assets` | All active RWA assets |
| GET | `/api/rwa-assets/:id` | Single asset detail |

### Transactions
| Method | Endpoint | Description |
|---|---|---|
| GET  | `/api/transactions` | User TX history |
| POST | `/api/transactions` | Record new transaction |

### Agent Policies
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/agent-policies` | All agent policies |
| PUT | `/api/agent-policies/:agent` | Update ARIA/DELTA/KAPPA/SIGMA |

### Price Alerts
| Method | Endpoint | Description |
|---|---|---|
| GET    | `/api/alerts` | User's alerts |
| POST   | `/api/alerts` | Create new alert |
| DELETE | `/api/alerts/:id` | Delete alert |

---

## 🔄 Real-Time Subscriptions

The `supabaseService.ts` file includes real-time helpers:

```typescript
import { realtimeService } from '@/lib/supabaseService';

// Subscribe to all real-time events
const unsubscribe = realtimeService.subscribeAll(userId, {
  onTransaction: (tx) => console.log('New TX:', tx),
  onAgentLog: (log) => console.log('Agent action:', log),
});

// Cleanup on unmount
return () => unsubscribe();
```

---

## 🌱 Seed Data

The schema auto-seeds 6 RWA assets on first run:
- Infosys Invoice #1089 (9.2% APY)
- Chennai Warehouse Complex (7.8% APY)
- TCS Export Receivable (11.2% APY)
- Mumbai Port Logistics (6.4% APY)
- Wipro AR Pool Q4 (10.1% APY)
- Delhi Metro Bond 2025 (5.8% APY)

---

## ⚡ Quick Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "NEXUS FINANCE Backend",
  "version": "2.0.0",
  "supabase": true,
  "gemini": true
}
```
