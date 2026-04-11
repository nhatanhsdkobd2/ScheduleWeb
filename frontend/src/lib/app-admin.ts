/** Shown when Members/Projects actions are disabled for non-admin users. */
export const APP_ADMIN_ONLY_TOOLTIP = "Only administrators can perform this action.";

/** Always treated as app admins (Members/Projects CRUD, Export XLSX). */
const BUILTIN_APP_ADMIN_EMAILS = [
  "anhhoanginnova@gmail.com",
  "thuan.ngo@vn.innova.com",
] as const;

function extraAdminEmailsFromEnv(): string[] {
  const raw = process.env.NEXT_PUBLIC_APP_ADMIN_EMAIL?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAppAdminEmail(email: string | null | undefined): boolean {
  const e = email?.trim().toLowerCase();
  if (!e) return false;
  const allowed = new Set<string>(BUILTIN_APP_ADMIN_EMAILS.map((x) => x.toLowerCase()));
  for (const x of extraAdminEmailsFromEnv()) {
    allowed.add(x);
  }
  return allowed.has(e);
}
