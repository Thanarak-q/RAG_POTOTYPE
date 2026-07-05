# DEPLOY.md — How to Ship the LINE RAG Sales Bot (V1–V3 scope)

Concrete deployment walkthrough with example values. Example identity used throughout:
- Product/domain: **salebot.app** (buy any cheap domain; Vercel can also give you `*.vercel.app` for free to start)
- First tenant (your test shop): **Lucky Pet Shop**

---

## 0. Accounts You Need (all have free tiers — prototype costs ≈ $0 + LLM usage)

| Service | Plan to start | What for |
|---|---|---|
| GitHub | free | monorepo |
| Vercel | Hobby (free) → Pro ($20/mo) when real | hosting all apps. ⚠️ Hobby = 10s function limit on some setups; the webhook needs `maxDuration: 60`, so **Pro is needed once real users chat** |
| Supabase | free tier | Postgres + Auth + Storage. Pick region **Singapore (ap-southeast-1)** |
| Pinecone | serverless free (Starter) | index `salesbot-kb`, dims **1536**, metric **cosine**, region AWS **ap-southeast-1** |
| OpenAI | pay-as-you-go, set a $ limit | `gpt-4o-mini` + `text-embedding-3-small` |
| Upstash | free | Redis rate limiting |
| LINE Developers | free | one Messaging API channel **per tenant** |

---

## 1. One-Time Infrastructure Setup

### 1.1 Supabase
1. Create project `salebot-prod` (Singapore). Save the DB password.
2. Get from Project Settings → API: `SUPABASE_URL`, `anon` key, `service_role` key; from Database: pooled connection string (port 6543, `?pgbouncer=true`) → this is `DATABASE_URL`.
3. Auth → disable public signups (accounts are created by seed/invite only, per V3).

### 1.2 Pinecone
Create serverless index: name `salesbot-kb`, dimension `1536`, metric `cosine`. Copy `PINECONE_API_KEY`. (Namespaces are created implicitly per tenant at first upsert — nothing to pre-create.)

### 1.3 Generate secrets (run locally)
```bash
openssl rand -hex 32   # CREDENTIALS_ENC_KEY  (LINE creds encryption)
openssl rand -hex 32   # INTERNAL_API_KEY     (web-shop → svc-bot)
openssl rand -hex 32   # PLATFORM_API_KEY     (web-platform → svc-bot, V3)
```
Store them in a password manager. Never commit.

---

## 2. Vercel — Three Projects from One Monorepo

Import the GitHub repo **three times** in Vercel, each with a different Root Directory:

| Vercel project | Root directory | Domain (example) | Notes |
|---|---|---|---|
| `salebot-svc` | `apps/svc-bot` | `api.salebot.app` | Node runtime; set `maxDuration: 60` on the webhook route |
| `salebot-shop` | `apps/web-shop` | `app.salebot.app` | public, discoverable |
| `salebot-platform` | `apps/web-platform` | `k7x2-ops.salebot.app` | random subdomain (V3 §3) + **enable Vercel Deployment Protection (Standard Protection)** so the edge 401s before the app runs |

