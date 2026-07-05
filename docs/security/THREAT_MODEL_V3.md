# V3 Threat Model Delta

V3 keeps the V2 sales-bot model and adds a hard deployment split:

- `svc-bot`: tenant-aware API and LINE webhook runtime.
- `web-shop`: tenant console only.
- `web-platform`: platform-owner console only.

Primary new invariant: shop users must never receive platform-console code, routes, or credentials. Platform operations must require a super-admin context and a platform service key.

## Required Controls

- Platform console lives on a non-dictionary ops subdomain and is protected before the app by Vercel Deployment Protection or Cloudflare Access.
- `web-platform` requires Supabase super-admin auth with MFA.
- `web-shop` requires tenant-admin auth and resolves tenant from verified claims only.
- `/api/tenant/*` never accepts `tenantId` from request bodies as authority.
- `/api/platform/*` requires super-admin claims and `x-platform-key`.
- Platform actions append to `audit_logs`.
- No message bodies, credentials, or tokens are written to audit logs.

## Highest-Risk Failures

- Shop account can call platform routes.
- Tenant body or URL parameter overrides verified tenant claim.
- Platform code or service key ships in `web-shop`.
- LINE credentials, LLM keys, database URLs, or platform keys leak to logs/client bundles.
- Customer chat content is embedded or stored outside retention policy.
