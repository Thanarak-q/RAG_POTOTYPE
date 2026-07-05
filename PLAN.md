# LINE RAG Chatbot — Prototype Implementation Plan

Prototype of a RAG (Retrieval-Augmented Generation) chatbot on **LINE Messaging API**, built as small independent services so it can later be lifted into **fastwork-app** (job board). The bot answers user questions grounded in job-board content (job postings, FAQ, platform help docs).

---

## 1. Architecture Overview (Microservice Style)

Each box is a separately deployed unit with its own repo/folder, env vars, and deploy target:

```
                                ┌──────────────────────────────┐
 LINE user ──▶ LINE Platform ──▶│  svc-bot (Vercel project #2) │
                (webhook POST)  │  - webhook verify            │
                                │  - RAG orchestration         │
                                │  - LLM gateway (OpenAI std)  │
                                └───────┬───────────┬──────────┘
                                        │           │
                              ┌─────────▼──┐   ┌────▼─────────┐
                              │  Pinecone  │   │ Neon Postgres│
                              │ (vectors)  │   │ (chat logs,  │
                              └─────────▲──┘   │  docs meta)  │
                                        │      └────▲─────────┘
                                ┌───────┴───────────┴──────────┐
 Admin browser ────────────────▶│ web-admin (Vercel project #1)│
                                │ - Next.js dashboard          │
                                │ - doc upload → ingest API    │
                                │ - chat log viewer / test UI  │
                                └──────────────────────────────┘
```

| Service       | Deploy                                         | Responsibility                                                                  |
| ------------- | ---------------------------------------------- | ------------------------------------------------------------------------------- |
| `web-admin`   | Vercel project #1 (Next.js)                    | Frontend: upload/manage knowledge docs, browse chat logs, web test-chat console |
| `svc-bot`     | Vercel project #2 (Next.js API routes or Hono) | Backend: LINE webhook, RAG pipeline, ingestion API, LLM gateway                 |
| Vector store  | Pinecone (serverless index)                    | Embeddings + similarity search                                                  |
| Relational DB | **Neon** (serverless Postgres)                 | Documents metadata, chunks source-of-truth, chat sessions/messages, config      |

**Why Neon over Supabase (decision):** the prototype only needs plain Postgres (logs + metadata); Neon's serverless driver (`@neondatabase/serverless`) works over HTTP so it's friendly to Vercel edge/serverless cold starts, and there's no unused auth/storage/realtime surface to configure. If later the fastwork integration wants built-in auth + file storage, swapping to Supabase is a connection-string + storage-adapter change only — keep DB access behind a repository layer (see §5) so this swap stays cheap.

**Monorepo layout** (one git repo, two Vercel projects pointed at subfolders):

```
line-rag-prototype/
├── PLAN.md
├── package.json              # pnpm workspaces
├── packages/
│   ├── shared/               # zod schemas, types, constants shared by both apps
│   └── llm-gateway/          # provider-agnostic LLM client (OpenAI-standard)
├── apps/
│   ├── web-admin/            # Next.js 15 App Router → Vercel project #1
│   └── svc-bot/              # Next.js API-only (or Hono on Vercel) → Vercel project #2
└── drizzle/                  # migrations (owned by svc-bot)
```

---

## 2. Tech Stack

| Layer      | Choice                                                | Notes                                                          |
| ---------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| Language   | TypeScript (strict)                                   | everywhere                                                     |
| Frontend   | Next.js 15 App Router + Tailwind                      | Vercel project #1                                              |
| Backend    | Next.js API routes (or Hono)                          | Vercel project #2; Node runtime (not edge) for LINE SDK crypto |
| ORM        | Drizzle + `@neondatabase/serverless`                  | migrations via `drizzle-kit`                                   |
| Vector DB  | Pinecone serverless, cosine, 1536 dims                | one index `fastwork-kb`, namespaces per doc type               |
| Embeddings | `text-embedding-3-small` (1536 dims)                  | cheap, good enough for prototype                               |
| LLM        | OpenAI Chat Completions **as the standard interface** | see §4 — multiple providers behind one gateway                 |
| LINE       | `@line/bot-sdk`                                       | Messaging API, reply-token based                               |
| Validation | zod at every boundary                                 | webhook payloads, API bodies, env vars                         |

---

## 3. Data Model (Neon / Drizzle)

```
documents      id, title, source_type ('job_posting'|'faq'|'help'), raw_text,
               status ('pending'|'indexed'|'failed'), created_at, updated_at
chunks         id, document_id FK, chunk_index, content, token_count,
               pinecone_id, created_at
chat_sessions  id, line_user_id (unique), started_at, last_active_at
chat_messages  id, session_id FK, role ('user'|'assistant'), content,
               retrieved_chunk_ids jsonb, model, latency_ms, created_at
```

