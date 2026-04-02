# Deployment and Environment Runbook

## 1) Environments

- Local: `frontend` on `:3000`, `backend` on `:4000`
- Staging: auto deploy from `main` (CI job `deploy-staging`)
- Production: manual approval job `deploy-production`

## 2) Secrets management

- Keep secrets out of git; use env variables from CI secret store.
- Required secrets/vars:
  - `DATABASE_URL`
  - `REDIS_URL`
  - `ALLOWED_ORIGIN`
  - `NEXT_PUBLIC_API_BASE_URL`

## 3) CORS and auth domain config

- Backend allows origin from `ALLOWED_ORIGIN`.
- Default local origin: `http://localhost:3000`.
- For staging/prod, set exact frontend domain and disallow wildcard origins.

## 4) Storage and queue endpoints

- Export files: local folder `backend/exports` (or mounted persistent volume).
- Queue endpoint:
  - Current: in-process retry.
  - Optional: Redis endpoint via `REDIS_URL`.

## 5) DB migration strategy

- Migration command: `npm run db:migrate` in `backend`.
- Run strategy:
  1. backup
  2. run migration
  3. smoke test endpoints
  4. rollback if smoke test fails

## 6) Monitoring and alert rules

- Health endpoint: `/health`
- Alerts:
  - backend health check failed
  - report export failed rate > 5%
  - p95 dashboard response > 2000ms
  - p95 task list response > 500ms

## 7) Release checklist

- [ ] `frontend`: `npm run lint && npm run build`
- [ ] `backend`: `npm run typecheck && npm run build`
- [ ] `backend`: `npm run test:contract && npm run test:smoke && npm run test:perf`
- [ ] `backend`: `npm run db:migrate`
- [ ] UAT sign-off
- [ ] rollback plan validated
- [ ] on-call owner confirmed

## 8) Rollback plan

- Roll back to previous application image.
- Restore previous environment config.
- If schema breaking change exists, restore DB backup.
- Re-run smoke tests after rollback.

## 9) On-call runbook

- Severity 1: service unavailable -> rollback immediately.
- Severity 2: export/report failures -> disable export endpoints, investigate queue/storage.
- Severity 3: analytics mismatch -> invalidate caches, verify source task data.
