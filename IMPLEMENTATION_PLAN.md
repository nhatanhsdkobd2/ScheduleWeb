# Implementation Plan - ScheduleWeb Dashboard

Duoi day la ke hoach trien khai chi tiet dua tren PRD. Moi muc co checklist [ ] de theo doi tien do code va UAT.

## 0) Project Setup & Governance

- [x] Xac nhan tech stack bat buoc: Next.js + TypeScript (frontend), TypeScript backend, PostgreSQL.
- [ ] Chot pham vi MVP va freeze scope phase 1.
- [x] Chot nguyen tac free-only: khong dung thu vien/feature tra phi.
- [ ] Tao convention coding, branching, commit message, PR template.
- [ ] Tao Definition of Done cho FE/BE/QA.
- [ ] Tao environment matrix local-first (local, optional dev).
- [x] Bat strict typing: `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`.

## 1) Architecture & Foundation

### 1.1 Monorepo/Repo structure
- [x] Tao cau truc du an (frontend, backend, shared types).
- [ ] Cau hinh lint/format/type-check va pre-commit hook.
- [x] Tao package scripts cho build/test/dev.
- [x] Khoi tao frontend bang Next.js (TypeScript template).
- [x] Tao `shared/types` cho DTO, API contract, chart data model.

### 1.2 Core infrastructure
- [ ] Setup PostgreSQL connection + migration tool.
- [ ] Setup export worker local (in-process); optional Redis local neu can.
- [ ] Setup local folder storage cho report files (vd: `./exports`).
- [ ] Setup observability co ban (structured logs, request ID).

### 1.3 Security baseline
- [ ] Cai dat auth (JWT hoac session).
- [ ] Implement RBAC middleware.
- [ ] Implement API rate limiting co ban.
- [ ] Setup audit log pipeline (ghi va truy van).

## 2) Database & Data Modeling

### 2.1 Schema implementation
- [ ] Tao bang `members`.
- [ ] Tao bang `projects`.
- [ ] Tao bang `project_members`.
- [ ] Tao bang `tasks`.
- [ ] Tao bang `task_history`.
- [ ] Tao bang `reports`.
- [ ] Tao bang `performance_snapshots`.
- [ ] Tao bang `audit_logs`.
- [ ] Tao seed data default project names (37 projects theo danh sach trong CLAUDE.md section 8.0).
- [ ] Tao seed data default members (26 members theo danh sach trong CLAUDE.md section 8.0b).

### 2.2 Constraints & data quality
- [ ] Unique constraints (member_code, email, task_code, project_code).
- [ ] Foreign key constraints day du.
- [ ] Check constraints (allocation_percent, due_date logic, enum values).
- [ ] Soft-delete pattern (deleted_at) cho entities can lich su.

### 2.3 Index & performance
- [ ] Tao index cho task queries theo project/status/due_date.
- [ ] Tao index cho assignee/status/due_date.
- [ ] Tao partial index cho active tasks.
- [ ] Tao index cho performance snapshots.
- [ ] Tao index cho audit logs theo actor/time.

## 3) Backend API Delivery

### 3.1 Member APIs
- [x] `POST /members`.
- [x] `GET /members` (pagination, search, filter).
- [x] `PATCH /members/:id`.
- [x] `DELETE /members/:id` (soft delete).
- [ ] Unit test + integration test cho member APIs.

### 3.2 Project APIs
- [x] `POST /projects`.
- [x] `GET /projects`.
- [x] `PATCH /projects/:id`.
- [x] APIs gan/bo member vao project.
- [x] Test role-based access cho project actions.

### 3.3 Task APIs
- [x] `POST /tasks`.
- [x] `GET /tasks` (filter by date/member/project/status/priority).
- [x] `PATCH /tasks/:id` (status, assignment, due date).
- [x] Ghi `task_history` khi co field thay doi.
- [x] Rules validation (due_date, state transitions).
- [x] Test edge cases (reassign, cancel, complete).

### 3.4 Analytics APIs
- [x] `GET /analytics/dashboard`.
- [x] `GET /analytics/performance`.
- [x] `GET /analytics/delay-trend`.
- [x] API drill-down tu KPI/chart -> danh sach task.
- [ ] Benchmark query p95 va toi uu.

