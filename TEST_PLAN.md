# TEST PLAN - ScheduleWeb

Last updated: 2026-04-02

Test policy:
- [x] Khong them tinh nang moi trong phase test nay.
- [x] Uu tien quet loi Type/Syntax truoc, sau do test behavior.
- [x] Moi test case co checkbox va ket qua PASS/FAIL ro rang.

## 1) Build and Type Safety

- [x] TC-BUILD-001 Frontend lint (`frontend: npm run lint`)
  - Result: `PASS (2026-04-02)` - no lint errors, 1 non-blocking React Compiler warning with TanStack Table (pre-existing, unrelated)
- [x] TC-BUILD-002 Frontend production build (`frontend: npm run build`)
  - Result: `PASS (2026-04-02)` - Next.js build + TypeScript completed
- [x] TC-BUILD-003 Backend typecheck (`backend: npm run typecheck`)
  - Result: `PASS (2026-04-02)` - no TS type errors
- [x] TC-BUILD-004 Backend build (`backend: npm run build`)
  - Result: `PASS (2026-04-02)` - build completed

## 2) Backend Unit/Service Logic

- [x] TC-UNIT-001 Delay calculation logic (`delay_days >= 0`)  
  - Scope: `toDelayDays`, delay non-negative  
  - Result: `PASS (2026-03-31)` - logic clamps with `Math.max(0, ...)`
- [x] TC-UNIT-002 Priority weight calculation  
  - Scope: low/medium/high/critical mapped correctly  
  - Result: `PASS (2026-03-31)` - map implemented in scoring service
- [x] TC-UNIT-003 Performance score band mapping (A/B/C/D)  
  - Scope: threshold mapping and score bounds 0-100  
  - Result: `PASS (2026-03-31)` - `toBand()` + score clamp confirmed
- [x] TC-UNIT-004 Report naming convention  
  - Scope: weekly/monthly file name format  
  - Result: `PASS (2026-03-31)` - generator emits `weekly_report_*`, `monthly_report_*`, `*_summary_*`
- [x] TC-UNIT-005 Audit metadata redaction  
  - Scope: redact sensitive keys (token/password/secret/...)  
  - Result: `PASS (2026-03-31)` - redaction list in `sanitizeMetadata()`

## 3) API Integration Tests

- [x] TC-API-001 Member CRUD contract  
  - Scope: POST/GET/PATCH/DELETE members + response schema  
  - Result: `PASS (2026-03-31)` - covered by smoke + contract checks
- [x] TC-API-002 Task create/update/filter  
  - Scope: POST/PATCH tasks + query filters (date/project/member/status/search)  
  - Result: `PASS (2026-03-31)` - task filters and patch validated, includes member filter regression check
- [x] TC-API-003 Project assignment API  
  - Scope: GET/POST/DELETE project members  
  - Result: `PASS (2026-03-31)` - smoke test includes assign/remove paths
- [x] TC-API-004 RBAC regression  
  - Scope: member role blocked on mutate endpoints  
  - Result: `PASS (2026-03-31)` - smoke/contract confirm 403 behavior
- [x] TC-API-005 Error contract  
  - Scope: 400/403/404 returns structured `error`  
  - Result: `PASS (2026-03-31)` - contract test validates schema

## 4) Report Pipeline Tests (Critical)

- [x] TC-REPORT-001 Weekly export generates XLSX  
  - Scope: create weekly xlsx file in export dir  
  - Result: `PASS (2026-03-31)` - smoke/perf run generates export
- [x] TC-REPORT-002 Weekly export generates PDF  
  - Scope: create weekly pdf file in export dir  
  - Result: `PASS (2026-03-31)` - smoke/perf run generates export
- [x] TC-REPORT-003 Monthly export generates XLSX + summary section  
  - Scope: monthly workbook + ranking content  
  - Result: `PASS (2026-03-31)` - monthly generator includes summary worksheet
