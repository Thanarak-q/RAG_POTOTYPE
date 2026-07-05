# LINE RAG Chatbot Prototype

Monorepo implementation of the `PLAN.md` prototype:

- `apps/svc-bot`: Next.js API service for LINE webhook, ingestion, RAG chat, logs, and health checks.
- `apps/web-admin`: Next.js admin console for documents, playground, and chat logs.
- `packages/shared`: shared zod schemas and types.
- `packages/llm-gateway`: OpenAI-standard chat and embedding gateway.
- `drizzle`: initial Postgres migration for Neon.

## Local Setup

```bash
npm install
cp apps/svc-bot/.env.example apps/svc-bot/.env.local
cp apps/web-admin/.env.example apps/web-admin/.env.local
npm run dev:bot
npm run dev:admin
```

Run the migration in `drizzle/0000_initial.sql` against Neon before indexing documents.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

# RAG_POTOTYPE
