# LINE RAG Sales Bot — PLAN V2 (Real Product, 2026 Architecture)

V2 pivots the v1 job-board FAQ bot (`PLAN.md`) into a **sellable product**: a LINE chatbot that sells for businesses — answers price/product/stock questions grounded in the shop's own data (Excel price lists, docs, later their live DB/API). Built **shop-first, SaaS-ready**: one seeded shop works day 1, but every layer is multi-tenant so it becomes a real SaaS product where companies sign up and get their own bot — managed by **you** through a platform super-admin console.

---

## 0. FAQ — Direct Answers to the Design Questions

### Q1: "If a customer asks for the price, will the chunks be destroyed?"

**No. Chunks are never destroyed, changed, or consumed by questions.** Retrieval is 100% read-only: a question is embedded, compared against vectors, and the top matches are _copied_ into the prompt. You can ask the same question a million times; the chunks are untouched.

The real danger you're sensing is different: **naive chunking can destroy the _structure_ of price data at ingestion time.** If you chunk an Excel price list as flowing text every ~500 tokens, a chunk boundary can fall _between_ a product name and its price — then the bot retrieves "Golden Retriever puppy…" without "25,000 THB" and guesses. V2 eliminates this two ways (see §5):

1. Spreadsheets are never chunked as text — **one row = one self-contained chunk**, so a boundary can never split a product from its price.
2. Exact prices are not even answered from chunks — they come from a **SQL lookup on the `products` table** (source of truth). The LLM formats the answer; the number comes from the database.

### Q2: "If they ask for dog info, is the info destroyed?"

Same answer. Asking never destroys anything. Descriptive info ("is this breed good with kids?") is answered by vector RAG over description chunks; factual fields (price, stock, size, age) are answered from the structured `products` row. Info is only ever _replaced_ when the shop re-uploads an updated Excel — and that is a controlled diff-and-upsert (§5.3), not data loss.

### Q3: "Should we use LangGraph?"

**Yes — LangGraph.js (TypeScript).** V1 was a single retrieve→answer chain; a linear chain can't decide "this is a price question → query SQL" vs "this is a general question → vector search" vs "this person wants to buy → collect info and notify the shop owner." That routing + tool-calling + multi-step state is exactly what LangGraph is for. It orchestrates; the v1 **LLM gateway stays underneath it** (OpenAI-standard, multi-provider preserved).

### Q4: "If it's an Excel file, what should it be?"

Parsed, not chunked. Upload `.xlsx`/`.csv` → parse with SheetJS → map columns (name/price/stock/…) → each row becomes:

- a **`products` row in Postgres** (exact source of truth for price/stock), and
- **one embedding chunk** serialized from the whole row for semantic matching.

Full pipeline in §5.

---

## 1. What Changed from V1

| Area                   | V1 (prototype)                   | V2 (product)                                                                                                                                                                            |
| ---------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use case               | Job-board FAQ                    | Sales assistant (price, product, stock, buying intent)                                                                                                                                  |
| Tenancy                | Single bot                       | Multi-tenant: N companies, each with own LINE bot, data, namespace                                                                                                                      |
| Orchestration          | Linear RAG chain                 | **LangGraph.js** state graph with intent routing + tools                                                                                                                                |
| Price/facts            | From retrieved chunks            | From **SQL on `products`** (chunks only for descriptions)                                                                                                                               |
| Ingestion              | Paste text / .txt / .md          | + **Excel/CSV structured pipeline**, + DB/API sync connector (phase 7)                                                                                                                  |
| Postgres               | Neon                             | **Supabase** (Postgres + Auth + Storage in one — SaaS needs auth & file storage)                                                                                                        |
| Admin                  | One password-protected dashboard | **Two consoles**: per-tenant Shop Admin + platform **Super Admin (you)**                                                                                                                |
| Auth                   | Shared password                  | Supabase Auth, role-based: `super_admin` / `tenant_admin`                                                                                                                               |
| Carried over unchanged | —                                | Monorepo, 2 Vercel projects, LLM gateway (§ v1-4), LINE webhook mechanics (signature/raw-body/loading-animation/reply-then-push), zod everywhere, Drizzle, testing & security standards |

