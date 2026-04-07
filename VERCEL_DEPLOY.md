# Nexus Finance — Vercel Deployment Guide

## Architecture: 2 Separate Vercel Projects

| Project | Folder | Type | URL example |
|---------|--------|------|------------|
| `nexus-backend` | `nexus-finance/backend` | Node.js Serverless | `nexus-backend.vercel.app` |
| `nexus-admin` | `nexus-finance/admin` | Vite SPA | `nexus-admin.vercel.app` |

---

## ① Deploy the Backend

### What was changed
| File | Change |
|------|--------|
| `backend/api/index.ts` | **New** — serverless Express handler (`export default app`) |
| `backend/tsconfig.json` | **New** — CommonJS target for `@vercel/node` |
| `backend/vercel.json` | Updated — routes all traffic to `api/index.ts` |
| `backend/package.json` | Removed `"type":"module"`, added `vercel-build` script |

### Deploy steps

```bash
# Option A — Vercel CLI (recommended)
npm i -g vercel
cd nexus-finance/backend
vercel --prod
```

When prompted:
- **Root directory:** `nexus-finance/backend` _(or confirm current)_
- **Framework:** Other
- **Build command:** `npm run vercel-build`
- **Output directory:** _(leave blank — serverless)_

### Backend Environment Variables

Set these in **Vercel > Project > Settings > Environment Variables**:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://ngvzhmwsmjwpurpevudm.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_nuP1JLoLP1W3yQvg1ePmFQ_cZxXOawz` |
| `SUPABASE_SERVICE_ROLE_KEY` | _(your Supabase service role secret key)_ |
| `GEMINI_API_KEY` | _(your Gemini API key)_ |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://nexus-frontend.vercel.app` |
| `ADMIN_URL` | `https://nexus-admin.vercel.app` _(set after admin deploy)_ |

After deploy, copy the backend URL — you need it for the admin.

---

## ② Deploy the Admin

### What was changed
| File | Change |
|------|--------|
| `admin/vercel.json` | Added `framework`, `buildCommand`, `outputDirectory` |
| `admin/tsconfig.json` | Added `"types": ["vite/client"]` (fixes `import.meta.env` TS error) |

### Deploy steps

```bash
cd nexus-finance/admin
vercel --prod
```

When prompted:
- **Framework:** Vite _(auto-detected)_
- **Build command:** `npm run build`
- **Output directory:** `dist`

### Admin Environment Variables

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://ngvzhmwsmjwpurpevudm.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_nuP1JLoLP1W3yQvg1ePmFQ_cZxXOawz` |
| `VITE_BACKEND_URL` | `https://nexus-backend.vercel.app` |

---

## ③ After Both Are Live — Update CORS

Go back to the **backend** Vercel project and add/update:

| Variable | Value |
|----------|-------|
| `ADMIN_URL` | `https://nexus-admin.vercel.app` |

Then **redeploy** the backend so its CORS list includes the admin domain.

---

## ④ Supabase — Allowed URLs

In **Supabase > Authentication > URL Configuration**:

- **Site URL:** `https://nexus-frontend.vercel.app`
- **Redirect URLs:**
  - `https://nexus-backend.vercel.app/auth/callback`
  - `https://nexus-admin.vercel.app/**`

---

## Verify

```bash
# Backend health check
curl https://nexus-backend.vercel.app/api/health

# Expected:
# { "status": "ok", "service": "NEXUS FINANCE Backend", "version": "2.0.0" }
```

Use `vercel logs --follow` in each project folder to stream live serverless logs.
