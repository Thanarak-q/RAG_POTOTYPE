# LINE RAG Prototype Test Plan

## Automated

Run these before deploy:

```bash
npm install
npm test
npm run typecheck
npm run build
```

Expected coverage target: 80%+ for package code and `svc-bot` service-layer tests.

## Manual Phase Exit Tests

### Phase 1: Ingestion

1. Start `svc-bot` and `web-admin`.
2. Open `/documents`.
3. Paste a short FAQ document and index it.
4. Confirm the document status becomes `indexed`.
5. Confirm the Pinecone index contains vectors with `documentId`, `sourceType`, and `title` metadata.

### Phase 2: RAG Playground

1. Open `/playground`.
2. Ask a question that is answered by the ingested FAQ.
3. Confirm the answer is grounded in retrieved chunks.
4. Ask an unrelated question.
5. Confirm the answer says it does not know instead of inventing facts.

### Phase 3: LINE

1. Configure the LINE webhook URL to `https://<svc-bot-domain>/api/line/webhook`.
2. Send a text message from a real LINE account.
3. Confirm the bot starts the loading animation.
4. Confirm the reply arrives within 10 seconds for a normal FAQ question.
5. Send an image or sticker and confirm the bot replies with `Text only for now.`

### Phase 4: Logs And Delete

1. Open `/logs`.
2. Confirm LINE and playground messages appear with model, latency, and chunk IDs.
3. Delete a document from `/documents`.
4. Confirm its chunks are removed from Postgres and vectors are removed from Pinecone.
