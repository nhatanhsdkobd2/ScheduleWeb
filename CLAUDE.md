# Product Requirements Document (PRD)

## 1) Product Overview

### Product name
ScheduleWeb - Member Scheduling & Performance Dashboard

### Product vision
Xay dung mot web dashboard tap trung de quan ly member, task schedule, project assignment, va danh gia performance dua tren do tre (delay) mot cach minh bach, co the do luong, va de ra quyet dinh.

### Problem statement
Team quan ly hien tai thuong bi:
- Thieu mot nguon du lieu tap trung cho member/task/project.
- Khong theo doi duoc muc do cham tre theo thang/quy/nam.
- Bao cao weekly/monthly lam thu cong, ton thoi gian va de sai sot.
- Dashboard thieu tinh hanh dong (actionable insights), chi hien thi du lieu roi rac.

### Business goals
- Giam 60-80% thoi gian tong hop report hang tuan/thang.
- Tang kha nang theo doi tien do va canh bao task tre theo real-time.
- Chuan hoa danh gia performance dua tren metric delay minh bach.
- Ho tro quyet dinh phan bo nhan su/project bang thong ke truc quan.

### Success criteria (12 tuan sau go-live)
- 90% task moi duoc tao va theo doi tren he thong.
- 100% weekly/monthly report duoc export tu dong tu he thong.
- >80% PM/Lead su dung dashboard it nhat 3 lan/tuan.
- Giam it nhat 30% task overdue so voi baseline truoc khi dung he thong.

## 2) Personas & Users

### Primary personas
- PM/Project Owner: quan ly assignment, follow delay, review performance.
- Team Lead: theo doi workload, can bang task/member.
- Operations/Admin: quan ly member profile, role, project membership.

### Secondary persona
- Member/Contributor: xem task duoc giao, deadline, trang thai va feedback.

## 3) Product Scope

### In scope (MVP + Phase 1)
1. Member management (CRUD).
2. Task scheduling va project assignment.
3. Export weekly report va monthly report.
4. Performance scoring theo delay (monthly/quarterly/yearly).
5. Dashboard summary bang chart phan tich truc quan.

### Out of scope (hien tai)
- Time tracking theo phut/giay (timesheet chi tiet).
- Payroll/compensation automation.
- Native mobile app.
- AI forecasting phuc tap (se xet sau khi co data on dinh).

## 4) Research Synthesis (Internet Deep Research)

## 4.0 Mandatory Technology Constraint (Updated)
- Bat buoc su dung Typed Programming Language trong toan bo codebase.
- Frontend bat buoc: Next.js + TypeScript.
- Backend bat buoc: TypeScript (NestJS hoac Express + TypeScript).
- Thu vien chart bat buoc thuoc nhom typed-friendly: Recharts hoac Chart.js.

## 4.1 Dashboard & UX best practices
- Dashboard phai phuc vu quyet dinh, khong chi de "display data".
- Tach ro Operational dashboard (theo doi hang ngay) va Analytical dashboard (phan tich xu huong).
- Uu tien visual hierarchy: KPI quan trong dat o vung tren cung/trai.
- Han che KPI trong mot view de giam cognitive load.
- Moi chart tra loi 1 cau hoi ro rang.