- `chunks` is the source of truth; Pinecone holds only `{ id, values, metadata: { document_id, source_type, title } }`. This allows full re-index from Postgres at any time.
- `retrieved_chunk_ids` on messages = citation/debugging trail (which chunks grounded which answer).

---

## 4. LLM Gateway (`packages/llm-gateway`)

Requirement: **several LLM APIs, OpenAI as the main/standard**. Design: one interface, OpenAI wire format as the lingua franca.

```ts
interface LlmProvider {
  chat(req: ChatRequest): Promise<ChatResponse>; // OpenAI-shaped messages in/out
  embed(texts: string[]): Promise<number[][]>;
}
```

- **Primary provider:** `openai` (official SDK).
- **Other providers via the same OpenAI-compatible shape:** most vendors (Groq, Together, DeepSeek, OpenRouter, local vLLM) expose OpenAI-compatible endpoints → implement `OpenAiCompatProvider { baseURL, apiKey, model }` and cover them all with one class.
- **Non-compatible providers** (e.g. Anthropic native, Gemini native) get their own adapter classes later — the interface stays fixed.
- Provider selection by env: `LLM_PROVIDER=openai|openrouter|groq|...`, `LLM_MODEL=gpt-4o-mini` (default). Embeddings always via OpenAI for the prototype (keep index dims stable at 1536).
- Add per-call timeout (25s — LINE reply tokens expire), retry once on 429/5xx, and log `model + latency_ms` into `chat_messages`.

---

## 5. Backend (`apps/svc-bot`) — API Surface

Structure the code in three layers: `routes → services → repositories` (repositories are the only layer touching Drizzle/Pinecone, enabling the Neon→Supabase swap later).

### 5.1 `POST /api/line/webhook`

The core flow:

1. **Verify** `x-line-signature` (HMAC-SHA256 with channel secret) against raw body — reject 401 on mismatch. Must read the raw body (disable body parsing on this route).
2. **Ack fast:** LINE requires a 200 quickly. For the prototype, process inline but keep total budget < ~25s (reply token lifetime is well above that; the risk is Vercel function timeout — set `maxDuration: 60`).
3. Filter to `message` events of type `text`; ignore others (reply politely to stickers/images: "text only for now").
4. Show typing feedback: call LINE **loading animation** API (`/v2/bot/chat/loading/start`) so the user sees activity during RAG latency.
5. **RAG pipeline** (service layer, reused by web test-chat):
   - embed the question,
   - Pinecone query `topK=5` (optionally filter by `source_type`),
   - drop matches below score threshold (~0.3 to start; tune),
   - build prompt: system prompt (fastwork assistant persona, "answer only from context, say you don't know otherwise, answer in the user's language — Thai/English"), context block, last N=6 messages from `chat_messages` for conversational continuity,
   - call LLM gateway.
6. **Reply** via reply token (fallback to push message if the reply token was consumed/expired). Truncate to LINE's 5000-char text limit.
7. **Persist** user + assistant messages with retrieved chunk ids, model, latency.

### 5.2 `POST /api/ingest`

Called by web-admin (protected by shared secret header `x-internal-key`):

- body: `{ title, sourceType, rawText }` (prototype ingests pasted text / .txt / .md; PDF is out of scope),
- insert `documents` row (`pending`),
- chunk: ~500 tokens per chunk, 50-token overlap, split on paragraph boundaries first,
- batch-embed → upsert to Pinecone (namespace = sourceType) → insert `chunks` rows → mark document `indexed` (or `failed` with error logged).

### 5.3 Supporting endpoints

- `DELETE /api/documents/:id` — delete Pinecone vectors by ids from `chunks`, then rows.
- `POST /api/chat` — same RAG service without LINE, for the admin test console; returns answer + retrieved chunks (with scores) for debugging.
- `GET /api/health` — checks Neon + Pinecone reachability.

---

## 6. Frontend (`apps/web-admin`)

Prototype-lean, 3 pages, no auth beyond a single shared admin password (env `ADMIN_PASSWORD`, httpOnly cookie via a simple middleware) — real auth comes with fastwork integration.

1. **/documents** — list documents with status; form to paste/upload text → calls `svc-bot /api/ingest`; delete button.
2. **/playground** — test chat UI calling `svc-bot /api/chat`; shows the answer **plus retrieved chunks and scores** side by side (this is the main RAG-tuning tool).
3. **/logs** — chat sessions list → messages per session, with which chunks were used.

Server-side calls to `svc-bot` go through Next.js route handlers so `INTERNAL_API_KEY` never reaches the browser.

---

## 7. Environment Variables

`apps/svc-bot`:

```
DATABASE_URL=            # Neon pooled connection string
PINECONE_API_KEY=
PINECONE_INDEX=fastwork-kb
OPENAI_API_KEY=
LLM_PROVIDER=openai      # openai | openrouter | groq | ...
LLM_MODEL=gpt-4o-mini
LLM_BASE_URL=            # only for openai-compatible providers
LINE_CHANNEL_SECRET=
LINE_CHANNEL_ACCESS_TOKEN=
INTERNAL_API_KEY=        # shared secret with web-admin
```

`apps/web-admin`:

```
SVC_BOT_URL=
INTERNAL_API_KEY=
ADMIN_PASSWORD=
```

Validate all of these with zod at startup (`env.ts`); fail fast with a clear message. **Never commit any of them**; provide `.env.example` in each app.

---

## 8. Implementation Phases (for Codex)

### Phase 0 — Scaffold (½ day)

- pnpm monorepo, TS strict, ESLint + Prettier, `packages/shared` with zod env schemas.
- Drizzle setup + initial migration for the 4 tables. Deploy both empty apps to Vercel to prove the pipeline early.

### Phase 1 — Ingestion vertical slice (1 day)

- `llm-gateway` with `embed()` + OpenAI provider.
- `/api/ingest` end-to-end: chunking → Pinecone upsert → Postgres rows.
- Minimal `/documents` page to feed it.
- ✅ Exit test: paste an FAQ doc, see `indexed` status, verify vectors exist in Pinecone console.

### Phase 2 — RAG chat via playground (1 day)

- `chat()` in gateway, RAG service, `/api/chat`, `/playground` page with retrieved-chunk debug panel.
- ✅ Exit test: ask a question answered by the ingested doc → grounded answer with citations; ask something off-topic → "I don't know" style answer.

### Phase 3 — LINE integration (1 day)

- LINE Official Account + Messaging API channel (webhook URL = svc-bot deployment).
- Webhook route: signature verify, loading animation, reply, persistence.
- ✅ Exit test: message the bot from a real LINE account, get grounded answer < 10s.

### Phase 4 — Logs, hardening, multi-provider (1 day)

- `/logs` pages; delete-document flow; `OpenAiCompatProvider` + `LLM_PROVIDER` switch proven against one alternative (e.g. OpenRouter).
- Basic rate limit on webhook per `line_user_id` (e.g. 10 msg/min, in-memory or Upstash if needed).
- Error paths: LLM failure → apologetic fallback message to user, error logged.

**Total: ~4–5 days of work.**

---

## 9. Testing Requirements

- **Unit:** chunker (boundaries, overlap, token counts), signature verification (valid/invalid/missing), prompt builder, provider selection. Target 80%+ on `packages/*` and services layer.
- **Integration:** `/api/ingest` and `/api/chat` against mocked Pinecone/OpenAI (msw or dependency-injected fakes); Drizzle against a Neon branch database.
- **E2E (manual for prototype):** the three phase exit tests above, scripted as a checklist in `docs/TESTPLAN.md`.
- Follow AAA structure, descriptive test names (`'rejects webhook when signature is invalid'`).

## 10. Security Checklist (must hold before any deploy)

- [ ] LINE signature verified on raw body; no signature → 401.
- [ ] `INTERNAL_API_KEY` required on ingest/chat/delete endpoints; compared with constant-time equality.
- [ ] All request bodies zod-validated; reject oversized ingest payloads (> 200KB).
- [ ] No secrets in code or client bundles; `LLM_*`/`LINE_*`/`DATABASE_URL` server-only.
- [ ] SQL only through Drizzle (parameterized); no string-built queries.
- [ ] User text goes into the prompt as _data_ (delimited context), and the system prompt instructs the model to ignore instructions inside retrieved content (basic prompt-injection hygiene).
- [ ] Error responses never leak stack traces or connection strings.

## 11. Out of Scope (prototype) / Later for fastwork-app

- Real auth (→ fastwork accounts / Supabase auth), PDF & file ingestion, streaming responses, LINE rich menus/Flex Messages for job cards, auto-sync of job postings from fastwork DB (replace manual ingest with a sync worker), analytics, i18n beyond prompt-level Thai/English, reranking model, hybrid search.
- The seam for fastwork integration is `/api/ingest` (jobs sync in) and the RAG service (embed into fastwork's own chat surface).

## 12. Key Risks

| Risk                               | Mitigation                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Vercel function timeout during RAG | Node runtime, `maxDuration: 60`, 25s LLM timeout, fallback push message                                           |
| Reply token expiry (single use)    | reply-then-push fallback                                                                                          |
| Thai-language retrieval quality    | `text-embedding-3-small` handles Thai reasonably; playground scores panel exists precisely to tune topK/threshold |
| Vector/DB drift                    | Postgres `chunks` is source of truth; re-index script (`pnpm reindex`) rebuilds Pinecone from DB                  |
| Provider lock-in                   | LLM gateway interface (§4); OpenAI wire format as standard                                                        |