### 3.5 Report APIs
- [x] `POST /reports/weekly/export`.
- [x] `POST /reports/monthly/export`.
- [x] `GET /reports/:id/status`.
- [x] `GET /reports` (export history).
- [x] Idempotency key cho request export.

## 4) Performance Scoring Engine

### 4.1 Rule engine v1
- [x] Implement cong thuc `delay_days`.
- [x] Implement priority weight map.
- [x] Implement penalty components (delay/overdue/reopen).
- [x] Implement final score 0-100.
- [x] Implement band mapping A/B/C/D.

### 4.2 Period aggregation
- [ ] Job tinh diem theo thang.
- [ ] Job rollup quy.
- [ ] Job rollup nam.
- [ ] Save snapshot vao `performance_snapshots`.
- [ ] Validation script doi chieu random samples.

### 4.3 Configurability
- [ ] Admin config cho threshold/band.
- [ ] Admin config cho priority weights.
- [ ] Versioning rule set de audit score changes.

## 5) Frontend - Foundation & Shell

### 5.1 App shell
- [x] Setup Next.js App Router + layout (sidebar/topbar).
- [x] Setup auth guard va role guard.
- [x] Setup state management (query cache + UI store).
- [x] Setup API client + error interceptor.
- [x] Bat buoc type-safe data fetching (typed API client + typed response parser).

### 5.2 Design system
- [x] Chon/chot UI library (Ant Design hoac MUI).
- [x] Build reusable components (FilterBar, KPI Card, DataTable wrapper).
- [x] Theme tokens + dark/light readiness (optional).
- [x] Form validation UX pattern thong nhat.

## 6) Frontend - Business Modules

### 6.1 Member module
- [x] Member List page.
- [x] Add/Edit Member modal/form.
- [x] Soft delete + confirm dialog.
- [x] Search/filter/sort.
- [x] Role-based action rendering.
- [x] Xoa filter Project, Due from, Due to khoi tab Member (chi giu Search + Team + Member).
- [x] Xoa cot Code (memberCode) khoi Member table — chi con Name + Email + Team + Role + Actions.
- [x] Member create: auto-generate memberCode server-side (format `MEM-NNN`), bo khoi form nguoi dung nhap.

### 6.2 Project module
- [x] Project List page.
- [x] Project Detail page.
- [x] Assignment tab (project_members).
- [x] Progress summary block.
- [x] Validation cho assignment date ranges.
- [ ] Seed 37 default project names when project list is empty (auto-populate on first load / GET /projects).
- [ ] Seed 26 default members when member list is empty (auto-populate on first load / GET /members).
- [x] **BUG-FIX B-39**: Distribute 8 demo tasks across 8 different members (one per team): Hoàng Văn Nhật Anh, Lê Quang Duy, Lê Nguyễn Thục Nhi, Lê Văn Thiện, Lương Nguyễn Bảo Châu, Nguyễn Thanh Huy, Lê Bá Kha, Phan Văn Nguyên. Also seed project_members for all 8 assignees.
- [x] **BUG-FIX B-40**: Task Description column text truncated — add `style={{ whiteSpace: "normal", wordBreak: "break-word" }}` to TableCell in data-table.tsx so text wraps fully.
- [x] **BUG-FIX B-41**: React duplicate key error — `createId()` uses `Date.now() + Math.random()` which can collide on fast HMR/restart. Fix: add module-level `let _idCounter = 0;` and use `${prefix}-${Date.now()}-${_idCounter++}` to guarantee uniqueness.
- [x] **FEATURE F-01**: Tasks tab Export CSV — Thêm Button "Export CSV" bên cạnh "Add task" (tab Tasks). Export dựa trên `taskTableRows` (đã filter). Các cột: Project Name, Task Description, Assigned To, Start Day, Days, Complete, Priority, Progress. UTF-8 with BOM, escape dấu phẩy/double-quote trong CSV. Function `exportTasksToCSV(rows)` sử dụng Blob + URL.createObjectURL + programmatic click.
- [ ] Xoa cot Assignment khoi Project List table.
- [ ] Them chuc nang Create project (modal/form) trong Project List.
- [ ] Them chuc nang Delete project (soft delete) trong Project List.
- [ ] Fix bug: Delete project khong hoat dong — kiem tra API route, error handling, va mutation feedback.
- [ ] Xoa filter Project khoi FilterBar khi o tab Project (chi hien thi danh sach day du).
- [ ] Them chuc nang Edit project (re-use Create dialog, pre-fill data).
- [ ] Xoa Owner member field khoi Add/Edit project dialog (khong can truong owner nua).
- [ ] Fix bug: Category hien thi rong sau khi tao project moi — category phai luon co gia tri khi tao/sua.
- [ ] Fix bug: API client throw "Expecting value: line 1 column 1" khi backend chua chay — parse JSON robust, hien thi error message thay vi crash.
- [ ] Fix bug: MUI Select hien thi rong khi category la undefined/empty sau khi mo dialog edit hoac submit — them fallback vao list options.
- [x] Xoa cot Category khoi Project table (chi hien thi: Code, Name, Status, Actions).
- [x] Xoa cot Code (projectCode) khoi Project table — chi con Name + Actions.
- [x] Project create: auto-generate projectCode server-side (format `PROJ-NNN`), bo khoi form nguoi dung nhap.

