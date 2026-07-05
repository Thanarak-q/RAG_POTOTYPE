# LINE RAG Sales Bot — PLAN V3 (Console Split + Security & Privacy Program)

V3 is a **delta on top of PLAN_V2.md** (which stays the base: LangGraph agent, hybrid SQL+RAG retrieval, Excel pipeline, multi-tenant Supabase/Pinecone). V3 changes three things:

1. **Split the shop console and the platform (super-admin) console into two separate apps/deployments** — not two route groups in one app.
2. **No guessable admin paths.** Nothing lives at `/admin`, `/super`, `/dashboard`, `/backoffice`, or any path that scanners hammer by default.
3. **A real security & privacy program** — not just a checklist at the bottom: threat model, PDPA (Thailand) compliance, retention, audit, and release gates.

---

## 1. What Changed from V2

| Area | V2 | V3 |
|---|---|---|
| Consoles | One `web-admin` app with `/super/*` + `/app/*` | **Two separate apps**: `web-shop` (tenants) and `web-platform` (you) — separate Vercel projects, separate domains, separate builds |
| Admin URL | `/super/*`, `/app/*` paths | Non-enumerable subdomains; platform console hidden behind Vercel Deployment Protection + MFA (see §3) |
| Attack surface | Shop and platform code shipped in one bundle | Platform-console code **never ships to shop users**; a bug/XSS in the shop console cannot expose super-admin pages |
| Security | Checklist section | Full program: threat model, audit log, secrets policy, CI scanning, release security gate (§5) |
| Privacy | Not addressed | **PDPA (Thailand) compliance plan**: consent, retention, erasure, subprocessors, PII minimization (§6) |
| Everything else | — | Unchanged from V2 (agent, ingestion, data model core, phases 0–4 logic) |

---

## 2. Architecture — Three Frontend/Backend Deployments

```
 LINE customers ──▶ svc-bot            api.<domain>            (Vercel #1, unchanged)
 Shop owners    ──▶ web-shop           app.<domain>            (Vercel #2)
 You only       ──▶ web-platform       <random>.ops.<domain>   (Vercel #3, locked)
```

**Monorepo layout (delta):**
```
apps/
├── svc-bot/          # webhooks, agent, ingestion APIs (unchanged)
├── web-shop/         # tenant console: products, upload, playground, leads, logs, settings
└── web-platform/     # YOUR console: tenants CRUD, usage/cost, health, impersonation
packages/
└── ui/               # shared UI primitives so the split doesn't duplicate components
```

Why a hard split (not route groups):
- **Bundle isolation** — Next.js route groups still build into one deployment; a misconfigured middleware or a client-bundle leak can expose platform routes/data to tenant users. Two apps = impossible by construction.
- **Independent blast radius** — a compromised shop-owner account or an XSS in the shop console touches only `web-shop`, which has zero platform endpoints.
- **Different security posture per app** — `web-platform` can be aggressively locked (deployment protection, IP allowlist, MFA-only) without annoying shop customers.
- **Separate service keys** — `web-platform` gets platform-scoped API credentials for `svc-bot`; `web-shop` gets tenant-scoped ones. `web-shop` literally has no credential capable of calling platform endpoints.

### 2.1 Backend route split in `svc-bot`
- `/api/tenant/*` — called by `web-shop`, JWT must carry `tenant_admin` role; every handler resolves `tenant_id` **from the JWT, never from the request body**.
- `/api/platform/*` — called by `web-platform` only: requires `super_admin` JWT **and** an `x-platform-key` service header (defense in depth). Optional: verify caller origin.
- `/api/line/webhook/[tenantId]` — unchanged (signature-verified, unauthenticated by design).

---

## 3. No Guessable Admin Paths — and Why Obscurity Is Layer 0, Not the Defense

You're right that `/admin` is a free gift to attackers: bots scan `/admin`, `/wp-admin`, `/administrator`, `/super`, `/dashboard` on every domain 24/7. Hiding the path removes you from that scan noise and from lazy targeted probing. **But path secrecy alone is not security** — the real protection is the stack below. V3 does both:

**Layer 0 — Don't be found:**
- Platform console lives at a **non-dictionary subdomain**, e.g. `k7x2-ops.<domain>` (random slug, rotateable via DNS). No links to it anywhere public. `robots.txt` does NOT mention it (listing it would advertise it).
- No path is named `admin/super/backoffice` in any app, including API routes (`/api/platform/*` is behind auth anyway, but keep names boring).
- Wildcard/catch-all on unknown routes returns a generic 404 identical to non-existent pages — no different error shape that confirms "something is here."

