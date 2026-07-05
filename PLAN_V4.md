# LINE RAG Sales Bot — PLAN V4 (Dynamic Data Layer)

V4 is a **delta on top of PLAN_V3.md**. V1–V3 built: RAG + SQL hybrid, LangGraph agent, Excel ingestion, multi-tenant SaaS, split consoles, security/privacy program. V4 makes the bot **dynamic**: able to answer about *any named thing* the shop knows (a specific dog "Lucky", its food, the company itself), follow **links between things**, answer **filter/compare/count questions**, and stay **fresh without re-uploading Excel**.

---

## 0. FAQ — What V3 Could and Couldn't Do (the gap V4 closes)

| Question | V3 | V4 |
|---|---|---|
| "What's the info and food of **Lucky**?" | Only if food text was pasted into Lucky's description | ✅ Lucky is an **entity**; `eats → Royal Canin Puppy` is a **relation**; agent follows the link and can quote that food's own price/stock |
| "Price of this dog food?" | ✅ (already SQL) | ✅ unchanged |
| "**Cheapest** dog food?" / "dogs **under 10,000**?" / "**how many** puppies?" | ❌ no filter/sort/count capability | ✅ **structured query tool** (safe JSON filter DSL → SQL) |
| "Tell me about the shop / where are you / do you deliver?" | ❌ unreliable (only if a doc existed) | ✅ **company profile** is a first-class, always-present knowledge source |
| Fresh stock/price without re-upload | ❌ stale until next Excel | ✅ push-sync API + manual quick-edit + freshness timestamps |

---

## 1. Generic Entity Model (replaces "products-only" world)

Shops don't just sell rows in a price list. A pet shop has: **animals** (Lucky — maybe for sale, maybe a customer's pet on record), **goods** (food, cages), **services** (grooming, vaccination), and **the company itself**. V4 generalizes `products` into typed entities with relations.

### 1.1 Schema (delta on V3 §4)

```
entity_types      id, tenant_id, name ('animal'|'product'|'service'|...custom),
                  schema jsonb            -- which attributes this type has (drives UI + validation)

entities          id, tenant_id, entity_type_id FK, name, sku nullable,
                  price numeric nullable, currency, stock int nullable,
                  attributes jsonb,       -- breed, age, weight, duration... per type schema
                  description text, status ('active'|'inactive'),
                  source ('excel'|'manual'|'sync'), updated_at
                  UNIQUE (tenant_id, sku); trigram index on (tenant_id, name)

entity_relations  id, tenant_id, from_entity_id FK, relation text, to_entity_id FK
                  -- 'eats', 'recommended_with', 'parent_of', 'variant_of', 'requires'
                  UNIQUE (tenant_id, from_entity_id, relation, to_entity_id)

company_profile   tenant_id PK, about text, address, opening_hours jsonb,
                  phone, line_contact, payment_methods jsonb, delivery_policy text,
                  return_policy text, custom_faq jsonb, updated_at
```

**Migration:** `products` rows become `entities` of a seeded `product` type; V2/V3 code paths (`product_lookup`, price fidelity tests) are renamed to entity equivalents — same guarantees, wider scope. Keep a `products` view for compatibility during the migration phase.

### 1.2 Embedding rule (extends V2 §5)
- One chunk per entity (row-serialized, now including its type and outgoing relations by name: `"Lucky | type: animal | golden retriever, 8 months | eats: Royal Canin Puppy | ..."`) — so pure-vector matching can also land on relation facts.
- `company_profile` is auto-serialized into a handful of chunks (about / location+hours / payment+delivery / custom FAQ) and **re-embedded on every profile save**. It always exists → "where are you?" always has a grounded source.
- Still **no PII in vectors** (V3 privacy invariant holds; entities are shop catalog data).

---

## 2. Dynamic Query Capability — the `entity_query` Tool

The gap: "cheapest", "under X", "how many", "compare". Free text-to-SQL is dangerous and hard to bound per tenant. V4 uses a **constrained JSON filter DSL**: the LLM emits a JSON object, zod validates it, a query builder compiles it to parameterized SQL. The model never writes SQL.

```ts
// What the LLM is allowed to produce (zod-enforced):
{
  entityType?: string,             // must exist in tenant's entity_types
  nameLike?: string,
  filters?: [{ field: 'price'|'stock'|`attributes.${string}`,
               op: 'eq'|'lt'|'lte'|'gt'|'gte'|'contains', value: string|number }],
  sort?: { field: 'price'|'updated_at', dir: 'asc'|'desc' },
  aggregate?: 'count'|'min_price'|'max_price'|null,
  limit?: number                   // clamped ≤ 10
}
```