---

## 2. Architecture (2026)

```
 Shop A customers ─▶ LINE ─▶ /api/line/webhook/[tenantId] ──┐
 Shop B customers ─▶ LINE ─▶ /api/line/webhook/[tenantId] ──┤
                                                            ▼
                                   ┌─────────────────────────────────────┐
                                   │        svc-bot (Vercel #2)          │
                                   │  per-tenant signature verify        │
                                   │  ┌───────── LangGraph ──────────┐   │
                                   │  │ classify_intent              │   │
                                   │  │  ├─ product_lookup ─▶ SQL    │   │
                                   │  │  ├─ rag_answer ─▶ Pinecone   │   │
                                   │  │  ├─ buying_intent ─▶ handoff │   │
                                   │  │  └─ smalltalk                │   │
                                   │  │ compose_reply (Flex/text)    │   │
                                   │  └──────────┬───────────────────┘   │
                                   │      LLM gateway (OpenAI std,       │
                                   │      multi-provider — v1 §4)        │
                                   └──────┬──────────────┬───────────────┘
                                          │              │
                                 ┌────────▼───┐   ┌──────▼───────────────┐
                                 │  Pinecone  │   │  Supabase            │
                                 │ namespace  │   │  Postgres (tenants,  │
                                 │ per tenant │   │  products, chunks,   │
                                 └────────▲───┘   │  chats, usage)       │
                                          │       │  Auth (admin logins) │
                                          │       │  Storage (xlsx files)│
                                          │       └──────▲───────────────┘
                                   ┌──────┴──────────────┴───────────────┐
 You (platform owner) ────────────▶│      web-admin (Vercel #1)          │
 Shop owners ─────────────────────▶│  /super/*  Super Admin console      │
                                   │  /app/*    Tenant (shop) console    │
                                   └─────────────────────────────────────┘
```

| Service     | Deploy                           | Responsibility                                              |
| ----------- | -------------------------------- | ----------------------------------------------------------- |
| `web-admin` | Vercel project #1 (Next.js 15)   | Super-admin console + tenant shop console (role-gated)      |
| `svc-bot`   | Vercel project #2 (Node runtime) | Per-tenant LINE webhooks, LangGraph agent, ingestion, sync  |
| Pinecone    | serverless index `salesbot-kb`   | Vectors; **namespace = tenant_id** (hard isolation)         |
| Supabase    | one project                      | Postgres (Drizzle), Auth (admins), Storage (uploaded files) |

**Monorepo** (extends v1):

```
line-rag-prototype/
├── packages/
│   ├── shared/            # zod schemas, types
│   ├── llm-gateway/       # unchanged from v1 §4
│   └── agent/             # LangGraph graph, nodes, tools, prompts
├── apps/
│   ├── web-admin/         # Next.js: /super/* + /app/* consoles
│   └── svc-bot/           # webhooks, ingestion, chat API
└── drizzle/
```

---

## 3. Data Model (Supabase Postgres / Drizzle) — all tenant-scoped