**Layer 1 — Edge gate (before the app even runs):**
- **Vercel Deployment Protection** (or Cloudflare Access) on `web-platform`: request must pass Vercel/CF SSO before reaching Next.js at all. Scanners see 401 from the edge, not your app.
- Optional IP allowlist if you have stable IPs (VPN/home). Skip if it locks you out while traveling — the SSO gate is the mandatory one.

**Layer 2 — App auth:**
- Supabase Auth, `super_admin` role required on every `web-platform` page and every `/api/platform/*` route, **enforced server-side** (middleware + per-handler check — UI hiding counts for nothing).
- **MFA/TOTP mandatory** for super-admin accounts (Supabase Auth MFA). Only your account(s) exist; no self-signup on this app (signups disabled, accounts created by seed/manually).
- Short session lifetime on platform console (e.g. 12h), long on shop console (30d).

**Layer 3 — Detection:**
- Every `/api/platform/*` call writes to `audit_logs` (§5.3). Repeated 401s on the platform subdomain → alert (simple: daily digest; later: real alerting).

Shop console (`app.<domain>`) stays discoverable — customers need to find it — protected by normal auth + RLS + rate limiting.

---

## 4. Data Model Delta (adds to V2 §3)

```
audit_logs        id, actor_user_id, actor_role, tenant_id nullable, action,
                  target_type, target_id, ip, user_agent, metadata jsonb, created_at
                  -- append-only: no UPDATE/DELETE grants; written by svc-bot service role

consents          id, tenant_id, line_user_id, policy_version, consented_at
                  -- first-contact privacy notice acceptance (§6.2)

deletion_requests id, tenant_id, line_user_id, requested_at, completed_at, status

retention_policies tenant_id PK, chat_retention_days int default 90,
                  lead_retention_days int default 365
```

Also: `admin_users` gains `mfa_enrolled bool`, `last_login_at`; `chat_messages` content is subject to retention (§6.3).

---

## 5. Security Program

### 5.1 Threat model (what we defend against, per surface)

| Surface | Threats | Controls |
|---|---|---|
| LINE webhook | forged webhooks, replay, flood | per-tenant HMAC on raw body; timestamp sanity; per-user + per-tenant rate limits; suspended-tenant short-circuit |
| Chat content | prompt injection via questions AND via uploaded product data | retrieved text delimited as data; system-prompt hardening; tools are read-only SQL (no write tools exposed to the model); product_lookup uses parameterized queries only |
| Shop console | account takeover, IDOR across tenants, malicious file upload | Supabase Auth, tenant_id from JWT only, RLS on every tenant table, upload type/size limits, SheetJS reads values not formulas, files stored private-bucket |
| Platform console | targeted attack on you | §3 layers 0–3, MFA, no self-signup, audit log |
| APIs | mass scraping, enumeration | UUIDs everywhere (no sequential ids), rate limits, generic 404s, no existence leaks in errors |
| Secrets | leakage in repo/logs | all in Vercel env / DB-encrypted (LINE creds AES-256-GCM); gitleaks in CI; secrets never logged; error responses sanitized |
| Supply chain | malicious deps | lockfile pinned, `pnpm audit` + Dependabot/Renovate, no postinstall-heavy deps without review |

### 5.2 CI security gates (run on every PR)
- `gitleaks` (secret scan), `pnpm audit --prod` (fail on high/critical), `semgrep` OWASP ruleset, TypeScript strict, zod-coverage review on new routes (every new route must parse its input).

### 5.3 Audit logging (append-only)
Log: logins (both consoles), tenant create/suspend/impersonate, credential changes, file uploads/commits, product bulk changes, deletion-request handling, every `/api/platform/*` call. Never log: message bodies, LINE tokens, passwords.

### 5.4 Release security gate (manual checklist per release)
- [ ] New/changed routes: authn + role + tenant scoping verified server-side
- [ ] Tenant-isolation tests green (A cannot read B — API level and RLS level)
- [ ] No new secret in code; env schema updated
- [ ] Error paths leak no stack/connection/user-existence info
- [ ] Rate limits cover any new public endpoint
- [ ] `web-platform` unreachable without edge SSO (curl test from clean network)

