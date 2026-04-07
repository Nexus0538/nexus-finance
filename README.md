# NEXUS FINANCE — AI-Powered Autonomous Financial OS  

<div align="center">

![NEXUS FINANCE](https://img.shields.io/badge/NEXUS-FINANCE-00e5ff?style=for-the-badge&logo=algorand&logoColor=white)
![Algorand](https://img.shields.io/badge/Algorand-Testnet-00ff9d?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?style=for-the-badge&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Realtime-3ecf8e?style=for-the-badge&logo=supabase)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-000000?style=for-the-badge&logo=vercel)
![License](https://img.shields.io/badge/License-MIT-a855f7?style=for-the-badge)

**An AI agent-powered financial operating system built on the Algorand blockchain.**  
Automate DeFi strategies, tokenize real-world assets, and monitor on-chain activity — all in one futuristic dashboard.

[🚀 Live Demo](https://nexus-finance-app.vercel.app) · [🛡️ Admin Portal](https://nexus-finance-admin.vercel.app) · [📖 Docs](#-setup) · [🤝 Contributing](CONTRIBUTING.md)

</div>

---

## 🌟 Features

### 🤖 AI Agent Suite
| Agent | Role |
|---|---|
| **ARIA** | Portfolio risk analyzer & rebalancing engine |
| **DELTA** | Autonomous DeFi execution & Algorand transaction broadcaster |
| **SIGMA** | Real-world asset (RWA) underwriting & scoring |
| **KAPPA** | Cross-chain bridge coordinator |

### 📊 Core Modules
- **DeFi Matrix** — Live yield pools, staking, and liquidity management
- **RWA Investor** — Tokenized real-world assets with credit scoring
- **Transaction History** — Three-view audit trail (Table / Timeline / Analytics)
- **Live TX Demo** — Real-time Algorand testnet transaction broadcasting
- **Portfolio** — Multi-asset portfolio with AI-driven insights
- **Scanner** — Blockchain address & transaction inspector
- **Bridge** — Cross-chain asset transfers

### 🛡️ Admin Command Center (Port 5174)
- Role-based access: only whitelisted admin emails can log in
- Live user activity monitoring with drill-down per user
- Real-time transaction feed with filtering
- Audit log with auto risk classification (Low / Medium / High / Critical)
- KYC breakdown, agent activity heatmap, platform health indicators

### 🔐 Security Layer
- XSS input sanitization on all user inputs
- Client-side rate limiting with sliding window + GC
- CSRF token generation with sessionStorage persistence
- Sensitive key zero-out before clearing
- Env exposure scanning (MNEMONIC, PRIVATE_KEY, SERVICE_ROLE, etc.)
- Full audit log with risk tagging

---

## 🏗️ Architecture

```
nexus-finance/
├── frontend/          # Main user app (Vite + React + TypeScript) — port 5173
│   ├── src/
│   │   ├── pages/     # All 15 page modules
│   │   ├── components/# Sidebar, Topbar, CookieConsent, etc.
│   │   ├── lib/       # Supabase client, security utilities, Pera wallet
│   │   ├── styles/    # Global CSS with Tailwind + custom design tokens
│   │   └── types/     # Shared TypeScript interfaces
│   └── index.html
├── backend/           # FastAPI + TypeScript backend — port 3000
│   └── src/
│       └── server.ts  # AI agent endpoints, Anthropic Claude integration
├── admin/             # Admin portal (Vite + React) — port 5174
│   └── src/
│       ├── pages/     # AdminDashboard, UserMonitor, TxMonitor, AuditLogs
│       └── lib/       # Supabase client + admin allowlist
├── .env.Example       # Environment variable template
├── .gitignore
└── README.md
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TailwindCSS v4 |
| Blockchain | Algorand Testnet, Pera Wallet SDK, algosdk |
| Backend | Node.js / TypeScript, Supabase Edge Functions |
| AI | Google Gemini 2.0 Flash, Anthropic Claude |
| Database | Supabase (PostgreSQL + Realtime) |
| Auth | Supabase Auth (Email + Google OAuth) |
| Storage | Supabase Storage (KYC docs, invoices, avatars) |
| Admin | Separate Vite app, role-based allowlist auth |

---

## 🚀 Setup

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- [Pera Wallet](https://perawallet.app/) (mobile) for Algorand signing
- Google Gemini API key

### 1. Clone the repository
```bash
git clone https://github.com/Nexus0538/nexus-finance.git
cd nexus-finance
```

### 2. Configure environment variables
```bash
cp .env.Example .env
# Fill in your keys in .env
```

Required variables:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-key
```

### 3. Install & run the frontend (port 5173)
```bash
cd frontend
npm install
npm run dev
```

### 4. Install & run the backend (port 3000)
```bash
cd backend
npm install
npm run dev
```

### 5. Install & run the admin portal (port 5174)
```bash
cd admin
npm install
npm run dev
```
Access at `http://localhost:5174` — only whitelisted admin emails can log in.

---

## 🛡️ Admin Portal

The admin portal is a **completely separate Vite application** that runs on port `5174`.

- Only **two pre-approved emails** are granted access (enforced at both client-side allowlist and Supabase auth level)
- Features: user monitoring, live transaction feed, audit logs, KYC breakdown, agent activity metrics
- First-time setup: use the **CREATE ACCOUNT** tab to register your admin email

---

## 🗄️ Supabase Schema

The following tables are required:

| Table | Purpose |
|---|---|
| `user_profiles` | Extended user data, KYC, wallet address, risk profile |
| `user_settings` | Per-user app preferences |
| `agent_policies` | Per-agent config and spending limits |
| `agent_logs` | AI agent action history |
| `transactions` | On-chain and off-chain transaction records |
| `rwa_assets` | Tokenized real-world assets |
| `investments` | User investment positions |
| `price_alerts` | Custom price alert rules |
| `user_files` | KYC docs and invoice references |

---

## ▲ Deploying to Vercel

The project deploys as **two separate Vercel projects** — one for the main app and one for the admin portal.

### Frontend App

1. Go to [vercel.com/new](https://vercel.com/new) → Import `Nexus0538/nexus-finance`
2. Set **Root Directory** → `frontend`
3. Framework: **Vite** (auto-detected)
4. Add environment variables:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Click **Deploy** ✅

### Admin Portal

1. Go to [vercel.com/new](https://vercel.com/new) → Import same repo again
2. Set **Root Directory** → `admin`
3. Framework: **Vite** (auto-detected)
4. Add the same environment variables as above
5. Click **Deploy** ✅

> Both apps include a `vercel.json` that handles SPA client-side routing automatically.

> ⚠️ Set your Supabase **Site URL** and **Redirect URLs** to your Vercel domains in:  
> Supabase Dashboard → Authentication → URL Configuration

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT © 2025 NEXUS FINANCE Team. See [LICENSE](LICENSE).

---

<div align="center">
Built with ⚡ for the <strong>AlgoBharat Hackathon 2025</strong>
</div>