```
tenants          id, name, slug, plan ('trial'|'starter'|'pro'), status ('active'|'suspended'),
                 line_channel_secret_enc, line_channel_token_enc,   -- AES-256-GCM, key in env
                 created_at

admin_users      id (= supabase auth uid), email, role ('super_admin'|'tenant_admin'),
                 tenant_id FK nullable (null for super_admin)

products         id, tenant_id FK, sku, name, category, price numeric, currency,
                 stock int, attributes jsonb, description text,
                 source ('excel'|'manual'|'sync'), source_file_id FK nullable,
                 updated_at
                 UNIQUE (tenant_id, sku)

source_files     id, tenant_id, storage_path, original_name, kind ('xlsx'|'csv'|'txt'|'md'),
                 column_mapping jsonb,          -- saved mapping, reused on re-upload
                 status ('pending'|'processed'|'failed'), row_count, error, created_at

documents        id, tenant_id, title, source_type ('product_row'|'faq'|'policy'|'description'),
                 raw_text, status, created_at, updated_at
chunks           id, tenant_id, document_id FK, product_id FK nullable,
                 chunk_index, content, token_count, pinecone_id, created_at

chat_sessions    id, tenant_id, line_user_id, started_at, last_active_at
                 UNIQUE (tenant_id, line_user_id)
chat_messages    id, session_id FK, role, content, intent, retrieved_chunk_ids jsonb,
                 tool_calls jsonb, model, latency_ms, prompt_tokens, completion_tokens, created_at

leads            id, tenant_id, session_id FK, product_id FK nullable,
                 customer_note, status ('new'|'contacted'|'closed'), created_at

usage_daily      tenant_id, date, messages int, tokens_in bigint, tokens_out bigint,
                 est_cost_usd numeric        -- feeds super-admin usage/billing views
```

Rules:

- **Every query in every repository takes `tenant_id`** — enforced by repository-layer function signatures (no raw table access from services). Add Postgres RLS as defense-in-depth in phase 6.
- `products` = source of truth for facts; `chunks` = source of truth for vectors (full Pinecone re-index from Postgres at any time, per namespace).
- LINE credentials encrypted at rest; decrypt only in webhook/send paths.

---

## 4. LangGraph Agent (`packages/agent`)

**State:** `{ tenantId, lineUserId, messages[], intent?, retrieved?, productHits?, reply? }`
**Checkpointer:** Postgres (LangGraph checkpoint tables), `thread_id = tenantId:lineUserId` → conversation memory survives serverless cold starts.

**Nodes:**

1. `classify_intent` — small/fast model call → `price_or_stock` | `product_info` | `general_faq` | `buying_intent` | `smalltalk`.
2. `product_lookup` (tool) — fuzzy match name/sku against `products` (Postgres `pg_trgm` ILIKE + trigram similarity), returns exact rows. **Prices in replies come only from these rows.** If several matches → present a short choice list.
3. `rag_answer` — embed question → Pinecone query in tenant namespace, topK 5, score floor ~0.3 → grounded answer; below floor → honest "I don't know, want me to connect you to staff?"
4. `buying_intent` — create `leads` row, confirm to customer, LINE push notification to shop owner's LINE (tenant setting).
5. `compose_reply` — format for LINE: text ≤5000 chars; product hits become **Flex Message cards** (image, name, price, "Interested" button). Language = mirror the customer (Thai/English).

Prompt hygiene (carried from v1): retrieved content is delimited data; the system prompt instructs the model to ignore instructions embedded inside retrieved chunks; persona = the tenant's shop assistant (configurable shop name/tone per tenant).

---

## 5. Ingestion

### 5.1 Excel/CSV (the main path)

1. Shop admin uploads `.xlsx`/`.csv` (limit 10MB) → Supabase Storage → `source_files` row.
2. Parse with **SheetJS**; show first 20 rows in a **column-mapping UI** (map spreadsheet columns → sku/name/price/stock/category/description/attributes). Mapping saved to `source_files.column_mapping` and auto-applied on re-uploads with the same header shape.
3. Validate rows (zod): price numeric ≥ 0, name non-empty; invalid rows reported per-row, not silently dropped.
4. Upsert `products` on `(tenant_id, sku)` (fallback natural key: normalized name).
5. Per product, serialize one chunk: `"Product: {name} | Category | Price: {price} {currency} | Stock | {attributes} | {description}"` → embed (batch) → Pinecone upsert in tenant namespace → `chunks` row linked to `product_id`.

### 5.2 Text docs (FAQ, policies, descriptions)

