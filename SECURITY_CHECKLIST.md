# Security Hardening Checklist (Local)

- [x] RBAC gate for mutate endpoints via role middleware (`x-role`)
- [x] Input validation with Zod on write endpoints
- [x] Basic rate limiting for API (`express-rate-limit`)
- [x] Security headers via `helmet`
- [x] Redact sensitive keys in audit metadata (`password`, `token`, `secret`, `authorization`, `cookie`, `session`)
- [x] Sanitize URL navigation usage (only static internal routes in UI)
- [x] SQL injection risk reduced (no dynamic SQL used in current in-memory phase)
- [x] CSRF mitigation note: if moving to cookie auth later, enable CSRF token middleware
- [x] XSS mitigation note: avoid rendering unsafe HTML, keep React escaped rendering default

## Next steps before production

- [ ] Replace header-based role mock (`x-role`) with real auth + signed JWT/session
- [ ] Add CSRF token validation if cookie-based auth is enabled
- [ ] Add structured security test suite to CI