### 6.3 Task module
- [x] Task List/Board page.
- [x] Task create/edit drawer.
- [x] Quick status update actions.
- [x] Assignment history timeline UI.
- [x] Overdue highlight states.
- [x] Fix filter desync bug: member filter phai cap nhat task list ngay lap tuc.
- [x] Thiet ke lai Task table voi inline editing: Project Name, Task Description, Assigned to, Start, Days, Complete, Priority — edit truc tiep ngay tren hang. Bo cot Project Type, Notes, Status.
- [x] Fix bug: Filter "all" (default) khong tra ve task nao — query phai truyen undefined khi filter = "all".
- [x] Default project = InnovaProSDK, default assignee = Hoang Van Nhat Anh cho task demo (seed) va task moi.
- [x] Fix Project dropdown filter khong hoat dong: thay `TextField select` bang `Select` component (voi `ListSubheader` cho categories) de ho tro grouped options trong menu.
- [x] Start Day column: doi ten tu "Start" -> "Start Day", cho phep inline edit, gia tri mac dinh = ngay hien tai (khong de trong). Khi plannedStartDate undefined, hien thi ngay hom nay thay vi placeholder.
- [x] Xoa cot History, them cot Progress % voi LinearProgress: nguoi dung nhap so 1-100, thanh xanh the hien %, tu dong done khi = 100, overdue khi chua 100% va due_date da qua.
- [x] Task Description column: su dung flexGrow de lay het khoang trong con lai, text hien thi day du khong bi cat.
- [x] Progress column: hien thi Typography so % ro rang (vd: "80%"), Tooltip chi ro trang thai ("On track" / "Overdue X days" / "Done"), input nho de nguoi dung nhap so.
- [x] Remove Status column khoi task table, filter bar, chart status distribution, va cac cho khac.
- [x] Auto-generate task code server-side (format `TSK-NNN`, max current + 1), bo khoi form tao task va schema validation.
- [x] Remove Status column khoi Project table va Member table (chi giu lai trong data model/backend logic, khong hien thi tren UI).
- [x] **BUG-FIX B-21**: Nut "Add task" mo drawer nhung drawer dong ngay sau khi tao thanh cong — `updateTaskMutation.onSuccess` goi `setTaskDrawerOpen(false)` khi `editTask=null`. Chi goi `setTaskDrawerOpen(false)` trong `updateTaskMutation.onSuccess` khi `editTask !== null`.
- [x] **BUG-FIX B-22**: Cot Progress % TextField khong nhan gia tri khi nhap so — doi `value={progress}` (number) thanh `value={String(progress)}`.
- [x] **BUG-FIX B-23**: Default project cho task moi = `RSPro Production` thay vi `InnovaProSDK` — doi lookup tu `projectCode === "INN-001"` thanh `name === "RSPro Production"`.
- [x] **BUG-FIX B-24/B-25**: Tat ca inline cell mutations (Start Day, Progress, Priority, Assignee, Complete date, Title, Project Name) khong luu gia tri moi — loai bo `setTaskDrawerOpen(false)` khoi `updateTaskMutation.onSuccess`, chi goi khi `editTask !== null`.
- [x] **BUG-FIX B-26**: Hydration mismatch error — `new Date()` trong component body (useState init, useMemo, column cell render) lam gia tri server/client khac nhau. Fix: them `mounted` state via `useEffect`, tat ca `new Date()` chi goi sau khi client mount.