Unchanged from v1 §5.2: ~500-token chunks, 50 overlap, paragraph-boundary-first — appropriate for prose, never applied to spreadsheets.

### 5.3 Re-upload = controlled replacement (not destruction)

Diff incoming rows vs existing products: changed rows → update product, delete old vector by `pinecone_id`, insert re-embedded chunk; missing rows → mark product inactive (excluded from lookup), keep history; new rows → insert. Atomic per file; failure → `source_files.status='failed'` + error surfaced in UI, previous data intact.

### 5.4 DB/API sync connector (phase 7, design seam only)

Same upsert pipeline exposed as `POST /api/sync/products` (per-tenant API key) so an existing shop system can push its catalog; later add scheduled pull connectors.

---

## 6. Backend API (`apps/svc-bot`) — routes → services → repositories

- `POST /api/line/webhook/[tenantId]` — resolve tenant → verify `x-line-signature` with _that tenant's_ decrypted secret (raw body, 401 on mismatch) → loading animation → LangGraph invoke → reply (push fallback) → persist message + usage. `maxDuration: 60`, LLM timeout 25s. Suspended tenant → polite "bot unavailable" + no LLM spend.
- `POST /api/ingest/file` (upload+parse), `POST /api/ingest/commit` (mapping confirmed → run pipeline), `POST /api/ingest/text`
- `GET/DELETE /api/products…`, `GET /api/leads`, `POST /api/chat` (playground, returns intent + tool calls + chunks + scores for tuning)
- `POST /api/sync/products` (per-tenant API key, phase 7)
- Super-admin only: `GET /api/admin/tenants`, `POST /api/admin/tenants` (create + LINE creds), `PATCH …/suspend`, `GET /api/admin/usage`
- AuthZ: Supabase JWT on every admin/API route; `tenant_admin` locked to own `tenant_id`; `super_admin` role required for `/api/admin/*`. Webhook is the only unauthenticated route (signature-verified instead).
- Per-user rate limit on webhook (10 msg/min per line_user_id, Upstash Redis) + per-tenant daily message cap by plan.

---

## 7. Frontend (`apps/web-admin`) — Supabase Auth, role-gated

### 7.1 Super Admin console — `/super/*` (you, the platform owner)

- **/super/tenants** — list all companies: plan, status, msgs today, est. cost; create tenant (name + LINE channel creds + plan); suspend/reactivate; impersonate ("open shop console as this tenant") for support.
- **/super/usage** — platform dashboard: messages/tokens/cost per tenant per day (`usage_daily`), top tenants, error rate; this is your pre-billing view (real billing/Stripe = out of scope v2, table already supports it).
- **/super/health** — Pinecone/Supabase/LLM provider checks, recent webhook failures.
- **/super/settings** — platform defaults: `LLM_PROVIDER`/model per plan tier, global system-prompt template.

### 7.2 Shop (tenant) console — `/app/*` (each company)

- **/app/products** — product table (search/edit/deactivate), price and stock visible = what the bot will say.
- **/app/upload** — Excel/CSV upload → column-mapping UI → validation report → commit.
- **/app/playground** — test chat showing intent, tool calls, retrieved chunks + scores (the RAG tuning tool).
- **/app/leads** — buying-intent leads inbox with status.
- **/app/conversations** — chat log per customer.
- **/app/settings** — shop name, bot tone/persona, owner LINE ID for lead notifications, (super-admin-managed: LINE creds, plan).

---

## 8. Environment Variables

`svc-bot`: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX=salesbot-kb`, `OPENAI_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL?`, `CREDENTIALS_ENC_KEY` (32B, for LINE creds), `UPSTASH_REDIS_URL/TOKEN`, `INTERNAL_API_KEY`
`web-admin`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SVC_BOT_URL`, `INTERNAL_API_KEY`
All zod-validated at startup; `.env.example` per app; never committed. Note: per-tenant LINE secrets live in the DB (encrypted), not in env.

---