- Compiled by our query builder → Drizzle → always tenant-scoped, always parameterized, read-only DB role.
- Invalid/over-clever DSL from the model → zod reject → agent falls back to vector RAG or asks a clarifying question. Never silent failure.
- "How many puppies do you have?" → `{ entityType:'animal', filters:[{field:'attributes.age_group', op:'eq', value:'puppy'}], aggregate:'count' }` → exact number from DB.

---

## 3. LangGraph Delta — Multi-Hop + New Nodes

New/changed nodes on the V2 graph:

1. `classify_intent` gains: `entity_query` (filter/compare/count), `company_info`.
2. `entity_lookup` (replaces `product_lookup`) — fuzzy name match across **all** entity types; on hit, also fetches `entity_relations` (1 hop) so Lucky's answer can include what he eats *and that food's price* in one turn.
3. `entity_query` — the §2 DSL tool.
4. `company_info` — reads `company_profile` directly (structured, no retrieval needed) + falls back to RAG for long-tail policy questions.
5. **Multi-hop loop (bounded):** the graph may take up to **2 tool iterations** before composing ("Lucky" → relation `eats` → look up that entity's price). Hard cap prevents runaway loops/costs; hop count logged in `chat_messages.tool_calls`.
6. `compose_reply` unchanged, but numeric facts (price/stock/count) must come only from tool results — extend the V2 price-fidelity invariant to **all numeric fields**.

---

## 4. Freshness — Live Data Without Re-Uploading Excel

1. **Quick edit** (`web-shop /app/products` → now `/app/catalog`): inline edit price/stock/status on any entity → immediate DB update + re-embed that one chunk. For "we just sold Lucky" this is a 5-second fix.
2. **Push-sync API** (promotes V2 phase-7 seam to core): `POST /api/tenant/sync/entities` with per-tenant API key — a shop's POS/system pushes upserts; same pipeline as Excel commit (validate → upsert → re-embed changed rows). Idempotent by `(tenant_id, sku)`.
3. **Freshness metadata:** every entity has `updated_at`; the agent's system prompt receives it per retrieved entity and hedges when stale ("price as of 12 May — want me to have staff confirm?") when older than a per-tenant threshold (default 30 days).
4. **Excel multi-sheet upgrade:** one workbook can now carry sheets mapped to different entity types + an optional `relations` sheet (`from_sku, relation, to_sku`) — so "Lucky | eats | RC-PUPPY-2KG" arrives via the same upload flow.

---

## 5. Console Deltas

**`web-shop`:**
- `/app/catalog` — entity table with type filter, inline quick-edit, relations editor (pick entity → add "eats/recommended_with/…" → pick target).
- `/app/company` — company profile form (about, hours, address, payment, delivery, custom FAQ). Marked required at onboarding — this is what makes question #3 reliable.
- `/app/playground` — now also displays the generated query DSL + hop trace per answer (tuning tool for dynamic queries).
- API keys page for push-sync (create/rotate per-tenant key; hashed at rest; audit-logged).

**`web-platform`:** per-tenant metrics gain intent breakdown (how many entity_query vs rag vs company_info) + DSL-rejection rate (a high rate = the model is confused = tune the prompt).

---

## 6. Implementation Phases (delta after V3 phase 7)

| Phase | Scope | Exit test |
|---|---|---|
| 8 (3d) | Entity model migration (types/entities/relations/company_profile), compatibility view, embedding rule incl. relations + profile chunks | Existing V3 tests still green post-migration; "where is your shop" answered from profile |
| 9 (3d) | `entity_query` DSL tool (zod schema, query builder, read-only role), agent node + intent | "cheapest dog food", "dogs under 10,000", "how many puppies" all answered with DB-exact numbers; adversarial DSL inputs rejected safely |
| 10 (2d) | Multi-hop: relations fetch in `entity_lookup`, bounded 2-hop loop, numeric-fidelity invariant extended | "what food does Lucky eat and how much is it" → correct food + exact price in one reply |
| 11 (2d) | Freshness: quick-edit + single-chunk re-embed, push-sync API + keys UI, stale hedging, multi-sheet + relations-sheet Excel | POS-style script pushes a price change → bot answers new price immediately; stale entity gets hedged wording |

**Testing invariants added:** (a) numeric fidelity across all fields (reply number == DB value), (b) DSL never produces SQL outside tenant scope (property tests on the query builder), (c) relation hop cap enforced, (d) re-embed on edit leaves exactly one live vector per entity.

## 7. Out of Scope V4 → Later
True text-to-SQL over arbitrary schemas, >2-hop graph reasoning / GraphRAG, per-customer memory of *their* pets (needs PDPA consent rework — customer PII as knowledge), image recognition ("what breed is this photo"), pull-based connectors (Shopify/WooCommerce), streaming partial replies.