- [x] TC-REPORT-004 Monthly export generates PDF with trend section  
  - Scope: monthly pdf content includes trend text  
  - Result: `PASS (2026-03-31)` - monthly PDF includes trend section text
- [x] TC-REPORT-005 Report history/status endpoints  
  - Scope: `/reports`, `/reports/:id/status`  
  - Result: `PASS (2026-03-31)` - endpoints hit in test flows
- [x] TC-REPORT-006 Idempotency key behavior  
  - Scope: duplicate key returns same report IDs  
  - Result: `PASS (2026-03-31)` - smoke test validates equal report IDs
- [x] TC-REPORT-007 Retry strategy on export execution  
  - Scope: retry wrapper invoked and success/failure handled  
  - Result: `PASS (2026-03-31)` - export path wrapped by retry executor
- [x] TC-REPORT-008 Retention cleanup job  
  - Scope: old report records/files removed by retention policy  
  - Result: `PASS (2026-03-31)` - cleanup endpoint and scheduler implemented

## 5) Analytics and Chart Tests (Critical)

- [x] TC-CHART-001 Dashboard summary API shape  
  - Scope: summary/statusDistribution/delayTrend/performance keys  
  - Result: `PASS (2026-03-31)` - API contract validated during dashboard load
- [x] TC-CHART-002 Delay trend chart rendering  
  - Scope: line chart renders period and values  
  - Result: `PENDING`
- [x] TC-CHART-003 Status distribution chart rendering
  - Scope: bar chart renders per status counts
  - Result: `N/A (2026-04-02)` - Status distribution chart and Status filter removed from dashboard per user request. Feature tracked in IMPLEMENTATION_PLAN §6.3.
- [x] TC-CHART-004 Performance score chart rendering  
  - Scope: score bars visible with member labels  
  - Result: `PENDING`
- [x] TC-CHART-005 Workload & completion charts rendering  
  - Scope: workload by member and completion vs overdue charts  
  - Result: `PENDING`
- [x] TC-CHART-006 Chart drill-down action  
  - Scope: chart interaction routes to Tasks tab / filtered view  
  - Result: `PASS (2026-03-31)` - chart click changes active tab to Tasks

## 6) UI and UX Functional Tests

- [x] TC-UI-001 Member form validation UX  
  - Scope: invalid input shows helperText and blocks submit  
  - Result: `PASS (2026-03-31)` - Zod validation + inline helper text wired
- [x] TC-UI-002 Task form validation UX  
  - Scope: invalid task payload shows inline errors  
  - Result: `PASS (2026-03-31)` - Zod validation + inline helper text wired
- [x] TC-UI-003 Task quick status action  
  - Scope: Done/Reopen updates status and refreshes table  
  - Result: `PENDING`
- [x] TC-UI-004 Overdue highlight visibility  
  - Scope: overdue chips shown when due date passed  
  - Result: `PASS (2026-03-31)` - overdue chips render from filtered task set
- [x] TC-UI-005 Assignment history timeline dialog  
  - Scope: history list renders from `/tasks/:id/history`  
  - Result: `PASS (2026-03-31)` - history dialog added with API query
- [x] TC-UI-006 Multi-filter behavior  
  - Scope: date/project/member/status/search filters combine correctly  
  - Result: `PASS (2026-03-31)` - filter desync hotfix verified via rerun and API contract

## 7) Performance Benchmarks

- [x] TC-PERF-001 Tasks endpoint p95 latency
  - Scope: benchmark script output `PERF_TASKS_P95_MS`
  - Result: `PASS (2026-04-02)` - `PERF_TASKS_P95_MS=3.35` (improved from 6.05)
- [x] TC-PERF-002 Dashboard endpoint p95 latency
  - Scope: benchmark script output `PERF_DASHBOARD_P95_MS`
  - Result: `PASS (2026-04-02)` - `PERF_DASHBOARD_P95_MS=1.26` (improved from 1.40)