### 6.4 Scheduler module
- [x] Integrate FullCalendar React.
- [x] Week/Month views.
- [x] Event click -> task detail.
- [ ] Drag/drop reschedule (neu bat).
- [x] Khong su dung resource timeline premium; thay bang filter member + week/month views.

## 7) Frontend - Dashboard & Analytics

### 7.1 KPI & filters
- [x] Date range filter (preset + custom).
- [x] Team/project/member/priority filters (khong co status).
- [x] KPI cards (active members/projects/open/overdue).
- [x] Loading/skeleton/empty states.
- [x] Dong bo state filter giua table va chart (single source of truth).
- [x] Empty-state khi filter khong co ket qua.
- [x] **Loai bo Task Schedule (Month View) FullCalendar khoi Dashboard** (B-27).
- [x] **Loai bo Weekly Report Snapshot khoi Dashboard** (B-28).
- [x] **Loai bo Filter Search/Team/Project khoi Dashboard** (B-29) — doi `(activeTab === 0 || activeTab === 3)` thanh `activeTab === 3`; Dashboard chi con KPI Cards + 3 Charts + Due from/Due to filter.
- [x] **Cap nhat Member Team Assignment** (B-30) — backend `seedDefaultMembers()` thay `team: "Platform"` bang `MEMBER_TEAMS` map: Mobile Team (6), OS Team (1), Tester Team (1), Tablet Team (4), Web Team (4), Passthrough Team (5), Server API Team (5).
- [x] **Fix FilterBar Team filter** (B-31) — thay MenuItem "Platform"/"Product" bang 7 teams that tu backend.
- [x] **Remove member Trần Lộc** (B-32) — xoa khoi `DEFAULT_MEMBER_NAMES` backend.
- [x] **Fix Add Member Team dropdown** (B-33) — doi `TextField` thanh `TextField select` voi 7 teams.
- [x] **Fix email format** (B-34) — `normalizeEmail()` thanh format `{lastName}.{initials}@vn.innova.com`, vd: anh.hoang@vn.innova.com.
- [x] **Fix Workload by Member chart dong bo date filter** (B-36) — `workloadByMember` useMemo apply filter (tasks count chi tinh task phu hop filter).
- [x] **Fix Team Filter khong hoat dong o Tasks tab** (B-37) — `filteredTasks` useMemo apply tat ca filters (selectedTeam, selectedProjectId, selectedMemberId, dateFrom, dateTo).
- [x] **Them Team Filter vao Dashboard** (B-38) — Dashboard filter section them Team dropdown (khong them cot nao moi).

### 7.2 Chart implementation
- [x] Chot chart library: Recharts (default) hoac Chart.js (neu can canvas optimization).
- [x] Task status distribution chart.
- [x] Delay trend chart month/quarter/year.
- [x] Workload by member/project chart.
- [x] Completion vs overdue comparison chart.
- [x] Performance band distribution chart.
- [x] Dinh nghia typed interfaces cho tung dataset chart.

### 7.3 Insight actions
- [x] Click chart segment -> drill-down table.
- [ ] Save filter preset (optional).
- [ ] Export current view data (optional).

## 8) Reporting & Export Pipeline

### 8.1 Weekly report
- [x] Build weekly dataset assembler service.
- [x] Tao template Excel weekly (ExcelJS).
- [x] Tao template PDF summary weekly (jsPDF).
- [x] Job queue + status tracking.
- [x] Download endpoint + permission check.

