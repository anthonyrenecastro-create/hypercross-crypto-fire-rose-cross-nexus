import crypto from "crypto";
import fs from "fs";

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  passwordHash: string;
  createdAt: string;
  lastLogin: string | null;
}

const STORE_PATH = process.env.AUTH_STORE_PATH || "/tmp/hypercross-auth-users.json";

function readStore(): AuthUser[] {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AuthUser[]) : [];
  } catch {
    return [];
  }
}

function writeStore(users: AuthUser[]): void {
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(users), "utf8");
  fs.renameSync(tempPath, STORE_PATH);
}

export function normalizeEmail(raw: string | undefined): string | null {
  const value = raw?.trim().toLowerCase();
  return value || null;
}

export function normalizePhone(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  return value.replace(/\s+/g, "");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function getByEmail(email: string): AuthUser | null {
  const users = readStore();
  return users.find((u) => u.email === email) ?? null;
}

export function getByPhone(phone: string): AuthUser | null {
  const users = readStore();
  return users.find((u) => u.phone === phone) ?? null;
}

export function createUser(input: {
  email: string | null;
  phone: string | null;
  passwordHash: string;
}): AuthUser {
  const users = readStore();
  const created: AuthUser = {
    id: crypto.randomUUID(),
    email: input.email,
    phone: input.phone,
    passwordHash: input.passwordHash,
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };
  users.push(created);
  writeStore(users);
  return created;
}

export function touchLogin(id: string): void {
  const users = readStore();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return;
  users[idx] = {
    ...users[idx],
    lastLogin: new Date().toISOString(),
  };
  writeStore(users);
}
