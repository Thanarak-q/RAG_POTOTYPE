# PDPA Privacy Program

LINE user IDs and chat content are personal data. Shops are data controllers for their customers; this platform is the processor.

## Data Minimization

- Store LINE user ID, message records, consent records, deletion requests, and leads only when needed.
- Do not fetch LINE profile display names or pictures unless a feature explicitly requires it.
- Do not persist customer message embeddings or customer message text in Pinecone metadata.
- Do not log message bodies in Vercel logs or audit logs.

## Notice And Consent

- First contact sends a short privacy notice with a tenant privacy-policy URL.
- Continued use records consent in `consents` with `policy_version`.

## Retention

- Default chat retention: 90 days.
- Default lead retention: 365 days.
- Processed source files should expire after 30 days once products/chunks are extracted.

## Erasure

Customer text such as `delete my data` or a shop-owner action creates a `deletion_requests` row. The erasure job deletes that user's sessions, messages, leads, and consents, then marks the request completed.

## Subprocessors

Disclose LINE, Vercel, Supabase, Pinecone, Upstash, and the selected LLM provider in the tenant DPA. Prefer Singapore or Southeast Asia regions where available.