## 9. Implementation Phases (~2.5–3 weeks)

| Phase   | Scope                                                                                                                       | Exit test                                                                                                   |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 0 (1d)  | Monorepo scaffold, Supabase project, Drizzle migrations (all §3 tables), Supabase Auth wiring, deploy both apps empty       | Login works; role redirect `/super` vs `/app`                                                               |
| 1 (2d)  | Excel pipeline: upload → mapping UI → validate → products upsert → row-chunks → Pinecone (tenant ns)                        | Upload pet-shop xlsx → products table + vectors visible                                                     |
| 2 (2d)  | LangGraph agent: intent classify, product_lookup (SQL), rag_answer, compose_reply; `/api/chat` + playground                 | "how much is golden retriever" → exact DB price; "good with kids?" → grounded RAG; off-topic → "don't know" |
| 3 (2d)  | LINE per-tenant webhook: encrypted creds, signature verify, loading animation, Flex cards, reply→push fallback, persistence | Real LINE chat with seeded shop, price correct, <10s                                                        |
| 4 (2d)  | buying_intent → leads + owner push notify; conversations & leads pages; checkpointer memory                                 | "I want to buy" → lead row + owner notified; follow-up question remembers context                           |
| 5 (2d)  | Super-admin console: tenants CRUD, suspend, usage dashboard, `usage_daily` aggregation; **2nd tenant onboarded**            | Two tenants, isolated data, both bots answer only their own catalog                                         |
| 6 (2d)  | Hardening: RLS, rate limits, plan caps, re-upload diff flow, 2nd LLM provider proven, error fallbacks                       | Isolation tests pass; provider switch by env works                                                          |
| 7 (opt) | `POST /api/sync/products` connector + per-tenant API keys                                                                   | External script syncs catalog                                                                               |

---

## 10. Testing (v1 standards apply: AAA, 80%+ on packages/services)

- **Unit:** column mapper, row validator, row→chunk serializer, intent classifier prompt contract, fuzzy product matcher, signature verify per tenant, credential encrypt/decrypt.
- **Integration:** ingest commit + re-upload diff against test Supabase; LangGraph graph with faked tools; webhook route with mocked LINE.
- **Critical invariants (must have dedicated tests):**
  1. **Tenant isolation** — tenant A's chat can never retrieve tenant B's chunks or products (namespace + repo filter + RLS).
  2. **Price fidelity** — for any price question, the number in the reply string equals `products.price` exactly (assert against DB, not the LLM).
  3. Re-upload never leaves orphan vectors (Pinecone ids all present in `chunks`).
- **E2E checklist** in `docs/TESTPLAN.md` per phase exit tests.

## 11. Security Checklist (extends v1 §10)

- [ ] Per-tenant LINE secret verified on raw body; unknown tenantId → 404 without existence leak.
- [ ] LINE creds AES-256-GCM encrypted; `CREDENTIALS_ENC_KEY` only in svc-bot env.
- [ ] Every repo function requires tenant_id; RLS on all tenant tables as second layer.
- [ ] Supabase service-role key server-side only; browser uses anon key + RLS.
- [ ] Role checks (`super_admin`) on all `/super` pages and `/api/admin/*` — server-side, not just UI hiding.
- [ ] Upload limits (10MB, xlsx/csv/txt/md only), parse in try/catch, formula cells read as values (SheetJS default — no formula execution).
- [ ] Rate limits + plan caps prevent one tenant burning the platform's LLM budget.
- [ ] Prompt-injection hygiene on retrieved content and on product descriptions (they're user-supplied data too).

## 12. Out of Scope V2 → Roadmap 2026

Stripe billing & self-serve signup (usage_daily/plan fields are ready), payments inside chat (LINE Pay), inventory decrement on sale, scheduled pull-sync connectors, image search ("what dog is this photo?"), voice messages, analytics beyond usage dashboard, reranker/hybrid BM25 search, LINE rich menu builder per tenant.
