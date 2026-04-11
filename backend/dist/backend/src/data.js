import { existsSync, readFileSync } from "node:fs";
import { getPool, isPersistenceEnabled } from "./db/index.js";
import { insertTaskIntoDb, listTasksFromDb, persistTasksFromMemory, selectAllTasksForAnalyticsFromDb, selectTaskByIdFromDb, updateTaskInDb, } from "./db/task-store.js";
import { hydrateMembersFromDb, hydrateProjectsFromDb, insertMemberReturning, insertProjectReturning, listMembersFromDb, listProjectsFromDb, patchMemberInDb, patchProjectInDb, persistAllMembersProjects, selectMemberByIdFromDb, selectProjectByIdFromDb, } from "./db/member-project-store.js";
export const members = [];
export const projects = [];
// ── Default member seed data ───────────────────────────────────────────────
const MEMBER_TEAMS = {
    // Mobile Team
    "Châu Gia Kiên": "Mobile Team",
    "Hoàng Văn Nhật Anh": "Mobile Team",
    "Trần Nguyễn Hoàng Diễn": "Mobile Team",
    "Nguyễn Phước Thọ": "Mobile Team",
    "Nguyễn Quang Cảnh": "Mobile Team",
    "Trương Việt Hưng": "Mobile Team",
    // OS Team
    "Lê Quang Duy": "OS Team",
    // Tester Team
    "Lê Nguyễn Thục Nhi": "Tester Team",
    // Tablet Team
    "Lê Văn Thiện": "Tablet Team",
    "Nguyễn Mạnh Hiếu": "Tablet Team",
    "Nguyễn Quang Trí": "Tablet Team",
    "Phạm Kim Chấn Nguyên": "Tablet Team",
    // Web Team
    "Lương Nguyễn Bảo Châu": "Web Team",
    "Nguyễn Minh Kha": "Web Team",
    "Nguyễn Ngọc Bảo Kha": "Web Team",
    "Nguyễn Nhật Hào": "Web Team",
    // Passthrough Team
    "Nguyễn Thanh Huy": "Passthrough Team",
    "Lê Bùi Hải Uyên": "Passthrough Team",
    "Trần Hữu Quang Trường": "Passthrough Team",
    "Nguyễn Lê Tân Thành": "Passthrough Team",
    "Nguyễn Thái Dương": "Passthrough Team",
    // Server API Team (remaining members)
    "Lê Bá Kha": "Server API Team",
    "Nguyễn Phúc Bảo Phát": "Server API Team",
    "Phan Văn Nguyên": "Server API Team",
    "Trần Đình Anh Hùng": "Server API Team",
};
const DEFAULT_MEMBER_NAMES = [
    "Châu Gia Kiên",
    "Hoàng Văn Nhật Anh",
    "Lê Bá Kha",
    "Lê Bùi Hải Uyên",
    "Lê Nguyễn Thục Nhi",
    "Lê Quang Duy",
    "Lê Văn Thiện",
    "Lương Nguyễn Bảo Châu",
    "Nguyễn Lê Tân Thành",
    "Nguyễn Mạnh Hiếu",
    "Nguyễn Minh Kha",
    "Nguyễn Ngọc Bảo Kha",
    "Nguyễn Nhật Hào",
    "Nguyễn Phúc Bảo Phát",
    "Nguyễn Phước Thọ",
    "Nguyễn Quang Cảnh",
    "Nguyễn Quang Trí",
    "Nguyễn Thái Dương",
    "Nguyễn Thanh Huy",
    "Phạm Kim Chấn Nguyên",
    "Phan Văn Nguyên",
    "Trần Đình Anh Hùng",
    "Trần Hữu Quang Trường",
    "Trần Nguyễn Hoàng Diễn",
    "Trương Việt Hưng",
];
function stripDiacritics(str) {
    return str
        .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/gi, "a")
        .replace(/[èéẹẻẽêềếệểễ]/gi, "e")
        .replace(/[ìíịỉĩ]/gi, "i")
        .replace(/[òóọỏõôồốộổỗưỡơờớợởỡ]/gi, "o")
        .replace(/[ùúụủũưừứựửữ]/gi, "u")
        .replace(/[ỳýỵỷỹ]/gi, "y")
        .replace(/đ/gi, "d")
        .replace(/Đ/gi, "D");
}
function normalizeEmail(fullName) {
    // Format: {lastName}.{firstName}@vn.innova.com
    // e.g. "Hoàng Văn Nhật Anh" -> "anh.hoang@vn.innova.com"
    const parts = fullName.trim().split(/\s+/);
    if (parts.length < 2) {
        return stripDiacritics(fullName).toLowerCase().replace(/\s+/g, "") + "@vn.innova.com";
    }
    const lastName = stripDiacritics(parts[parts.length - 1] ?? "").toLowerCase();
    const firstName = stripDiacritics(parts[0] ?? "").toLowerCase();
    return `${lastName}.${firstName}@vn.innova.com`;
}
// ── Default project seed data ──────────────────────────────────────────────
const DEFAULT_PROJECTS = [
    // 1. SDK Development
    { projectCode: "SDK-001", name: "SDK Development", ownerMemberId: "", status: "active", description: "Core SDK development for all product lines", category: "SDK Development" },
    // 2. Innova Products
    { projectCode: "INN-001", name: "InnovaProSDK", ownerMemberId: "", status: "active", description: "InnovaPro Software Development Kit", category: "Innova Products" },
    { projectCode: "INN-002", name: "RS2 Module", ownerMemberId: "", status: "active", description: "RS2 hardware integration module", category: "Innova Products" },
    { projectCode: "INN-003", name: "On-The-Go Module", ownerMemberId: "", status: "active", description: "On-The-Go module development", category: "Innova Products" },
    { projectCode: "INN-004", name: "Services Module (DMM, Battery,...)", ownerMemberId: "", status: "active", description: "Services module covering DMM and Battery services", category: "Innova Products" },
    { projectCode: "INN-005", name: "Parser modules (Passthrough parser, OEM API,...)", ownerMemberId: "", status: "active", description: "Parser modules: Passthrough parser and OEM API", category: "Innova Products" },
    { projectCode: "INN-006", name: "Universal DLL", ownerMemberId: "", status: "active", description: "Universal DLL for cross-platform support", category: "Innova Products" },
    // 3. Production
    { projectCode: "PRD-001", name: "RSPro Production", ownerMemberId: "", status: "active", description: "RSPro hardware production line", category: "Production" },
    { projectCode: "PRD-002", name: "Innova Tablet Production", ownerMemberId: "", status: "active", description: "Innova Tablet manufacturing and QA", category: "Production" },
    { projectCode: "PRD-003", name: "Android Tablet Passthrough", ownerMemberId: "", status: "active", description: "Android tablet passthrough functionality", category: "Production" },
    { projectCode: "PRD-004", name: "Hamaton App", ownerMemberId: "", status: "active", description: "Hamaton mobile application", category: "Production" },
    // 4. Intelligent Data Platform (IDP)
    { projectCode: "IDP-001", name: "IDP (Intelligent Data Platform)", ownerMemberId: "", status: "active", description: "Core Intelligent Data Platform", category: "Intelligent Data Platform" },
    { projectCode: "IDP-002", name: "OS Customization", ownerMemberId: "", status: "active", description: "OS customization layer for IDP", category: "Intelligent Data Platform" },
    { projectCode: "IDP-003", name: "Symptom Diagnostics AI", ownerMemberId: "", status: "active", description: "AI-powered symptom diagnostics engine", category: "Intelligent Data Platform" },
    { projectCode: "IDP-004", name: "Solution data (Q&A, FAQ, ...) AI", ownerMemberId: "", status: "active", description: "AI models for Q&A and FAQ resolution", category: "Intelligent Data Platform" },
    { projectCode: "IDP-005", name: "Live Data Prediction AI", ownerMemberId: "", status: "active", description: "Real-time data prediction AI module", category: "Intelligent Data Platform" },
    { projectCode: "IDP-006", name: "IDP AI", ownerMemberId: "", status: "active", description: "Core AI engine for IDP", category: "Intelligent Data Platform" },
    { projectCode: "IDP-007", name: "BA_EE_DMM AI", ownerMemberId: "", status: "active", description: "BA_EE_DMM AI integration module", category: "Intelligent Data Platform" },
    // 5. Server API
    { projectCode: "API-001", name: "Limbus Server API", ownerMemberId: "", status: "active", description: "Limbus backend server API", category: "Server API" },
    { projectCode: "API-002", name: "RSPRO Server API", ownerMemberId: "", status: "active", description: "RSPRO hardware server API", category: "Server API" },
    { projectCode: "API-003", name: "Tablet Server API", ownerMemberId: "", status: "active", description: "Tablet backend server API", category: "Server API" },
    { projectCode: "API-004", name: "Extra API (FordSecurity, NewFix, Symptom, ...)", ownerMemberId: "", status: "active", description: "Extra APIs: FordSecurity, NewFix, Symptom, and others", category: "Server API" },
    // 6. Server Deployment
    { projectCode: "SVD-001", name: "Server Deployment", ownerMemberId: "", status: "active", description: "Server deployment and infrastructure management", category: "Server Deployment" },
    // 7. Tool & Web Development
    { projectCode: "TWD-001", name: "Product management Dashboard", ownerMemberId: "", status: "active", description: "Product management web dashboard", category: "Tool & Web Development" },
    { projectCode: "TWD-002", name: "Intranet (interagte FTP file, BOM, Jira, PIES)", ownerMemberId: "", status: "active", description: "Intranet portal integrating FTP, BOM, Jira, and PIES", category: "Tool & Web Development" },
    { projectCode: "TWD-003", name: "Vehicle Validation (interagte Jira)", ownerMemberId: "", status: "active", description: "Vehicle validation system integrated with Jira", category: "Tool & Web Development" },
    { projectCode: "TWD-004", name: "ATE Log Android Web (Factory and Analyze, auto Mail Report)", ownerMemberId: "", status: "active", description: "ATE Log web application with factory analyze and auto mail report", category: "Tool & Web Development" },
    { projectCode: "TWD-005", name: "ATELogAndroid", ownerMemberId: "", status: "active", description: "ATE Log Android application", category: "Tool & Web Development" },
    { projectCode: "TWD-006", name: "SQLImporter / SQL Importer", ownerMemberId: "", status: "active", description: "SQL data importer tool", category: "Tool & Web Development" },
    { projectCode: "TWD-007", name: "Simulation Software (Provide APIs & Database organization)", ownerMemberId: "", status: "active", description: "Simulation software with APIs and database management", category: "Tool & Web Development" },
    { projectCode: "TWD-008", name: "CSR System", ownerMemberId: "", status: "active", description: "Customer Service Request system", category: "Tool & Web Development" },
    { projectCode: "TWD-009", name: "Version Release Tracking", ownerMemberId: "", status: "active", description: "Software version release tracking system", category: "Tool & Web Development" },
    { projectCode: "TWD-010", name: "Tool Builder (Built into Web SQL Importer)", ownerMemberId: "", status: "active", description: "Internal tool builder integrated with Web SQL Importer", category: "Tool & Web Development" },
    // 8. Internal Tools
    { projectCode: "INT-001", name: "Tool Log Management & Analytics Platform (Customer)", ownerMemberId: "", status: "active", description: "Tool log management and analytics platform for customers", category: "Internal Tools" },
    { projectCode: "INT-002", name: "Testing and Validation", ownerMemberId: "", status: "active", description: "Testing and validation workflow management", category: "Internal Tools" },
    { projectCode: "INT-003", name: "TimeOff Manager", ownerMemberId: "", status: "active", description: "Employee time-off request and management system", category: "Internal Tools" },
    { projectCode: "INT-004", name: "Android ATE", ownerMemberId: "", status: "active", description: "Android Automated Test Equipment system", category: "Internal Tools" },
];
const DEMO_TASKS = [
    { taskCode: "TSK-001", title: "Kickoff meeting & team alignment", dueDate: "2026-04-07", status: "done", priority: "high", completedAt: "2026-04-06", plannedStartDate: "2026-04-06" },
    { taskCode: "TSK-002", title: "Initial architecture design", dueDate: "2026-04-15", status: "in_progress", priority: "high", plannedStartDate: "2026-04-08" },
    { taskCode: "TSK-003", title: "Backend API scaffolding", dueDate: "2026-04-20", status: "todo", priority: "medium", plannedStartDate: "2026-04-13" },
    { taskCode: "TSK-004", title: "Frontend dashboard setup", dueDate: "2026-04-25", status: "todo", priority: "medium", plannedStartDate: "2026-04-18" },
    { taskCode: "TSK-005", title: "Database schema design", dueDate: "2026-04-12", status: "done", priority: "critical", completedAt: "2026-04-11", plannedStartDate: "2026-04-11" },
    { taskCode: "TSK-006", title: "CI/CD pipeline configuration", dueDate: "2026-04-30", status: "blocked", priority: "medium", plannedStartDate: "2026-04-23" },
    { taskCode: "TSK-007", title: "Performance benchmark baseline", dueDate: "2026-05-05", status: "todo", priority: "low", plannedStartDate: "2026-04-28" },
    { taskCode: "TSK-008", title: "UAT preparation & documentation", dueDate: "2026-05-10", status: "todo", priority: "medium", plannedStartDate: "2026-05-03" },
];
const TASK_SEED_CSV_PATHS = [
    process.env.SCHEDULEWEB_TASK_SEED_CSV_PATH,
    "C:/Users/pc/Desktop/R&D Software Planning - 2026 - ThuanNgo Team(April2026).csv",
].filter(Boolean);
const DEFAULT_SEED_TASK_LIMIT = 30;
function enforceSeedTaskLimit() {
    if (tasks.length <= DEFAULT_SEED_TASK_LIMIT)
        return;
    tasks.splice(DEFAULT_SEED_TASK_LIMIT);
}
function parseCsvLine(line) {
    const out = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        const next = i + 1 < line.length ? line[i + 1] : "";
        if (ch === "\"") {
            if (inQuotes && next === "\"") {
                current += "\"";
                i += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === "," && !inQuotes) {
            out.push(current);
            current = "";
            continue;
        }
        current += ch;
    }
    out.push(current);
    return out.map((v) => v.trim());
}
function parseSeedProgress(value) {
    const n = Number.parseInt(value.replace("%", "").trim(), 10);
    if (Number.isNaN(n))
        return 0;
    return Math.max(0, Math.min(100, n));
}
function parseSeedDate(value) {
    const raw = value.trim();
    if (!raw)
        return undefined;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()))
        return undefined;
    return d.toISOString().slice(0, 10);
}
function normalizePersonKey(value) {
    return stripDiacritics(value)
        .toLowerCase()
        .replace(/[^a-z\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function resolveAssigneeId(name) {
    const normalized = normalizePersonKey(name);
    if (!normalized)
        return undefined;
    const exact = members.find((m) => normalizePersonKey(m.fullName) === normalized);
    if (exact)
        return exact.id;
    const targetTokens = new Set(normalized.split(" ").filter(Boolean));
    const targetArr = [...targetTokens];
    const targetFirst = targetArr[0] ?? "";
    const targetLast = targetArr[targetArr.length - 1] ?? "";
    let bestId;
    let bestScore = 0;
    for (const member of members) {
        const memberTokens = normalizePersonKey(member.fullName).split(" ").filter(Boolean);
        if (memberTokens.length === 0)
            continue;
        let overlap = 0;
        for (const token of memberTokens) {
            if (targetTokens.has(token))
                overlap += 1;
        }
        const memberFirst = memberTokens[0] ?? "";
        const memberLast = memberTokens[memberTokens.length - 1] ?? "";
        const edgeBonus = (memberFirst === targetFirst ? 0.15 : 0) + (memberLast === targetLast ? 0.2 : 0);
        const score = overlap / Math.max(memberTokens.length, targetTokens.size || 1) + edgeBonus;
        if (score > bestScore) {
            bestScore = score;
            bestId = member.id;
        }
    }
    return bestScore >= 0.25 ? bestId : undefined;
}
function resolveProjectIdByName(projectName, defaultProjectId) {
    const cleaned = projectName.trim();
    if (!cleaned)
        return defaultProjectId;
    const exact = projects.find((p) => p.name.toLowerCase() === cleaned.toLowerCase());
    if (exact)
        return exact.id;
    const includes = projects.find((p) => p.name.toLowerCase().includes(cleaned.toLowerCase()));
    if (includes)
        return includes.id;
    return defaultProjectId;
}
function loadCsvSeedRows() {
    for (const p of TASK_SEED_CSV_PATHS) {
        if (!existsSync(p))
            continue;
        try {
            const raw = readFileSync(p, "utf8");
            const lines = raw.split(/\r?\n/).map((l) => l.trimEnd());
            const dataLines = lines.slice(3).filter((line) => line.trim() !== "" && !line.startsWith(",,,"));
            const rows = [];
            for (const line of dataLines) {
                const cols = parseCsvLine(line);
                if (cols.length < 9)
                    continue;
                const title = cols[2] ?? "";
                const assigneeName = cols[3] ?? "";
                const start = cols[5] ?? "";
                const complete = cols[7] ?? "";
                if (!title.trim() || !assigneeName.trim() || !start.trim() || !complete.trim())
                    continue;
                rows.push({
                    projectName: cols[1] ?? "",
                    title: title.trim(),
                    assigneeName: assigneeName.trim(),
                    progress: parseSeedProgress(cols[4] ?? "0%"),
                    start: start.trim(),
                    complete: complete.trim(),
                    priority: (cols[8] ?? "Normal").trim(),
                });
            }
            if (rows.length > 0)
                return rows;
        }
        catch {
            // try next path
        }
    }
    return [];
}
// ── Auto-seed: run once per server lifecycle ───────────────────────────────
let membersSeeded = false;
let projectsSeeded = false;
function seedDefaultMembers() {
    if (membersSeeded)
        return;
    const existingEmails = new Set(members.map((m) => m.email));
    DEFAULT_MEMBER_NAMES.forEach((fullName, index) => {
        const memberCode = `MB${String(index + 1).padStart(3, "0")}`;
        const email = normalizeEmail(fullName);
        if (!existingEmails.has(email)) {
            members.push({
                id: createId("m"),
                memberCode,
                fullName,
                email,
                role: "member",
                team: MEMBER_TEAMS[fullName] ?? "Server API Team",
                status: "active",
            });
        }
    });
    membersSeeded = true;
}
function seedDefaultProjects() {
    if (projectsSeeded)
        return;
    // Ensure members are seeded first
    seedDefaultMembers();
    const existingCodes = new Set(projects.map((p) => p.projectCode));
    const firstMemberId = members[0]?.id ?? "";
    let firstProjectId = "";
    DEFAULT_PROJECTS.forEach((project) => {
        if (!existingCodes.has(project.projectCode)) {
            const newId = createId("p");
            projects.push({
                ...project,
                id: newId,
                ownerMemberId: firstMemberId || project.ownerMemberId,
            });
            if (!firstProjectId)
                firstProjectId = newId;
        }
    });
    if (!firstProjectId)
        firstProjectId = projects[0]?.id ?? "";
    // Default to InnovaProSDK (INN-001) for demo tasks — spread across 8 members (one per team)
    const inn001Project = projects.find((p) => p.projectCode === "INN-001");
    const demoProjectId = inn001Project?.id ?? firstProjectId;
    const csvSeedRows = loadCsvSeedRows();
    const demoAssignees = [
        members.find((m) => m.fullName === "Hoàng Văn Nhật Anh"),
        members.find((m) => m.fullName === "Lê Quang Duy"),
        members.find((m) => m.fullName === "Lê Nguyễn Thục Nhi"),
        members.find((m) => m.fullName === "Lê Văn Thiện"),
        members.find((m) => m.fullName === "Lương Nguyễn Bảo Châu"),
        members.find((m) => m.fullName === "Nguyễn Thanh Huy"),
        members.find((m) => m.fullName === "Lê Bá Kha"),
        members.find((m) => m.fullName === "Phan Văn Nguyên"),
    ].filter(Boolean);
    if (demoAssignees.length > 0) {
        const seededTaskCodes = new Set(tasks.map((t) => t.taskCode));
        if (csvSeedRows.length > 0) {
            let nextNum = 1;
            csvSeedRows.slice(0, DEFAULT_SEED_TASK_LIMIT).forEach((row) => {
                const plannedStartDate = parseSeedDate(row.start);
                const dueDate = parseSeedDate(row.complete);
                if (!plannedStartDate || !dueDate)
                    return;
                const assigneeId = resolveAssigneeId(row.assigneeName) ??
                    members.find((m) => m.fullName === "Hoàng Văn Nhật Anh")?.id ??
                    members[0]?.id;
                if (!assigneeId)
                    return;
                const taskCode = `TSK-${String(nextNum++).padStart(3, "0")}`;
                if (seededTaskCodes.has(taskCode))
                    return;
                const progress = row.progress;
                const status = progress >= 100 ? "done" : progress > 0 ? "in_progress" : "todo";
                const priorityRaw = row.priority.toLowerCase();
                const priority = priorityRaw.includes("critical") ? "critical" :
                    priorityRaw.includes("high") ? "high" :
                        priorityRaw.includes("low") ? "low" : "medium";
                tasks.push({
                    id: createId("t"),
                    taskCode,
                    title: row.title,
                    projectId: resolveProjectIdByName(row.projectName, demoProjectId),
                    assigneeMemberId: assigneeId,
                    dueDate,
                    status,
                    priority,
                    progress,
                    completedAt: progress >= 100 ? dueDate : undefined,
                    plannedStartDate,
                });
            });
        }
        else {
            DEMO_TASKS.slice(0, DEFAULT_SEED_TASK_LIMIT).forEach((demo, index) => {
                if (!seededTaskCodes.has(demo.taskCode) && demoProjectId) {
                    const assignee = demoAssignees[index % demoAssignees.length];
                    if (assignee) {
                        tasks.push({
                            id: createId("t"),
                            taskCode: demo.taskCode,
                            title: demo.title,
                            projectId: demoProjectId,
                            assigneeMemberId: assignee.id,
                            dueDate: demo.dueDate,
                            status: demo.status,
                            priority: demo.priority,
                            completedAt: demo.completedAt,
                            plannedStartDate: demo.plannedStartDate,
                        });
                    }
                }
            });
        }
        // Seed demo project member assignments for all demo assignees
        demoAssignees.forEach((assignee) => {
            if (!assignee)
                return;
            const existingPM = projectMembers.some((pm) => pm.projectId === demoProjectId && pm.memberId === assignee.id);
            if (!existingPM && demoProjectId) {
                projectMembers.push({
                    id: createId("pm"),
                    projectId: demoProjectId,
                    memberId: assignee.id,
                    assignmentRole: "contributor",
                    allocationPercent: 100,
                    assignedAt: nowIso(),
                });
            }
        });
    }
    enforceSeedTaskLimit();
    projectsSeeded = true;
}
// ── Public seed-aware getters ───────────────────────────────────────────────
export function getMembersWithSeed() {
    seedDefaultMembers();
    return members.filter((member) => !member.deletedAt);
}
export function getProjectsWithSeed() {
    seedDefaultProjects();
    return projects.filter((project) => !project.deletedAt);
}
/** Danh sách members cho API: SQL khi bật DB, mảng khi không. */
export async function getMembersForRead() {
    if (isPersistenceEnabled()) {
        return listMembersFromDb();
    }
    seedDefaultMembers();
    return members.filter((member) => !member.deletedAt);
}
/** Danh sách projects cho API: SQL khi bật DB, mảng khi không. */
export async function getProjectsForRead() {
    if (isPersistenceEnabled()) {
        return listProjectsFromDb();
    }
    seedDefaultProjects();
    return projects.filter((project) => !project.deletedAt);
}
export async function loadOrInitializePersistence() {
    if (!isPersistenceEnabled()) {
        getProjectsWithSeed();
        return;
    }
    const pool = getPool();
    await hydrateMembersFromDb(pool, members);
    await hydrateProjectsFromDb(pool, projects);
    if (members.length === 0 || projects.length === 0) {
        getProjectsWithSeed();
        await persistAllMembersProjects(pool, members, projects);
        await persistTasksFromMemory([...tasks]);
        tasks.splice(0, tasks.length);
    }
    members.splice(0, members.length);
    projects.splice(0, projects.length);
    membersSeeded = true;
    projectsSeeded = true;
}
export async function softDeleteProject(id) {
    if (isPersistenceEnabled()) {
        const deleted = await patchProjectInDb(id, { deletedAt: nowIso() });
        if (!deleted)
            return undefined;
        addAuditLog({
            action: "project.delete",
            entityType: "project",
            entityId: deleted.id,
            metadata: { projectCode: deleted.projectCode },
        });
        return deleted;
    }
    const project = projects.find((p) => p.id === id && !p.deletedAt);
    if (!project)
        return undefined;
    project.deletedAt = nowIso();
    addAuditLog({
        action: "project.delete",
        entityType: "project",
        entityId: project.id,
        metadata: { projectCode: project.projectCode },
    });
    return project;
}
// ── Re-export task/projectMembers arrays for direct mutation ───────────────
export const tasks = [];
export const projectMembers = [];
export const taskHistory = [];
export const auditLogs = [];
export const reportHistory = [];
const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "cookie", "session"];
function sanitizeMetadata(raw) {
    return Object.fromEntries(Object.entries(raw).map(([key, value]) => {
        const lower = key.toLowerCase();
        if (SENSITIVE_KEYS.some((marker) => lower.includes(marker))) {
            return [key, "[REDACTED]"];
        }
        return [key, value];
    }));
}
function nowIso() {
    return new Date().toISOString();
}
let _idCounter = 0;
function createId(prefix) {
    return `${prefix}-${Date.now()}-${_idCounter++}`;
}
export function addAuditLog(entry) {
    const item = {
        id: createId("log"),
        createdAt: nowIso(),
        ...entry,
        metadata: sanitizeMetadata(entry.metadata),
    };
    auditLogs.unshift(item);
    return item;
}
export function addTaskHistory(entry) {
    const item = {
        id: createId("th"),
        changedAt: nowIso(),
        ...entry,
    };
    taskHistory.unshift(item);
    return item;
}
function findMemberByIdInMemory(id) {
    return members.find((member) => member.id === id && !member.deletedAt);
}
function findProjectByIdInMemory(id) {
    return projects.find((project) => project.id === id && !project.deletedAt);
}
export async function findMemberById(id) {
    if (isPersistenceEnabled()) {
        return selectMemberByIdFromDb(id);
    }
    return findMemberByIdInMemory(id);
}
export async function findProjectById(id) {
    if (isPersistenceEnabled()) {
        return selectProjectByIdFromDb(id);
    }
    return findProjectByIdInMemory(id);
}
export async function findTaskById(id) {
    if (isPersistenceEnabled()) {
        return selectTaskByIdFromDb(id);
    }
    return tasks.find((task) => task.id === id && !task.deletedAt);
}
export async function createMember(input) {
    const member = { id: createId("m"), ...input };
    if (isPersistenceEnabled()) {
        const saved = await insertMemberReturning(getPool(), member);
        addAuditLog({
            action: "member.create",
            entityType: "member",
            entityId: saved.id,
            metadata: { memberCode: saved.memberCode, email: saved.email },
        });
        return saved;
    }
    members.push(member);
    addAuditLog({
        action: "member.create",
        entityType: "member",
        entityId: member.id,
        metadata: { memberCode: member.memberCode, email: member.email },
    });
    return member;
}
export async function updateMember(id, patch) {
    if (isPersistenceEnabled()) {
        const updated = await patchMemberInDb(id, patch);
        if (!updated)
            return undefined;
        addAuditLog({
            action: "member.update",
            entityType: "member",
            entityId: updated.id,
            metadata: { keys: Object.keys(patch).join(",") },
        });
        return updated;
    }
    const member = findMemberByIdInMemory(id);
    if (!member)
        return undefined;
    Object.assign(member, patch);
    addAuditLog({
        action: "member.update",
        entityType: "member",
        entityId: member.id,
        metadata: { keys: Object.keys(patch).join(",") },
    });
    return member;
}
export async function softDeleteMember(id) {
    if (isPersistenceEnabled()) {
        const deleted = await patchMemberInDb(id, { deletedAt: nowIso(), status: "inactive" });
        if (!deleted)
            return undefined;
        addAuditLog({
            action: "member.delete",
            entityType: "member",
            entityId: deleted.id,
            metadata: {},
        });
        return deleted;
    }
    const member = findMemberByIdInMemory(id);
    if (!member)
        return undefined;
    member.deletedAt = nowIso();
    member.status = "inactive";
    addAuditLog({
        action: "member.delete",
        entityType: "member",
        entityId: member.id,
        metadata: {},
    });
    return member;
}
export async function createProject(input) {
    const project = { id: createId("p"), ...input };
    if (isPersistenceEnabled()) {
        const saved = await insertProjectReturning(getPool(), project);
        addAuditLog({
            action: "project.create",
            entityType: "project",
            entityId: saved.id,
            metadata: { projectCode: saved.projectCode },
        });
        return saved;
    }
    projects.push(project);
    addAuditLog({
        action: "project.create",
        entityType: "project",
        entityId: project.id,
        metadata: { projectCode: project.projectCode },
    });
    return project;
}
export function assignMemberToProject(input) {
    const duplicated = projectMembers.find((item) => item.projectId === input.projectId && item.memberId === input.memberId);
    if (duplicated)
        return duplicated;
    const assignment = {
        id: createId("pm"),
        assignedAt: nowIso(),
        ...input,
    };
    projectMembers.push(assignment);
    addAuditLog({
        action: "project.member.assign",
        entityType: "project",
        entityId: input.projectId,
        metadata: { memberId: input.memberId, assignmentRole: input.assignmentRole },
    });
    return assignment;
}
export function removeMemberFromProject(projectId, memberId) {
    const index = projectMembers.findIndex((item) => item.projectId === projectId && item.memberId === memberId);
    if (index < 0)
        return false;
    projectMembers.splice(index, 1);
    addAuditLog({
        action: "project.member.remove",
        entityType: "project",
        entityId: projectId,
        metadata: { memberId },
    });
    return true;
}
export async function updateProject(id, patch) {
    if (isPersistenceEnabled()) {
        const updated = await patchProjectInDb(id, patch);
        if (!updated)
            return undefined;
        addAuditLog({
            action: "project.update",
            entityType: "project",
            entityId: updated.id,
            metadata: { keys: Object.keys(patch).join(",") },
        });
        return updated;
    }
    const project = findProjectByIdInMemory(id);
    if (!project)
        return undefined;
    Object.assign(project, patch);
    addAuditLog({
        action: "project.update",
        entityType: "project",
        entityId: project.id,
        metadata: { keys: Object.keys(patch).join(",") },
    });
    return project;
}
export async function getTasks(filters) {
    if (isPersistenceEnabled()) {
        return listTasksFromDb(filters);
    }
    const projectId = filters.projectId;
    const memberId = filters.memberId;
    const status = filters.status;
    const search = filters.search?.toLowerCase();
    const dateFrom = filters.dateFrom;
    const dateTo = filters.dateTo;
    return tasks
        .filter((item) => !item.deletedAt)
        .filter((item) => (projectId ? item.projectId === projectId : true))
        .filter((item) => (memberId ? item.assigneeMemberId === memberId : true))
        .filter((item) => (status ? item.status === status : true))
        .filter((item) => (search ? `${item.taskCode} ${item.title}`.toLowerCase().includes(search) : true))
        .filter((item) => (dateFrom ? item.dueDate >= dateFrom : true))
        .filter((item) => (dateTo ? item.dueDate <= dateTo : true))
        .map((item) => {
        const p = projects.find((pr) => pr.id === item.projectId);
        return { ...item, projectName: p?.name };
    });
}
async function allActiveTasks() {
    if (isPersistenceEnabled()) {
        return selectAllTasksForAnalyticsFromDb();
    }
    return tasks.filter((item) => !item.deletedAt);
}
export async function createTask(input) {
    const task = { id: createId("t"), status: "todo", ...input };
    if (isPersistenceEnabled()) {
        await insertTaskIntoDb(task);
    }
    else {
        tasks.push(task);
    }
    addAuditLog({
        action: "task.create",
        entityType: "task",
        entityId: task.id,
        metadata: { taskCode: task.taskCode },
    });
    return task;
}
export async function updateTask(id, patch) {
    const task = isPersistenceEnabled() ? await selectTaskByIdFromDb(id) : tasks.find((t) => t.id === id && !t.deletedAt);
    if (!task)
        return undefined;
    for (const [fieldName, newValue] of Object.entries(patch)) {
        const key = fieldName;
        const oldValue = task[key];
        if (typeof newValue !== "undefined" && String(oldValue ?? "") !== String(newValue)) {
            addTaskHistory({
                taskId: task.id,
                fieldName,
                oldValue: String(oldValue ?? ""),
                newValue: String(newValue),
            });
        }
    }
    if (isPersistenceEnabled()) {
        const updated = await updateTaskInDb(id, patch);
        addAuditLog({
            action: "task.update",
            entityType: "task",
            entityId: task.id,
            metadata: { keys: Object.keys(patch).join(",") },
        });
        return updated;
    }
    Object.assign(task, patch);
    addAuditLog({
        action: "task.update",
        entityType: "task",
        entityId: task.id,
        metadata: { keys: Object.keys(patch).join(",") },
    });
    return task;
}
function toDelayDays(task) {
    if (!task.completedAt)
        return 0;
    const due = new Date(task.dueDate).getTime();
    const done = new Date(task.completedAt).getTime();
    const delayMs = Math.max(0, done - due);
    return Math.floor(delayMs / (24 * 60 * 60 * 1000));
}
const priorityWeight = {
    low: 1,
    medium: 1.5,
    high: 2,
    critical: 3,
};
function toBand(score) {
    if (score >= 85)
        return "A";
    if (score >= 70)
        return "B";
    if (score >= 50)
        return "C";
    return "D";
}
export async function getDashboardSummary() {
    const now = new Date();
    const activeMembers = await getMembersForRead();
    const activeProjects = await getProjectsForRead();
    const taskList = await allActiveTasks();
    const openTasks = taskList.filter((task) => !task.completedAt);
    const overdueTasks = openTasks.filter((task) => new Date(task.dueDate) < now).length;
    return {
        activeMembers: activeMembers.filter((member) => member.status === "active").length,
        activeProjects: activeProjects.filter((project) => project.status === "active").length,
        openTasks: openTasks.length,
        overdueTasks,
    };
}
export async function getStatusDistribution() {
    const counts = new Map();
    const taskList = await allActiveTasks();
    for (const task of taskList) {
        counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    }
    return [...counts.entries()].map(([status, value]) => ({ status, value }));
}
export async function getDelayTrend() {
    const monthMap = new Map();
    const taskList = await allActiveTasks();
    for (const task of taskList.filter((item) => item.completedAt)) {
        const period = task.completedAt.slice(0, 7);
        const current = monthMap.get(period) ?? { delayedTasks: 0, totalDelay: 0, doneCount: 0 };
        const delay = toDelayDays(task);
        current.doneCount += 1;
        current.totalDelay += delay;
        if (delay > 0)
            current.delayedTasks += 1;
        monthMap.set(period, current);
    }
    return [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, stat]) => ({
        period,
        delayedTasks: stat.delayedTasks,
        avgDelayDays: Number((stat.doneCount === 0 ? 0 : stat.totalDelay / stat.doneCount).toFixed(2)),
    }));
}
export async function getPerformance() {
    const activeMembers = await getMembersForRead();
    const taskList = await allActiveTasks();
    return activeMembers.map((member) => {
        const ownTasks = taskList.filter((task) => task.assigneeMemberId === member.id);
        const overdueCount = ownTasks.filter((task) => task.completedAt && toDelayDays(task) > 0).length;
        const avgDelayDays = ownTasks.length === 0 ? 0 : ownTasks.reduce((sum, task) => sum + toDelayDays(task), 0) / ownTasks.length;
        const overdueRatio = ownTasks.length === 0 ? 0 : overdueCount / ownTasks.length;
        const weightedDelayPenalty = ownTasks.reduce((sum, task) => sum + toDelayDays(task) * priorityWeight[task.priority], 0);
        const overduePenalty = overdueRatio * 40;
        const score = Math.max(0, Math.round(100 - weightedDelayPenalty - overduePenalty));
        return {
            memberId: member.id,
            memberName: member.fullName,
            score,
            avgDelayDays: Number(avgDelayDays.toFixed(2)),
            overdueRatio: Number(overdueRatio.toFixed(2)),
            performanceBand: toBand(score),
        };
    });
}
export async function getWeeklyReportRows() {
    const activeMembers = await getMembersForRead();
    const taskList = await allActiveTasks();
    return activeMembers.map((member) => {
        const ownTasks = taskList.filter((task) => task.assigneeMemberId === member.id);
        const done = ownTasks.filter((task) => task.status === "done").length;
        const overdue = ownTasks.filter((task) => task.completedAt && toDelayDays(task) > 0).length;
        const avgDelayDays = ownTasks.length === 0 ? 0 : ownTasks.reduce((sum, task) => sum + toDelayDays(task), 0) / ownTasks.length;
        return {
            memberName: member.fullName,
            assigned: ownTasks.length,
            done,
            overdue,
            avgDelayDays: Number(avgDelayDays.toFixed(2)),
        };
    });
}
export async function getMonthlyReportRows() {
    return getWeeklyReportRows();
}
export async function getPerformanceByPeriod(periodType, periodKey) {
    const start = periodType === "month" ? `${periodKey}-01` : periodType === "quarter" ? `${periodKey}-01` : `${periodKey}-01-01`;
    const taskList = await allActiveTasks();
    const filteredTasks = taskList.filter((task) => !task.completedAt || task.completedAt >= start);
    const basePerformance = await getPerformance();
    return basePerformance.map((item) => {
        const ownCount = filteredTasks.filter((task) => task.assigneeMemberId === item.memberId).length;
        return {
            ...item,
            score: Math.max(0, Math.min(100, item.score - Math.max(0, 2 - ownCount) * 5)),
        };
    });
}
export function createReportRecord(input) {
    const report = {
        id: createId("r"),
        createdAt: nowIso(),
        status: "queued",
        ...input,
    };
    reportHistory.unshift(report);
    addAuditLog({
        action: "report.create",
        entityType: "report",
        entityId: report.id,
        metadata: { reportType: report.reportType, format: report.format },
    });
    return report;
}
export function updateReportRecord(id, patch) {
    const report = reportHistory.find((item) => item.id === id);
    if (!report)
        return undefined;
    Object.assign(report, patch);
    return report;
}