### 8.2 Monthly report
- [x] Build monthly dataset assembler service.
- [x] Tao template Excel monthly.
- [x] Tao template PDF executive summary monthly.
- [x] Include trend sections.
- [x] Include performance ranking section.

### 8.3 Export governance
- [x] File naming convention implementation.
- [x] Audit log cho export action.
- [x] Retention policy cleanup job.
- [x] Failure retry strategy + dead-letter handling.

## 9) Security, Audit, Compliance

- [x] RBAC matrix implementation day du theo module.
- [x] Audit all CUD actions + export actions.
- [x] Input validation/sanitization server-side.
- [x] Prevent sensitive data leakage trong logs.
- [x] Add CSRF/XSS/SQLi hardening checklist.
- [x] Security regression tests cho role boundaries.

## 10) Accessibility & UX Quality

- [ ] Keyboard navigation cho table/form/filter.
- [ ] Focus management cho modal/drawer.
- [ ] Contrast checks theo WCAG 2.2 AA.
- [x] Chart alt text + data table fallback.
- [x] Empty/error messages ro rang va actionable.

## 11) Testing Strategy

### 11.1 Backend tests
- [ ] Unit tests cho services scoring/reporting.
- [x] Integration tests cho APIs quan trong.
- [x] Contract tests cho error schema.

### 11.2 Frontend tests
- [ ] Component tests cho forms & tables.
- [ ] E2E flows:
- [ ] CRUD member.
- [ ] Create/assign/update task.
- [ ] Dashboard filter + drill-down.
- [ ] Weekly/monthly export end-to-end.
- [x] Regression test: chon member filter phai thay doi ket qua table/chart/KPI.

### 11.3 Performance tests
- [x] Load test API list/filter tasks.
- [x] Load test dashboard aggregate endpoints.
- [x] Benchmark export 10k rows.
- [ ] Tune indexes/query plans sau ket qua test.

## 12) Deployment & Release

### 12.1 DevOps pipeline
- [x] CI: lint + test + build.
- [x] CD staging auto deploy.
- [x] Production deploy manual approval gate.
- [x] DB migration strategy (zero/minimal downtime).

### 12.2 Environment readiness
- [x] Secrets management.
- [x] CORS/auth domain config.
- [x] Storage + queue endpoints config.
- [x] Monitoring dashboards + alert rules.

### 12.3 Go-live checklist
- [ ] UAT sign-off.
- [ ] Data migration/seed readiness.
- [ ] Rollback plan validated.
- [ ] On-call runbook published.

## 13) Milestones (Suggested)

### Milestone 1 - Foundation (Week 1-2)
- [ ] Hoan tat setup du an + auth + RBAC khung.
- [ ] Hoan tat schema + migrations + indexes co ban.

### Milestone 2 - Core CRUD (Week 3-4)
- [x] Member/Project/Task CRUD end-to-end.
- [x] Task history + audit logs.
- [ ] Seed 37 default project names theo CLAUDE.md section 8.0.
- [ ] Seed 26 default members theo CLAUDE.md section 8.0b.

### Milestone 3 - Scheduler + Dashboard v1 (Week 5-6)
- [x] Scheduler week/month hoat dong.
- [x] KPI + 3 chart cot loi.

### Milestone 4 - Scoring + Reports (Week 7-8)
- [x] Scoring engine monthly/quarterly/yearly.
- [x] Weekly/monthly export pipeline hoan chinh.

### Milestone 5 - Hardening + UAT + Go-live (Week 9-10)
- [ ] Performance tuning.
- [ ] Security/accessibility checklist pass.
- [ ] UAT fix va production release.

## 14) Post-MVP Backlog (Optional)

- [ ] Forecast delay risk theo machine learning.
- [ ] What-if capacity planning.
- [ ] Slack/Email notifications.
- [ ] Public share link cho executive report.
- [ ] Multi-tenant support.

## 15) Progress Tracking Rule

- [ ] Moi task chi co 1 owner chinh.
- [ ] Moi task can ETA va priority.
- [ ] Update trang thai checklist it nhat 2 lan/tuan.
- [ ] Bat ky blocker >24h phai tao issue escalation.