Nguon tham khao:
- Nielsen Norman Group dashboard guidance: [NN/g Dashboards](https://www.nngroup.com/articles/dashboards-preattentive/)
- Atlassian task/workload dashboard practices: [Atlassian Task Dashboard](https://www.atlassian.com/agile/project-management/task-management-dashboard)

## 4.2 Data modeling & reporting best practices
- Mo hinh operational DB chuan hoa cho CRUD va transaction.
- Bo sung analytics layer voi summary table/materialized view theo ngay/tuan/thang.
- Tu duy dimensional model (fact + dimension) cho report dai han de query nhanh va on dinh.
- Dung indexing hop ly cho query filter theo assignee/status/due_date.

Nguon tham khao:
- PostgreSQL Indexes docs: [PostgreSQL Index Chapter](https://www.postgresql.org/docs/current/indexes.html)
- Kimball dimensional modeling references: [Kimball Group](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/books/data-warehouse-dw-lifecycle-toolkit/)

## 4.3 Scheduling, table, chart, export libraries

### Scheduling
- FullCalendar React adapter ho tro plugin-based va resource timeline.
- Uu tien chi cac view free (dayGrid/timeGrid/list) de dam bao 0 chi phi.

Nguon:
- [FullCalendar React Docs](https://fullcalendar.io/docs/react)

### Data grid
- TanStack Table: headless, linh hoat theme va architecture, MIT, phu hop local project.
- AG Grid Community: free MIT, co virtualized performance tot.
- Khuyen nghi free-first: bat dau voi TanStack Table + UI components, chi dung AG Grid Community neu can data-grid nang hon.

Nguon:
- [TanStack Table Introduction](https://tanstack.dev/table/latest/docs/introduction)

### Charts
- Recharts: React-native style API, de tich hop voi Next.js + TypeScript.
- Chart.js: canvas performance tot, ecosystem plugin lon, type support ro rang.
- Khuyen nghi: Recharts cho da so dashboard component; Chart.js cho chart can canvas performance/decimation.

Nguon:
- [Chart.js Docs](https://www.chartjs.org/docs/latest/)
- [Recharts](https://recharts.github.io/en-US/)

### Export report
- ExcelJS phu hop tao workbook co style/formula.
- jsPDF phu hop report PDF summary.
- Export du lieu lon nen xu ly server-side de tranh freeze UI.

Nguon:
- [ExcelJS npm](https://www.npmjs.com/package/exceljs)
- [jsPDF](https://parallax.github.io/jsPDF/)

## 4.4 Security & compliance best practices
- RBAC bat buoc cho thao tac admin.
- Audit log cho hanh dong nhay cam (create/update/delete, assignment change, export report).
- Khong log data nhay cam; sanitize log input.

Nguon:
- [OWASP Logging & Monitoring](https://owasp.org/www-project-proactive-controls/v3/en/c9-security-logging.html)
- [OWASP ASVS access control guidance](http://owasp-aasvs.readthedocs.io/en/latest/v4.html)

## 4.5 Accessibility best practices
- Dat muc tieu WCAG 2.2 AA.
- Chart can co text alternative va bang du lieu thay the.
- Ho tro keyboard navigation/focus states ro rang.

Nguon:
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## 5) Functional Requirements

## FR-1 Member Management
- Tao member voi thong tin co ban: code, full name, email, role, team, status.
- Chinh sua member profile.
- Soft delete member (khong xoa cung de giu lich su).
- Search/filter theo ten, role, team, status.
- Xem lich su assignment cua member.

Acceptance:
- CRUD thanh cong voi validation.
- Khong cho duplicate email/member_code.
- Soft-deleted member khong hien o danh sach active.

## FR-2 Project Management (co ban)
- Tao/sua project.
- Gan Team Lead/Owner cho project.
- Set start_date, end_date, status.
- Gan member vao project (many-to-many).
- **Xoa project** (soft delete).
- **Sua project** — chinh sua cac truong: name, description, status.
- **Tao project moi** voi cac truong: name, project_code, description, status.

Acceptance:
- Member assignment co hieu luc theo khoang thoi gian.
- Project table hien thi: Code, Name, Status, Actions (khong co cot Assignment, khong co cot Category, khong co cot Owner).
- Actions gom: Edit (mo dialog sua) va Delete (soft delete).
- **Bug fix**: Delete project khong hoat dong — mutation error khong duoc hien thi cho user. Can add error feedback khi delete that bai.
- **Filter khu vuc Project**: Khong co filter nao o tab Project — chi hien thi danh sach project day du.

## FR-3 Task Scheduling & Assignment
- Tao task voi title, description, priority, story_point(optional), due_date.
- Gan task vao project va assignee.
- Trang thai task: TODO, IN_PROGRESS, BLOCKED, DONE, CANCELED.
- Cho phep re-assign task, track lich su thay doi.
- Hien thi task tren calendar/scheduler theo week/month.
- Canh bao task sap tre/da tre.
- **Inline editing**: cac cot trong task table co the edit truc tiep ngay tren hang: Project Type, Project Name, Task Description, Assigned to, Start, Days, Complete, Priority, Notes, Status.

Acceptance:
- Task table hien thi cac cot: Project Type, Project Name, Task Description, Assigned to, Start, Days, Complete, Priority, Notes, Status.
- Cac cot co the edit truc tiep ngay tren hang (inline edit, khong can mo dialog Edit).
- Inline edit thay doi gia tri -> goi mutation API cap nhat ngay lap tuc.
- moi task bat buoc thuoc 1 project.
- due_date >= created_date.
- Mọi thay doi assignment/status duoc audit.

## FR-4 Weekly & Monthly Report Export
- Weekly report:
  - Tong task tao moi, task done, task overdue.
  - Breakdown theo member/project/status.
  - Top delay contributors.
- Monthly report:
  - KPI tong hop va xu huong theo tuan trong thang.
  - Performance rank theo member/team.
  - Delay analysis root categories (neu co labeling).
- Format export:
  - Excel (.xlsx) cho chi tiet.
  - PDF cho executive summary.

Acceptance:
- Export dung date range chon.
- File naming theo convention.
- Co audit log cho hanh dong export.

## FR-5 Performance Evaluation (Delay-based)
- Tinh delay cho tung task:
  - `delay_days = max(0, completed_at - due_date)` (don vi ngay).
- KPI member theo period (month/quarter/year):
  - On-time completion rate.
  - Average delay days.
  - Overdue ratio.
  - Weighted delay score theo priority.
- Performance band:
  - A/B/C/D theo threshold cau hinh.

De xuat cong thuc score (0-100):
- `score = 100 - min(100, weighted_delay_penalty + overdue_penalty + reopen_penalty)`
- weighted_delay_penalty dua tren tong `delay_days * priority_weight`.
- overdue_penalty dua tren ti le overdue task.
- reopen_penalty neu task bi reopen nhieu lan.

Acceptance:
- KQ tinh toan lap lai nhat quan cho cung du lieu.
- Co the drill-down tu score -> task chi tiet.

## FR-6 Dashboard Summary & Analytics
- KPI cards:
  - Active members, Active projects, Open tasks, Overdue tasks.
- Charts:
  - Task status distribution (bar/pie).
  - Delay trend theo thang/quy/nam (line).
  - Workload by member/project (stacked bar).
  - Completion vs overdue theo period (combo chart).
  - Performance distribution (histogram/bar).
- Interactive filters:
  - Date range, team, project, member, status, priority.

Acceptance:
- Filter thay doi thi chart/KPI cap nhat dong bo.
- Response query dashboard p95 < 2s voi du lieu muc tieu.
- Filter theo member phai thay doi ket qua task list va chart ngay lap tuc.
- Khong duoc xay ra filter desync (chon filter nhung data khong doi).

## 6) Non-Functional Requirements

### Performance
- p95 API response < 500ms cho CRUD.
- p95 dashboard aggregate query < 2s.
- Export 10k dong du lieu < 15s (server-side).

### Reliability
- Availability muc tieu: 99.5% (business hours).
- Retry policy cho report job.

### Security
- RBAC:
  - Admin: full.
  - PM/Lead: CRUD task/project trong scope.
  - Member: read own tasks, update own progress.
- JWT/session secure, CSRF protection (neu dung cookie auth).
- Audit log immutable cho thao tac nhay cam.

### Privacy
- Mask thong tin nhay cam khi export neu role khong du quyen.
- Data retention policy cho logs va reports.

### Accessibility
- WCAG 2.2 AA cho cac luong chinh.
- Keyboard navigation day du cho table/form/filter.
- Chart co alt text + table fallback.

### Observability
- Structured logs + request ID.
- Metrics: error rate, API latency, export duration.
- Alert cho error spike/export failure.

## 7) Information Architecture & Navigation

- Dashboard
  - Executive Overview
  - Delay Analytics
  - Performance Analytics
- Members
  - Member List
  - Member Detail
- Projects
  - Project List
  - Project Detail
- Tasks
  - Task Board/List
  - Scheduler Calendar
- Reports
  - Weekly
  - Monthly
  - Export History
- Admin
  - Users & Roles
  - System Settings (threshold, weights)

## 8) Data Model (Proposed)

### 8.0 Default Project Names (Seed Data)

Khi khoi tao he thong lan dau, cac project names sau se duoc tao san trong bang `projects`. **Khong co project "ScheduleWeb"** trong seed — chi co 37 projects thuc te ben duoi.

#### 1. SDK Development
- SDK Development

#### 2. Innova Products
- InnovaProSDK
- RS2 Module
- On-The-Go Module
- Services Module (DMM, Battery,...)
- Parser modules (Passthrough parser, OEM API,...)
- Universal DLL

#### 3. Production
- RSPro Production
- Innova Tablet Production
- Android Tablet Passthrough
- Hamaton App

#### 4. Intelligent Data Platform (IDP)
- IDP (Intelligent Data Platform)
- OS Customization
- Symptom Diagnostics AI
- Solution data (Q&A, FAQ, ...) AI
- Live Data Prediction AI
- IDP AI
- BA_EE_DMM AI

#### 5. Server API
- Limbus Server API
- RSPRO Server API
- Tablet Server API
- Extra API (FordSecurity, NewFix, Symptom, ...)

#### 6. Server Deployment
- Server Deployment

#### 7. Tool & Web Development
- Product management Dashboard
- Intranet (interagte FTP file, BOM, Jira, PIES)
- Vehicle Validation (interagte Jira)
- ATE Log Android Web (Factory and Analyze, auto Mail Report)
- ATELogAndroid
- SQLImporter / SQL Importer
- Simulation Software (Provide APIs & Database organization)
- CSR System
- Version Release Tracking
- Tool Builder (Built into Web SQL Importer)

#### 8. Internal Tools
- Tool Log Management & Analytics Platform (Customer)
- Testing and Validation
- TimeOff Manager
- Android ATE

**Notes:**
- Tat ca project deu co `status = "active"` khi seed.
- Moi project co `project_code` auto-gen theo quy tac: tiền tố theo loại + số thứ tự (vd: `SDK-001`, `INN-001`, `PRD-001`).
- Owner de mac dinh la `""` (empty string), co the gan sau trong Project Detail.
- Cac project names khong duoc phep trung nhau (unique constraint).

### 8.0b Default Member Names (Seed Data)

Khi khoi tao he thong lan dau, 26 members sau se duoc tao san trong bang `members`:

1. Châu Gia Kiên
2. Hoàng Văn Nhật Anh
3. Lê Bá Kha
4. Lê Bùi Hải Uyên
5. Lê Nguyễn Thục Nhi
6. Lê Quang Duy
7. Lê Văn Thiện
8. Lương Nguyễn Bảo Châu
9. Nguyễn Lê Tân Thành
10. Nguyễn Mạnh Hiếu
11. Nguyễn Minh Kha
12. Nguyễn Ngọc Bảo Kha
13. Nguyễn Nhật Hào
14. Nguyễn Phúc Bảo Phát
15. Nguyễn Phước Thọ
16. Nguyễn Quang Cảnh
17. Nguyễn Quang Trí
18. Nguyễn Thái Dương
19. Nguyễn Thanh Huy
20. Phạm Kim Chấn Nguyên
21. Phan Văn Nguyên
22. Trần Đình Anh Hùng
23. Trần Hữu Quang Trường
24. Trần Lộc
25. Trần Nguyễn Hoàng Diễn
26. Trương Việt Hưng

**Notes:**
- `member_code` auto-gen: `MB` + số thứ tự 3 chữ số (vd: `MB001`, `MB002`).
- `email` auto-gen: `fullName` lowercase, space → `.` + `@innova.com` (vd: `chau.gia.kien@innova.com`).
- `role` mac dinh: `member`; `team` mac dinh: `Platform`; `status` mac dinh: `active`.
- Khong co duplicate email hoac member_code (unique constraint).
- Chi lead/admin co the tao them member moi.

## 8.1 Core entities (Operational DB)

### `members`
- id (uuid, pk)
- member_code (varchar, unique, not null)
- full_name (varchar, not null)
- email (varchar, unique, not null)
- role_id (fk -> roles.id)
- team_id (fk -> teams.id)
- status (enum: active/inactive)
- joined_at (timestamp)
- deleted_at (timestamp, nullable)
- created_at, updated_at

### `projects`
- id (uuid, pk)
- project_code (varchar, unique)
- name (varchar, not null)
- owner_member_id (fk -> members.id)
- start_date, end_date
- status (enum: planning/active/on_hold/completed/canceled)
- created_at, updated_at

### `project_members`
- id (uuid, pk)
- project_id (fk)
- member_id (fk)
- assignment_role (enum: owner/lead/contributor)
- allocation_percent (int, 0-100)
- assigned_from, assigned_to
- created_at, updated_at

### `tasks`
- id (uuid, pk)
- task_code (varchar, unique)
- project_id (fk, not null)
- assignee_member_id (fk, nullable)
- title (varchar, not null)
- description (text)
- priority (enum: low/medium/high/critical)
- status (enum: todo/in_progress/blocked/done/canceled)
- planned_start_date (date)
- due_date (date, not null)
- completed_at (timestamp, nullable)
- estimate_hours (numeric, nullable)
- actual_hours (numeric, nullable)
- parent_task_id (fk self, nullable)
- created_by, updated_by (fk -> members.id)
- created_at, updated_at, deleted_at

### Filter Consistency Rules (Hotfix)
- Dashboard filters phai dung cung mot state nguon (single source of truth) cho KPI, chart va table.
- Khi doi filter `member`, ket qua member/task/chart/KPI phai cap nhat ngay trong cung luong tuong tac.
- Query filter `project/member/status/date/search` phai ket hop theo AND (khong ghi de nhau).
- UI khong duoc giu stale results sau mutate; bat buoc invalidate query cache dung key.
- Neu ket qua filter rong thi hien empty-state thay vi hien data cu.

### `task_history`
- id (uuid, pk)
- task_id (fk)
- field_name (varchar)
- old_value (text)
- new_value (text)
- changed_by (fk -> members.id)
- changed_at (timestamp)

### `reports`
- id (uuid, pk)
- report_type (enum: weekly/monthly)
- period_start, period_end
- generated_by (fk -> members.id)
- file_url (varchar)
- file_format (enum: xlsx/pdf)
- status (enum: queued/running/success/failed)
- created_at, completed_at

### `performance_snapshots`
- id (uuid, pk)
- member_id (fk)
- period_type (enum: month/quarter/year)
- period_key (varchar, vd: 2026-03, 2026-Q1, 2026)
- completed_tasks (int)
- overdue_tasks (int)
- avg_delay_days (numeric)
- weighted_delay_score (numeric)
- performance_score (numeric)
- performance_band (enum: A/B/C/D)
- generated_at

### `audit_logs`
- id (uuid, pk)
- actor_member_id (fk)
- action (varchar)
- entity_type (varchar)
- entity_id (uuid/text)
- metadata (jsonb)
- ip_address (varchar)
- created_at

## 8.2 Recommended indexes
- `tasks(project_id, status, due_date)`
- `tasks(assignee_member_id, status, due_date)`
- Partial index for active tasks:
  - `where deleted_at is null and status in ('todo','in_progress','blocked')`
- `performance_snapshots(member_id, period_type, period_key)`
- `audit_logs(actor_member_id, created_at)`

## 8.3 Analytics layer (for dashboard speed)
- Materialized view / summary table:
  - task_daily_stats
  - member_monthly_performance
  - project_weekly_velocity
- Refresh strategy:
  - Incremental nightly + on-demand for selected ranges.

## 9) API Requirements (High-level)

- `POST /members`, `GET /members`, `PATCH /members/:id`, `DELETE /members/:id`
- `POST /projects`, `GET /projects`, `PATCH /projects/:id`
- `POST /tasks`, `GET /tasks`, `PATCH /tasks/:id`
- `POST /reports/weekly/export`, `POST /reports/monthly/export`
- `GET /analytics/dashboard`
- `GET /analytics/performance?periodType=month&periodKey=2026-03`
- `GET /audit-logs`

Standards:
- Pagination/Sorting/Filtering chuan hoa.
- Error schema thong nhat.
- Idempotency key cho export endpoint.

## 10) UI/Tech Stack Recommendation

## Frontend
- Framework bat buoc: Next.js + TypeScript.
- UI library:
  - Option A (khuyen nghi): MUI (open-source, de dung, ecosystem lon).
  - Option B: Ant Design (free ban core, manh cho admin screens).
- Data grid:
  - TanStack Table (khuyen nghi) + virtualized list neu can.
  - Hoac AG Grid Community (free) neu can nhieu tinh nang grid san co.
- Scheduler:
  - FullCalendar.
  - Chi su dung cac view free, tranh plugin premium.
- Charts:
  - Recharts (khuyen nghi mac dinh) cho dashboard React component-driven.
  - Chart.js (phuong an bo sung) cho truong hop can canvas optimization.
- Export:
  - Trigger backend job, frontend nhan status + download link.

## Backend
- Node.js TypeScript (NestJS hoac Express + TypeScript) + PostgreSQL.
- Queue cho export/report:
  - Ban don gian local: chay async trong process + bang `reports`.
  - Ban nang cao free: BullMQ + Redis local container.
- Luu report files local filesystem (vd: `./exports`) thay vi cloud object storage.

## 11) Reporting Specification

### Weekly report fields
- Time range, generated_at, generated_by.
- KPI tong: created/done/overdue/open.
- Member table: assigned, done, overdue, avg_delay, score.
- Project table: progress, overdue, risk_level.
- Highlight: top 5 delayed tasks.

### Monthly report fields
- Toan bo weekly + trend chart by week.
- Team-level summary.
- Performance band distribution (A/B/C/D).
- Action recommendations section.

### File naming convention
- `weekly_report_YYYY_MM_DD_to_YYYY_MM_DD.xlsx`
- `monthly_report_YYYY_MM.pdf`

## 12) Performance Evaluation Rules (Version 1)

### Priority weight
- Low = 1.0
- Medium = 1.5
- High = 2.0
- Critical = 3.0

### Delay severity
- 0 ngay: on-time
- 1-2 ngay: minor
- 3-5 ngay: moderate
- >5 ngay: severe

### Score thresholds (configurable)
- A: >= 85
- B: 70-84
- C: 50-69
- D: < 50

### Edge cases
- Task canceled: khong tinh vao denominator completion.
- Task khong co due_date: khong dua vao delay scoring (bat buoc khac phuc data quality).
- Reassigned task: delay tinh theo owner hien tai + attribution rule (configurable v2).

## 13) Risks, Dependencies, and Mitigations

### Risks
- Data quality (thieu due_date/status inconsistency).
- Scope creep (them qua nhieu chart ngay tu dau).
- Feature gap khi chi dung stack free.
- Export performance voi du lieu lon.

### Mitigations
- Bat buoc validation data.
- Chot MVP chart set nho truoc.
- Uu tien requirement co the dap ung bang open-source/free.
- Chuyen export sang async background jobs.

## 14) Rollout Strategy

- Phase 0: Foundation (schema, auth, CRUD co ban).
- Phase 1: Task scheduling + assignment.
- Phase 2: Analytics + performance scoring.
- Phase 3: Export reports + hardening.
- Phase 4: UAT + go-live + observe.

## 15) Acceptance Criteria (Product-level)

- Tat ca luong CRUD member/project/task hoat dong voi RBAC.
- Dashboard hien KPI/charts dung theo filter date/team/project/member.
- Weekly/monthly export tao file dung format va dung so lieu.
- Performance score tinh duoc cho month/quarter/year va drill-down den task.
- Co audit log cho CRUD nhay cam va export.
- Dat yeu cau p95 da neu trong NFR.

## 16) Open Questions

1. Co can tich hop SSO (Google/Microsoft) ngay phase dau khong?
2. Rule attribution delay khi task reassign co tinh theo nguoi tao hay nguoi dang so huu task?
3. Performance score co duoc dung cho HR evaluation chinh thuc hay chi noi bo PM?
4. Muc do chi tiet report PDF can bao gom chart embeddable den dau?
5. Muc tieu quy mo data sau 6-12 thang (so task/member/project) de chot strategy index/partition?

## 17) Final Recommendation Summary

- Product direction: operational + analytical dashboard ket hop, tap trung tinh hanh dong.
- Stack recommendation:
  - Next.js + TypeScript + MUI (hoac AntD core)
  - TanStack Table (hoac AG Grid Community free)
  - FullCalendar (chi dung free views)
  - Recharts (mac dinh) hoac Chart.js cho analytics
  - Backend async export voi ExcelJS + jsPDF
  - PostgreSQL + summary layer cho dashboard performance
  - Luu file export tren local disk
- Governance recommendation:
  - RBAC + audit logs + WCAG 2.2 AA cho luong chinh.
  - Metric va score threshold phai configurable tu Admin settings.
