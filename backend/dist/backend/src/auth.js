import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getPool, isPersistenceEnabled } from "./db/index.js";
import { getMembersForRead } from "./data.js";
const scryptAsync = promisify(scryptCallback);
const DEFAULT_PASSWORD = process.env.DEFAULT_AUTH_PASSWORD?.trim() || "123456";
const SPECIAL_ADMIN_ACCOUNT = {
    email: "thuan.ngo@vn.innova.com",
    password: "Inn0v@VN2925",
    displayName: "Thuan Ngo",
    team: "Admin",
};
const memoryCredentialByEmail = new Map();
let memoryReady = false;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function rowToMember(row) {
    const role = row.role === "admin" || row.role === "lead" ? row.role : "member";
    return {
        id: row.id,
        memberCode: row.member_code,
        fullName: row.full_name,
        email: row.email,
        role,
        team: row.team,
        status: row.status,
        deletedAt: row.deleted_at ?? undefined,
    };
}
async function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const key = (await scryptAsync(password, salt, 64));
    return `${salt}:${key.toString("hex")}`;
}
async function verifyPassword(password, stored) {
    const [salt, expectedHex] = stored.split(":");
    if (!salt || !expectedHex)
        return false;
    const actual = (await scryptAsync(password, salt, 64));
    const expected = Buffer.from(expectedHex, "hex");
    if (actual.length !== expected.length)
        return false;
    return timingSafeEqual(actual, expected);
}
function toLoginUser(member) {
    return {
        id: member.id,
        displayName: member.fullName,
        email: member.email,
        role: member.role,
        team: member.team,
        photoURL: null,
        mustChangePassword: false,
    };
}
async function ensureAuthTable() {
    const pool = getPool();
    await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL UNIQUE REFERENCES members (id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
      password_changed_at TIMESTAMPTZ NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );
  `);
    await pool.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;`);
    await pool.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL;`);
    await pool.query(`
    UPDATE auth_users
    SET must_change_password = TRUE
    WHERE password_changed_at IS NULL
      AND must_change_password = FALSE;
  `);
    await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower
      ON auth_users (lower(email))
      WHERE deleted_at IS NULL;
  `);
}
async function seedDbCredentials(members) {
    await ensureAuthTable();
    const pool = getPool();
    const defaultPasswordHash = await hashPassword(DEFAULT_PASSWORD);
    const specialEmail = normalizeEmail(SPECIAL_ADMIN_ACCOUNT.email);
    const specialPasswordHash = await hashPassword(SPECIAL_ADMIN_ACCOUNT.password);
    for (const member of members) {
        const email = normalizeEmail(member.email);
        const isSpecialAdmin = email === specialEmail;
        await pool.query(`
      INSERT INTO auth_users (id, member_id, email, password_hash, must_change_password, password_changed_at, status, deleted_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', NULL)
      ON CONFLICT (member_id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = CASE
          WHEN EXCLUDED.email = $7 THEN EXCLUDED.password_hash
          ELSE auth_users.password_hash
        END,
        status = 'active',
        deleted_at = NULL,
        must_change_password = CASE
          WHEN EXCLUDED.email = $7 THEN FALSE
          WHEN auth_users.password_changed_at IS NULL THEN TRUE
          ELSE auth_users.must_change_password
        END,
        password_changed_at = CASE
          WHEN EXCLUDED.email = $7 THEN COALESCE(auth_users.password_changed_at, NOW())
          ELSE auth_users.password_changed_at
        END,
        updated_at = NOW();
      `, [
            randomUUID(),
            member.id,
            email,
            isSpecialAdmin ? specialPasswordHash : defaultPasswordHash,
            isSpecialAdmin ? false : true,
            isSpecialAdmin ? new Date().toISOString() : null,
            specialEmail,
        ]);
    }
}
async function seedMemoryCredentials(members) {
    const defaultPasswordHash = await hashPassword(DEFAULT_PASSWORD);
    const specialPasswordHash = await hashPassword(SPECIAL_ADMIN_ACCOUNT.password);
    const specialEmail = normalizeEmail(SPECIAL_ADMIN_ACCOUNT.email);
    memoryCredentialByEmail.clear();
    for (const member of members) {
        const isSpecialAdmin = normalizeEmail(member.email) === specialEmail;
        memoryCredentialByEmail.set(normalizeEmail(member.email), {
            member,
            passwordHash: isSpecialAdmin ? specialPasswordHash : defaultPasswordHash,
            mustChangePassword: isSpecialAdmin ? false : true,
        });
    }
    memoryReady = true;
}
async function ensureSpecialAdminMemberDb() {
    const pool = getPool();
    const email = normalizeEmail(SPECIAL_ADMIN_ACCOUNT.email);
    const existing = await pool.query(`
    SELECT id, member_code, full_name, email, role, team, status, deleted_at
    FROM members
    WHERE lower(email) = lower($1)
    LIMIT 1
    `, [email]);
    const row = existing.rows[0];
    if (row) {
        const updated = await pool.query(`
      UPDATE members
      SET role = 'admin',
          status = 'active',
          deleted_at = NULL,
          full_name = CASE WHEN coalesce(trim(full_name), '') = '' THEN $2 ELSE full_name END,
          team = CASE WHEN coalesce(trim(team), '') = '' THEN $3 ELSE team END
      WHERE id = $1
      RETURNING id, member_code, full_name, email, role, team, status, deleted_at
      `, [row.id, SPECIAL_ADMIN_ACCOUNT.displayName, SPECIAL_ADMIN_ACCOUNT.team]);
        return rowToMember(updated.rows[0]);
    }
    const lastCode = await pool.query(`
    SELECT member_code
    FROM members
    WHERE member_code LIKE 'ADM-%'
    ORDER BY member_code DESC
    LIMIT 1
    `);
    const nextNum = (() => {
        const current = String(lastCode.rows[0]?.member_code ?? "");
        const m = /^ADM-(\d+)$/.exec(current);
        if (!m?.[1])
            return 1;
        return Number.parseInt(m[1], 10) + 1;
    })();
    const memberCode = `ADM-${String(nextNum).padStart(3, "0")}`;
    const inserted = await pool.query(`
    INSERT INTO members (id, member_code, full_name, email, role, team, status, deleted_at)
    VALUES ($1, $2, $3, $4, 'admin', $5, 'active', NULL)
    RETURNING id, member_code, full_name, email, role, team, status, deleted_at
    `, [randomUUID(), memberCode, SPECIAL_ADMIN_ACCOUNT.displayName, email, SPECIAL_ADMIN_ACCOUNT.team]);
    return rowToMember(inserted.rows[0]);
}
function ensureSpecialAdminMemberMemory(members) {
    const email = normalizeEmail(SPECIAL_ADMIN_ACCOUNT.email);
    const existing = members.find((member) => normalizeEmail(member.email) === email && !member.deletedAt);
    if (existing) {
        existing.role = "admin";
        existing.status = "active";
        existing.email = email;
        return members;
    }
    return [
        ...members,
        {
            id: randomUUID(),
            memberCode: "ADM-001",
            fullName: SPECIAL_ADMIN_ACCOUNT.displayName,
            email,
            role: "admin",
            team: SPECIAL_ADMIN_ACCOUNT.team,
            status: "active",
        },
    ];
}
export async function initializeAuthCredentials() {
    let members = (await getMembersForRead()).filter((member) => member.status === "active");
    if (isPersistenceEnabled()) {
        const specialAdmin = await ensureSpecialAdminMemberDb();
        if (!members.some((member) => member.id === specialAdmin.id)) {
            members = [...members, specialAdmin];
        }
        else {
            members = members.map((member) => (member.id === specialAdmin.id ? specialAdmin : member));
        }
        await seedDbCredentials(members);
        return;
    }
    members = ensureSpecialAdminMemberMemory(members);
    await seedMemoryCredentials(members);
}
export async function upsertAccountCredential(input) {
    const normalizedEmail = normalizeEmail(input.member.email);
    const passwordHash = await hashPassword(input.password);
    if (isPersistenceEnabled()) {
        await ensureAuthTable();
        const pool = getPool();
        await pool.query(`
      INSERT INTO auth_users (id, member_id, email, password_hash, must_change_password, password_changed_at, status, deleted_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', NULL)
      ON CONFLICT (member_id) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        must_change_password = EXCLUDED.must_change_password,
        password_changed_at = EXCLUDED.password_changed_at,
        status = 'active',
        deleted_at = NULL,
        updated_at = NOW()
      `, [
            randomUUID(),
            input.member.id,
            normalizedEmail,
            passwordHash,
            input.mustChangePassword,
            input.mustChangePassword ? null : new Date().toISOString(),
        ]);
        return;
    }
    memoryCredentialByEmail.set(normalizedEmail, {
        member: {
            ...input.member,
            email: normalizedEmail,
            status: "active",
        },
        passwordHash,
        mustChangePassword: input.mustChangePassword,
    });
    memoryReady = true;
}
export async function loginWithEmailPassword(email, password) {
    const normalized = normalizeEmail(email);
    if (isPersistenceEnabled()) {
        await ensureAuthTable();
        const pool = getPool();
        const result = await pool.query(`
      SELECT
        a.password_hash,
        a.must_change_password,
        m.id,
        m.full_name,
        m.email,
        m.role,
        m.team,
        m.status,
        m.deleted_at
      FROM auth_users a
      INNER JOIN members m ON m.id = a.member_id
      WHERE lower(a.email) = lower($1)
        AND a.deleted_at IS NULL
        AND a.status = 'active'
      LIMIT 1
      `, [normalized]);
        const row = result.rows[0];
        if (!row)
            return null;
        if (row.status !== "active" || row.deleted_at)
            return null;
        const valid = await verifyPassword(password, row.password_hash);
        if (!valid)
            return null;
        return {
            id: row.id,
            displayName: row.full_name,
            email: row.email,
            role: row.role,
            team: row.team,
            photoURL: null,
            mustChangePassword: row.must_change_password,
        };
    }
    if (!memoryReady) {
        await initializeAuthCredentials();
    }
    const credential = memoryCredentialByEmail.get(normalized);
    if (!credential)
        return null;
    const valid = await verifyPassword(password, credential.passwordHash);
    if (!valid)
        return null;
    const user = toLoginUser(credential.member);
    user.mustChangePassword = credential.mustChangePassword;
    return user;
}
export async function changePasswordWithCurrentPassword(email, currentPassword, newPassword) {
    const normalized = normalizeEmail(email);
    if (isPersistenceEnabled()) {
        await ensureAuthTable();
        const pool = getPool();
        const result = await pool.query(`
      SELECT
        a.member_id,
        a.password_hash,
        m.id,
        m.full_name,
        m.email,
        m.role,
        m.team,
        m.status,
        m.deleted_at
      FROM auth_users a
      INNER JOIN members m ON m.id = a.member_id
      WHERE lower(a.email) = lower($1)
        AND a.deleted_at IS NULL
        AND a.status = 'active'
      LIMIT 1
      `, [normalized]);
        const row = result.rows[0];
        if (!row || row.status !== "active" || row.deleted_at)
            return null;
        const valid = await verifyPassword(currentPassword, row.password_hash);
        if (!valid)
            return null;
        const newHash = await hashPassword(newPassword);
        await pool.query(`
      UPDATE auth_users
      SET password_hash = $2,
          must_change_password = FALSE,
          password_changed_at = NOW(),
          updated_at = NOW()
      WHERE member_id = $1
      `, [row.member_id, newHash]);
        return {
            id: row.id,
            displayName: row.full_name,
            email: row.email,
            role: row.role,
            team: row.team,
            photoURL: null,
            mustChangePassword: false,
        };
    }
    if (!memoryReady) {
        await initializeAuthCredentials();
    }
    const credential = memoryCredentialByEmail.get(normalized);
    if (!credential)
        return null;
    const valid = await verifyPassword(currentPassword, credential.passwordHash);
    if (!valid)
        return null;
    credential.passwordHash = await hashPassword(newPassword);
    credential.mustChangePassword = false;
    const user = toLoginUser(credential.member);
    user.mustChangePassword = false;
    return user;
}