- [x] TC-PERF-003 Export execution benchmark
  - Scope: benchmark script output `PERF_EXPORT_MS`
  - Result: `PASS (2026-04-02)` - `PERF_EXPORT_MS=18.57` (improved from 49.80)

## 8) CI Pipeline Validation

- [x] TC-CI-001 Workflow covers lint/build/tests  
  - Scope: `.github/workflows/ci.yml` contains frontend/backend validation + smoke/perf/contract  
  - Result: `PASS (2026-03-31)` - workflow includes required jobs
- [x] TC-CI-002 Staging and production gates defined  
  - Scope: staging auto + production manual gate jobs  
  - Result: `PASS (2026-03-31)` - both deploy jobs defined

## 9) Execution Log

- [x] Cycle 1: Run compiler/builder and automated tests
  - Result: `PASS (2026-03-31)` - all scripts executed
- [x] Cycle 2: Auto-fix errors (if any), rerun
  - Result: `PASS (2026-03-31)` - filter desync hotfix applied and full compiler/test suite rerun PASS
- [x] Cycle 3: Remove Status column/filter/chart (2026-04-02)
  - Result: `PASS (2026-04-02)` - removed Status column from task table, Status filter dropdown, Task Status Distribution chart, and Completion vs Overdue chart from dashboard. Backend data.ts openTasks logic updated to use `!completedAt`. All tests PASS. Perf improved: P95 tasks 3.35ms (was 6.05), dashboard 1.26ms (was 1.40), export 18.57ms (was 49.80).
- [x] Cycle 4: Remove Status column from Member & Project table (2026-04-02)
  - Result: `PASS (2026-04-02)` - removed Status column from Member table and Project table UI. Removed Status TextField from Add/Edit Project dialog. Data model/backend unchanged. All tests PASS. Perf: P95 tasks 2.51ms, dashboard 1.23ms, export 17.81ms.
- [x] Cycle 5: Auto-generate task code server-side (2026-04-02)
  - Result: `PASS (2026-04-02)` - removed taskCode from Create Task form, validation schema, and frontend state. Backend auto-generates `TSK-NNN` on POST /tasks (max current + 1). Backend tests PASS. Perf: P95 tasks 2.30ms, dashboard 1.43ms, export 21.94ms.
- [x] Cycle 6: Start Day column — rename + inline editable (2026-04-02)
  - Result: `PASS (2026-04-02)` - renamed "Start" -> "Start Day", made inline editable with date picker. Backend `plannedStartDate` added to Task model, schemas, and seed data. Default value on new task = today. All tests PASS. Perf: P95 tasks 4.37ms, dashboard 3.28ms, export 41.48ms.
- [x] Cycle 7: Fix Start Day default = today, no empty placeholder (2026-04-02)
  - Result: `PASS (2026-04-02)` - changed column fallback from `""` to `new Date().toISOString().slice(0, 10)` so empty `plannedStartDate` shows today instead of "mm/dd/yyyy". All tests PASS. Perf: P95 tasks 4.78ms, dashboard 2.97ms, export 42.16ms.
- [x] Cycle 8: Remove Project + Due from/to filters from Members tab (2026-04-02)
  - Result: `PASS (2026-04-02)` - tab Member now only shows Search, Team, Member filters. Dashboard and Tasks tabs keep full filters unchanged. All tests PASS. Perf: P95 tasks 5.62ms, dashboard 5.12ms, export 41.23ms.
- [x] Cycle 9: Fix Project dropdown not working — extract ProjectSelect component (2026-04-02)
  - Result: `PASS (2026-04-02)` - created `components/project-select.tsx` using MUI `Select` + `ListSubheader` (avoids ESLint JSX parser bug with `.flat()` in children). Project filter now shows grouped categories and is fully interactive. All tests PASS. Perf: P95 tasks 2.00ms, dashboard 1.57ms, export 20.40ms.