Build command per project: `pnpm turbo build --filter=<app>` (or Vercel's auto-detected Next.js build with `pnpm install` at repo root — enable "Include files outside root directory" for the monorepo packages).

### 2.1 Environment variables (Vercel → Project → Settings → Env Vars)

`salebot-svc`:
```
DATABASE_URL=postgres://...pooler.supabase.com:6543/postgres?pgbouncer=true
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
PINECONE_API_KEY=...
PINECONE_INDEX=salesbot-kb
OPENAI_API_KEY=sk-...
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
CREDENTIALS_ENC_KEY=<hex from §1.3>
INTERNAL_API_KEY=<hex>
PLATFORM_API_KEY=<hex>
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

`salebot-shop`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SVC_BOT_URL=https://api.salebot.app
INTERNAL_API_KEY=<same hex>
```

`salebot-platform`: same as shop but `PLATFORM_API_KEY` instead of `INTERNAL_API_KEY`.

Set each var for **Production + Preview** (previews get a separate Supabase branch/db if you want safe previews; fine to skip at prototype stage).

### 2.2 Database migrations
Run from your machine (or a GitHub Action) against prod:
```bash
DATABASE_URL=<direct (non-pooled, port 5432) connection string> pnpm drizzle-kit migrate
pnpm seed   # creates: your super_admin user, tenant "Lucky Pet Shop"
```
Rule: migrations use the **direct** connection string; the running apps use the **pooled** one.

---

## 3. LINE Setup (per tenant — example: Lucky Pet Shop)

1. https://developers.line.biz → create Provider → create **Messaging API channel** ("Lucky Pet Shop Bot").
2. Copy **Channel secret** (Basic settings) and issue a **Channel access token** (long-lived, Messaging API tab).
3. In your **platform console** (`k7x2-ops.salebot.app`) → Tenants → Lucky Pet Shop → paste both (stored AES-encrypted; note the tenant id, e.g. `t_9f3a…`).
4. Back in LINE console → Messaging API tab:
   - Webhook URL: `https://api.salebot.app/api/line/webhook/t_9f3a...`
   - **Use webhook: ON**; press **Verify** → must return Success.
   - Turn **OFF**: Auto-reply messages and Greeting messages (LINE's defaults would answer before your bot).
5. Scan the channel's QR code with your phone → add the bot as a friend.

---

## 4. First-Run Checklist (deploy → working bot, in order)

1. `https://api.salebot.app/api/health` → `{ ok: true }` (DB + Pinecone reachable).
2. Log in to `app.salebot.app` as the seeded Lucky Pet Shop admin → upload `products.xlsx` (columns: sku, name, category, price, stock, description) → map columns → commit → status `indexed`.
3. Playground: ask "how much is the golden retriever?" → answer shows exact DB price + retrieved chunks panel.
4. LINE: message the bot "ราคาหมาโกลเด้นเท่าไหร่" → grounded answer < 10s.
5. Ask something not in the data ("do you sell cars?") → polite "I don't know".
6. Platform console: confirm today's usage row exists for the tenant.
7. Security spot-checks: `curl https://k7x2-ops.salebot.app` from a clean network → 401 at the edge; webhook POST without signature → 401; shop admin JWT against a `/api/platform/*` route → 403.

## 5. Ongoing Operations

- **Deploys:** push to `main` → all three Vercel projects auto-deploy. PRs get preview URLs. Keep migrations backward-compatible (deploy code that works with both schema versions, then migrate).
- **Onboard a new shop:** platform console → create tenant → paste their LINE creds → send them a shop-admin invite → they upload Excel → done. (This is your whole sales motion for now.)
- **Rollback:** Vercel → project → Deployments → Promote previous. DB: never roll back schema; roll forward with a fix migration.
- **Monitoring (minimum):** Vercel log drains or just the dashboard; OpenAI usage limits set; Supabase DB size alert; the V3 audit log page.
- **Cost watch (prototype, one active shop):** Vercel Pro $20 + everything else free tier + LLM ≈ $1–5/mo at low volume. `gpt-4o-mini` ≈ $0.0002 per typical answer.

## 6. Common Deploy Failures

| Symptom | Cause / fix |
|---|---|
| LINE Verify button fails | wrong tenantId in URL, webhook route not deployed, or signature check reading parsed body — must read **raw** body |
| Bot replies but slowly / times out | Hobby plan function limits → upgrade to Pro, confirm `maxDuration: 60` exported from the webhook route |
| `Too many connections` from Postgres | app using direct string instead of pooled (`:6543` + pgbouncer) |
| Works in playground, silent on LINE | Auto-reply still ON in LINE console, or channel token pasted into wrong tenant |
| Vercel build can't find `packages/*` | enable "Include files outside root directory" in each project's settings |
