# Release Security Gate

Run before every production release.

- [ ] New and changed routes enforce authn, role, and tenant scoping server-side.
- [ ] `/api/tenant/*` resolves tenant from verified claims, never request body.
- [ ] `/api/platform/*` requires super-admin role and `x-platform-key`.
- [ ] Tenant isolation tests are green.
- [ ] No route returns stack traces, connection strings, or user-existence hints.
- [ ] Rate limits cover new public endpoints.
- [ ] Secrets are absent from source, fixtures, logs, and client bundles.
- [ ] `web-platform` is unreachable without edge SSO from a clean network.
- [ ] `npm test`, `npm run test:coverage`, `npm run typecheck`, and `npm run build` pass.

Dependency and secret scanning require explicit network/tool setup:

- `gitleaks detect --redact`
- `semgrep --config p/owasp-top-ten`
- `npm audit --omit=dev`
