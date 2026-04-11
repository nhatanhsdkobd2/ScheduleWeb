export function formatDateColumn(v) {
    if (v == null)
        return "";
    if (v instanceof Date)
        return v.toISOString().slice(0, 10);
    const s = String(v);
    return s.length >= 10 ? s.slice(0, 10) : s;
}
export function rowToMember(r) {
    return {
        id: String(r.id),
        memberCode: String(r.member_code),
        fullName: String(r.full_name),
        email: String(r.email),
        role: r.role,
        team: String(r.team),
        status: r.status,
        deletedAt: r.deleted_at != null ? String(r.deleted_at) : undefined,
    };
}
export function rowToProject(r) {
    return {
        id: String(r.id),
        projectCode: String(r.project_code),
        name: String(r.name),
        ownerMemberId: r.owner_member_id != null && String(r.owner_member_id) !== "" ? String(r.owner_member_id) : undefined,
        status: r.status,
        description: r.description != null ? String(r.description) : undefined,
        category: r.category != null ? String(r.category) : undefined,
        deletedAt: r.deleted_at != null ? String(r.deleted_at) : undefined,
    };
}
export function rowToTask(r) {
    const task = {
        id: String(r.id),
        taskCode: String(r.task_code),
        title: String(r.title),
        projectId: String(r.project_id),
        assigneeMemberId: String(r.assignee_member_id),
        dueDate: formatDateColumn(r.due_date),
        completedAt: r.completed_at != null ? formatDateColumn(r.completed_at) : undefined,
        plannedStartDate: r.planned_start_date != null ? formatDateColumn(r.planned_start_date) : undefined,
        progress: r.progress != null ? Number(r.progress) : undefined,
        status: r.status,
        priority: r.priority,
        deletedAt: r.deleted_at != null ? String(r.deleted_at) : undefined,
    };
    if (r.project_name != null && String(r.project_name).trim() !== "") {
        task.projectName = String(r.project_name);
    }
    return task;
}
