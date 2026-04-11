import { getPool } from "./index.js";
import { rowToTask } from "./rows.js";
const TASK_STATUSES = new Set(["todo", "in_progress", "blocked", "done", "canceled"]);
export async function listTasksFromDb(filters) {
    const pool = getPool();
    const conditions = ["t.deleted_at IS NULL"];
    const params = [];
    let p = 1;
    if (filters.projectId) {
        conditions.push(`t.project_id = $${p}`);
        params.push(filters.projectId);
        p += 1;
    }
    if (filters.memberId) {
        conditions.push(`t.assignee_member_id = $${p}`);
        params.push(filters.memberId);
        p += 1;
    }
    if (filters.status) {
        if (!TASK_STATUSES.has(filters.status)) {
            conditions.push("FALSE");
        }
        else {
            conditions.push(`t.status = $${p}`);
            params.push(filters.status);
            p += 1;
        }
    }
    if (filters.dateFrom) {
        conditions.push(`t.due_date >= $${p}::date`);
        params.push(filters.dateFrom);
        p += 1;
    }
    if (filters.dateTo) {
        conditions.push(`t.due_date <= $${p}::date`);
        params.push(filters.dateTo);
        p += 1;
    }
    if (filters.search && filters.search.trim() !== "") {
        const term = `%${filters.search.trim()}%`;
        conditions.push(`(t.task_code ILIKE $${p} OR t.title ILIKE $${p})`);
        params.push(term);
        p += 1;
    }
    const sql = `
    SELECT t.id, t.task_code, t.title, t.project_id, t.assignee_member_id, t.due_date, t.status, t.priority,
           t.planned_start_date, t.progress, t.completed_at, t.deleted_at,
           p.name AS project_name
    FROM tasks t
    LEFT JOIN projects p ON p.id = t.project_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY t.due_date ASC, t.task_code ASC
  `;
    const result = await pool.query(sql, params);
    return result.rows.map((row) => rowToTask(row));
}
export async function selectTaskByIdFromDb(id) {
    const pool = getPool();
    const result = await pool.query(`SELECT id, task_code, title, project_id, assignee_member_id, due_date, status, priority,
            planned_start_date, progress, completed_at, deleted_at
     FROM tasks WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const row = result.rows[0];
    return row ? rowToTask(row) : undefined;
}
export async function selectAllTasksForAnalyticsFromDb() {
    const pool = getPool();
    const result = await pool.query(`SELECT id, task_code, title, project_id, assignee_member_id, due_date, status, priority,
            planned_start_date, progress, completed_at, deleted_at
     FROM tasks WHERE deleted_at IS NULL`);
    return result.rows.map((row) => rowToTask(row));
}
export async function nextTaskCodeFromDb() {
    const pool = getPool();
    const result = await pool.query(`
    SELECT COALESCE(MAX(CAST(SUBSTRING(task_code FROM 5) AS INTEGER)), 0) AS max_num
    FROM tasks
    WHERE task_code ~ '^TSK-[0-9]+$'
  `);
    const maxNum = Number(result.rows[0]?.max_num ?? 0);
    const next = maxNum + 1;
    return `TSK-${String(next).padStart(3, "0")}`;
}
export async function persistTasksFromMemory(taskList) {
    const pool = getPool();
    for (const t of taskList) {
        await insertTaskIntoDb(t);
    }
}
export async function insertTaskIntoDb(task) {
    const pool = getPool();
    await pool.query(`INSERT INTO tasks (
       id, task_code, title, project_id, assignee_member_id, due_date, status, priority,
       planned_start_date, progress, completed_at, deleted_at
     ) VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8, $9::date, $10, $11::date, $12)`, [
        task.id,
        task.taskCode,
        task.title,
        task.projectId,
        task.assigneeMemberId,
        task.dueDate,
        task.status,
        task.priority,
        task.plannedStartDate ?? null,
        task.progress ?? 0,
        task.completedAt ?? null,
        task.deletedAt ?? null,
    ]);
}
export async function updateTaskInDb(id, patch) {
    const pool = getPool();
    const current = await selectTaskByIdFromDb(id);
    if (!current)
        return undefined;
    const columns = [];
    const values = [];
    let n = 1;
    const add = (col, val) => {
        columns.push(`${col} = $${n}`);
        values.push(val);
        n += 1;
    };
    if (typeof patch.title !== "undefined")
        add("title", patch.title);
    if (typeof patch.assigneeMemberId !== "undefined")
        add("assignee_member_id", patch.assigneeMemberId);
    if (typeof patch.projectId !== "undefined")
        add("project_id", patch.projectId);
    if (typeof patch.dueDate !== "undefined")
        add("due_date", patch.dueDate);
    if ("plannedStartDate" in patch)
        add("planned_start_date", patch.plannedStartDate ?? null);
    if (typeof patch.progress !== "undefined")
        add("progress", patch.progress ?? 0);
    if (typeof patch.status !== "undefined")
        add("status", patch.status);
    if (typeof patch.priority !== "undefined")
        add("priority", patch.priority);
    if ("completedAt" in patch)
        add("completed_at", patch.completedAt ?? null);
    if (typeof patch.taskCode !== "undefined")
        add("task_code", patch.taskCode);
    if (typeof patch.deletedAt !== "undefined")
        add("deleted_at", patch.deletedAt ?? null);
    if (columns.length === 0) {
        return current;
    }
    values.push(id);
    const sql = `UPDATE tasks SET ${columns.join(", ")} WHERE id = $${n} AND deleted_at IS NULL RETURNING
    id, task_code, title, project_id, assignee_member_id, due_date, status, priority,
    planned_start_date, progress, completed_at, deleted_at`;
    const result = await pool.query(sql, values);
    const row = result.rows[0];
    return row ? rowToTask(row) : undefined;
}
