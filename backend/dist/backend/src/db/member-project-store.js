import { getPool } from "./index.js";
import { rowToMember, rowToProject } from "./rows.js";
function ownerForDb(ownerMemberId) {
    if (ownerMemberId == null || ownerMemberId === "")
        return null;
    return ownerMemberId;
}
const MEMBER_SELECT = `SELECT id, member_code, full_name, email, role, team, status, deleted_at FROM members`;
const PROJECT_SELECT = `SELECT id, project_code, name, owner_member_id, status, description, category, deleted_at FROM projects`;
export async function listMembersFromDb() {
    const pool = getPool();
    const result = await pool.query(`${MEMBER_SELECT} WHERE deleted_at IS NULL ORDER BY member_code`);
    return result.rows.map((row) => rowToMember(row));
}
export async function listProjectsFromDb() {
    const pool = getPool();
    const result = await pool.query(`${PROJECT_SELECT} WHERE deleted_at IS NULL ORDER BY project_code`);
    return result.rows.map((row) => rowToProject(row));
}
export async function selectMemberByIdFromDb(id) {
    const pool = getPool();
    const result = await pool.query(`${MEMBER_SELECT} WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const row = result.rows[0];
    return row ? rowToMember(row) : undefined;
}
export async function selectProjectByIdFromDb(id) {
    const pool = getPool();
    const result = await pool.query(`${PROJECT_SELECT} WHERE id = $1 AND deleted_at IS NULL`, [id]);
    const row = result.rows[0];
    return row ? rowToProject(row) : undefined;
}
/** True if another active member uses this email (case-insensitive). */
export async function memberEmailTaken(email, excludeId) {
    const pool = getPool();
    const result = excludeId
        ? await pool.query(`SELECT 1 FROM members WHERE lower(email) = lower($1) AND id <> $2 AND deleted_at IS NULL LIMIT 1`, [email, excludeId])
        : await pool.query(`SELECT 1 FROM members WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1`, [email]);
    return (result.rowCount ?? 0) > 0;
}
export async function insertMemberReturning(client, m) {
    const result = await client.query(`INSERT INTO members (id, member_code, full_name, email, role, team, status, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, member_code, full_name, email, role, team, status, deleted_at`, [m.id, m.memberCode, m.fullName, m.email, m.role, m.team, m.status, m.deletedAt ?? null]);
    return rowToMember(result.rows[0]);
}
export async function upsertMemberReturning(client, m) {
    const result = await client.query(`INSERT INTO members (id, member_code, full_name, email, role, team, status, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       member_code = EXCLUDED.member_code,
       full_name = EXCLUDED.full_name,
       email = EXCLUDED.email,
       role = EXCLUDED.role,
       team = EXCLUDED.team,
       status = EXCLUDED.status,
       deleted_at = EXCLUDED.deleted_at
     RETURNING id, member_code, full_name, email, role, team, status, deleted_at`, [m.id, m.memberCode, m.fullName, m.email, m.role, m.team, m.status, m.deletedAt ?? null]);
    return rowToMember(result.rows[0]);
}
export async function patchMemberInDb(id, patch) {
    const pool = getPool();
    const columns = [];
    const values = [];
    let n = 1;
    const add = (col, val) => {
        columns.push(`${col} = $${n}`);
        values.push(val);
        n += 1;
    };
    if (typeof patch.memberCode !== "undefined")
        add("member_code", patch.memberCode);
    if (typeof patch.fullName !== "undefined")
        add("full_name", patch.fullName);
    if (typeof patch.email !== "undefined")
        add("email", patch.email);
    if (typeof patch.role !== "undefined")
        add("role", patch.role);
    if (typeof patch.team !== "undefined")
        add("team", patch.team);
    if (typeof patch.status !== "undefined")
        add("status", patch.status);
    if ("deletedAt" in patch)
        add("deleted_at", patch.deletedAt ?? null);
    if (columns.length === 0) {
        return selectMemberByIdFromDb(id);
    }
    values.push(id);
    const sql = `UPDATE members SET ${columns.join(", ")} WHERE id = $${n} AND deleted_at IS NULL
    RETURNING id, member_code, full_name, email, role, team, status, deleted_at`;
    const result = await pool.query(sql, values);
    const row = result.rows[0];
    return row ? rowToMember(row) : undefined;
}
export async function insertProjectReturning(client, p) {
    const result = await client.query(`INSERT INTO projects (id, project_code, name, owner_member_id, status, description, category, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, project_code, name, owner_member_id, status, description, category, deleted_at`, [
        p.id,
        p.projectCode,
        p.name,
        ownerForDb(p.ownerMemberId),
        p.status,
        p.description ?? null,
        p.category ?? null,
        p.deletedAt ?? null,
    ]);
    return rowToProject(result.rows[0]);
}
export async function upsertProjectReturning(client, p) {
    const result = await client.query(`INSERT INTO projects (id, project_code, name, owner_member_id, status, description, category, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO UPDATE SET
       project_code = EXCLUDED.project_code,
       name = EXCLUDED.name,
       owner_member_id = EXCLUDED.owner_member_id,
       status = EXCLUDED.status,
       description = EXCLUDED.description,
       category = EXCLUDED.category,
       deleted_at = EXCLUDED.deleted_at
     RETURNING id, project_code, name, owner_member_id, status, description, category, deleted_at`, [
        p.id,
        p.projectCode,
        p.name,
        ownerForDb(p.ownerMemberId),
        p.status,
        p.description ?? null,
        p.category ?? null,
        p.deletedAt ?? null,
    ]);
    return rowToProject(result.rows[0]);
}
export async function patchProjectInDb(id, patch) {
    const pool = getPool();
    const columns = [];
    const values = [];
    let n = 1;
    const add = (col, val) => {
        columns.push(`${col} = $${n}`);
        values.push(val);
        n += 1;
    };
    if (typeof patch.projectCode !== "undefined")
        add("project_code", patch.projectCode);
    if (typeof patch.name !== "undefined")
        add("name", patch.name);
    if ("ownerMemberId" in patch)
        add("owner_member_id", ownerForDb(patch.ownerMemberId));
    if (typeof patch.status !== "undefined")
        add("status", patch.status);
    if ("description" in patch)
        add("description", patch.description ?? null);
    if ("category" in patch)
        add("category", patch.category ?? null);
    if ("deletedAt" in patch)
        add("deleted_at", patch.deletedAt ?? null);
    if (columns.length === 0) {
        return selectProjectByIdFromDb(id);
    }
    values.push(id);
    const sql = `UPDATE projects SET ${columns.join(", ")} WHERE id = $${n} AND deleted_at IS NULL
    RETURNING id, project_code, name, owner_member_id, status, description, category, deleted_at`;
    const result = await pool.query(sql, values);
    const row = result.rows[0];
    return row ? rowToProject(row) : undefined;
}
/** Chỉ dùng lúc bootstrap seed: đổ vào mảng tạm trước khi persist / xóa cache. */
export async function hydrateMembersFromDb(client, into) {
    const result = await client.query(`${MEMBER_SELECT} WHERE deleted_at IS NULL ORDER BY member_code`);
    into.splice(0, into.length, ...result.rows.map((row) => rowToMember(row)));
}
export async function hydrateProjectsFromDb(client, into) {
    const result = await client.query(`${PROJECT_SELECT} WHERE deleted_at IS NULL ORDER BY project_code`);
    into.splice(0, into.length, ...result.rows.map((row) => rowToProject(row)));
}
export async function persistAllMembersProjects(client, memberList, projectList) {
    for (const m of memberList) {
        await upsertMemberReturning(client, m);
    }
    for (const p of projectList) {
        await upsertProjectReturning(client, p);
    }
}