### 5.5 Incident response (lightweight, written down now)
Detect (audit anomaly / provider alert) → contain (suspend tenant / rotate key / take console offline via Vercel) → assess scope from audit_logs → rotate all potentially exposed secrets (LINE creds re-issue per tenant, DB password, API keys) → notify affected tenants within 72h if personal data involved (PDPA breach duty) → post-mortem in `docs/incidents/`.

---

## 6. Privacy Program (PDPA Thailand — customers are Thai LINE users)

LINE user IDs + chat content = **personal data** under PDPA. The tenants (shops) are data controllers for their customers; **you (platform) are the data processor** — this shapes everything below.

### 6.1 Data minimization
- Store only: LINE userId, messages, derived leads. Never request LINE profile fields we don't need (no display-name/picture fetch unless a feature needs it).
- **PII never goes into embeddings/Pinecone** — only product/doc content is embedded; customer messages are embedded transiently for retrieval (query vector is not stored).
- Logs (Vercel/console) must not contain message bodies — log message *ids* and metadata.

### 6.2 Notice & consent
- On first contact per user, the bot sends a one-time short privacy notice ("chats are stored to answer you and improve service; reply anytime with 'delete my data'") with a link to the tenant's privacy policy page (hosted on `web-shop` public page, per tenant). Record acceptance-by-continued-use in `consents` with `policy_version`.
- Platform-level privacy policy + DPA template between you and each tenant (you as processor). Ship as markdown docs (`docs/legal/`) — lawyer review before real paying customers.

### 6.3 Retention & erasure
- Nightly job (Vercel cron in svc-bot): delete `chat_messages` older than `retention_policies.chat_retention_days` (default 90); anonymize `chat_sessions` after inactivity window; expire processed `source_files` from Storage after 30 days (products/chunks already extracted).
- **Right to erasure:** customer types "delete my data" (intent detected by the agent) or shop owner triggers it in `web-shop` → `deletion_requests` row → job deletes that user's sessions/messages/leads/consents → mark completed. Test this end-to-end; it's the #1 PDPA request type.
- Tenant offboarding: suspend → 30-day grace → hard delete tenant's rows + Pinecone namespace + Storage folder. Scripted (`pnpm tenant:purge <id>`), audit-logged.

### 6.4 Subprocessors (disclose in DPA; check each has a DPA/PDPA-compatible terms)
OpenAI (or selected LLM provider — **enable zero-data-retention / no-training API tier**), Pinecone, Supabase, Vercel, Upstash, LINE. Prefer Singapore regions where the provider offers them (Supabase SG, Pinecone AWS ap-southeast-1) to keep data near Thailand.

### 6.5 Privacy invariant tests
1. Deleting a LINE user removes every row referencing them (assert across all tables).
2. No Pinecone vector metadata ever contains line_user_id or message text (assert on ingest + query paths).
3. Retention job deletes exactly the over-age rows and nothing else.

---

## 7. Implementation Phases (delta — V2 phases 0–4 unchanged, then:)

| Phase | Scope | Exit test |
|---|---|---|
| 5 (3d) | **Console split**: extract `web-platform` as third Vercel project on random ops subdomain; edge SSO (Vercel Deployment Protection); MFA-mandatory super-admin; `/api/platform/*` + `x-platform-key`; shop console keeps only tenant surface | Platform console 401s from clean network without SSO; shop JWT cannot call any `/api/platform/*`; no route in `web-shop` bundle references platform pages |
| 6 (2d) | **Security hardening**: audit_logs + writes at all listed points; CI gates (gitleaks/semgrep/audit); generic-404 behavior; rate limits verified; release gate doc | CI fails on planted secret/high-CVE; tenant-isolation + enumeration tests green |
| 7 (2d) | **Privacy**: consents flow, retention policies + nightly cron, "delete my data" end-to-end, tenant purge script, `docs/legal/` drafts, ZDR tier enabled on LLM provider | Privacy invariant tests 1–3 green; deletion request completes < 24h |
| 8 (opt) | V2 phase-7 sync connector, alerts on platform-console 401 bursts | — |

---

## 8. Out of Scope V3 → Later
SOC2-style formalization, WAF/Cloudflare full setup, SIEM, bug bounty, DPO appointment (not required at this scale), pen-test by external firm (do before charging enterprise customers), Stripe billing (still roadmap).
