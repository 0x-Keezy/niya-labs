# Deployment

How to get Niya Labs running on a real domain. This guide covers the Next.js
app on Vercel (the landing, `/companion`, `/tools` and all `/api/*` routes)
and how to ship the Chrome extension to end users.

---

## 1. Deploy the web app on Vercel

Vercel auto-detects Next.js 14 — no `vercel.json` needed.

### 1.1 Import the repo

1. [vercel.com](https://vercel.com) → **Add New Project** → connect your GitHub account → select `0x-Keezy/niya-labs`.
2. On the "Configure Project" screen, keep the framework preset as **Next.js**. The default build command (`next build`) and output directory work as-is.

### 1.2 Set environment variables

Paste these into **Settings → Environment Variables** (scope: Production). See `.env.example` for the full catalogue and comments. Minimum required set:

| Variable | Purpose | Where to get |
|---|---|---|
| `DGRID_API_KEY` | LLM gateway — powers Ask Niya + companion chat | [dgrid.ai](https://dgrid.ai) |
| `MORALIS_API_KEY` | Holders + token metadata for `/tools` | [admin.moralis.io](https://admin.moralis.io/account/credentials) |
| `MORALIS_API_KEY_2` | Backup Moralis key (auto-rotates on 429) | same dashboard |
| `BSCSCAN_API_KEY` | Wallet-age gate for Analyst Mode | [bscscan.com/myapikey](https://bscscan.com/myapikey) |
| `ADMIN_PASSWORD` | `/admin` gate (32+ chars) | `openssl rand -base64 24` |
| `SESSION_SECRET` | Signs admin session cookies | `openssl rand -base64 32` |
| `DATABASE_URL` | Postgres connection (rate limits + admin sessions) | Neon / Supabase / self-host |
| `AUTONOMY_TRADING_KILL_SWITCH` | Keep this `on` unless you know what you're doing | — |

Optional (enables extra features):

| Variable | Enables |
|---|---|
| `ELEVENLABS_API_KEY` | VTuber TTS (Yuki voice) |
| `GMGN_API_KEY` + `GMGN_PRIVATE_KEY` | GMGN behavioural tags on holders |
| `HELIUS_API_KEY` | Solana-side RPC for legacy paths |
| Twitter API creds | Autonomous tweet drafts |

> `NEXT_PUBLIC_*` variables end up in the browser bundle. Use them only if you really mean the value to be public.

### 1.3 First deploy

Click **Deploy**. You get a preview URL like `niya-labs-xxx.vercel.app` in ~3 minutes.

**Smoke test:**
- `/` → landing renders
- `/tools` → paste `0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82` (CAKE). Verdict should land in < 15 s.
- `/companion` → avatar mounts, chat replies to "hola niya".
- `/api/nyla-tools/ask` with `{ "question": "hello" }` → 200 OK.

### 1.4 Custom domain

**Settings → Domains → Add** `niyaagent.com`. Vercel shows two DNS records to add at your registrar:

- `A` record on `@` → `76.76.21.21`
- `CNAME` record on `www` → `cname.vercel-dns.com`

SSL is provisioned in ~5 minutes once DNS resolves.

---

## 2. Ship the Chrome extension

The extension is currently sideload-only. Chrome Web Store listing is a v0.2 goal.

### 2.1 Build

```bash
cd extension
npm install
npm run build   # outputs extension/dist/
```

### 2.2 Distribute

Zip the `dist/` folder and publish it as a GitHub Release asset:

```bash
cd extension/dist && zip -r ../../niya-tools-v0.1.0.zip .
```

Upload the zip to `github.com/0x-Keezy/niya-labs/releases/new` with the tag `v0.1.0`.

### 2.3 User install instructions

Put this in the release notes:

1. Download `niya-tools-v0.1.0.zip` → extract it somewhere stable (don't delete the folder after install).
2. Open `chrome://extensions`.
3. Toggle **Developer mode** on (top-right).
4. Click **Load unpacked** → select the extracted `dist/` folder.
5. Pin the Niya icon to the toolbar. Navigate to any token page on DexScreener / PancakeSwap / Four.meme / GMGN → the side panel opens with the analyzer.

### 2.4 Point the extension at production

By default the extension talks to `http://localhost:5000` (the dev backend). For the release build, update the backend URL:

- `extension/src/lib/backend.ts` → change `BACKEND_BASE` to `https://niyaagent.com`
- `extension/manifest.json` → add `https://niyaagent.com/*` to `host_permissions`
- Rebuild + re-zip

---

## 3. Post-deploy checklist

- [ ] `niyaagent.com` resolves over HTTPS
- [ ] `/tools` returns a verdict for CAKE in < 15 s
- [ ] `/companion` loads the avatar without console errors
- [ ] Extension zip downloadable from Releases
- [ ] Env vars in Vercel do NOT include any `NEXT_PUBLIC_*` secret (double-check)
- [ ] GitHub **Settings → Security → Push Protection + Secret Scanning** both enabled
- [ ] Branch protection on `main` (require PRs, require status checks)

---

## 4. Rollback

Vercel keeps the last ~50 deployments. To roll back: **Deployments → pick previous → "Promote to Production"**. For env changes: revert the variable in **Settings → Environment Variables** then redeploy.
