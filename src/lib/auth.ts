import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get, run } from "./db";
import { can } from "./permissions";
import { hashPassword, verifyPassword } from "./passwords";
import { audit } from "./settings";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  role: string;
  agent_id: number | null;
};

function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const file = path.join(path.dirname(process.env.CAURIS_DB_PATH || path.join(process.cwd(), "data", "cauris.sqlite")), ".secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const value = randomBytes(32).toString("hex");
  fs.writeFileSync(file, value, { mode: 0o600 });
  return value;
}

export function signSession(userId: number): string {
  const body = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + 12 * 3600 * 1000 })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(token: string): number | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const actual = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (actual.length !== expectedBuf.length || !timingSafeEqual(actual, expectedBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { uid: number; exp: number };
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get("cauris_session")?.value;
  if (!token) return null;
  const userId = readSession(token);
  if (!userId) return null;
  return (
    get<SessionUser>(
      "SELECT id, email, name, role, agent_id FROM users WHERE id = ? AND active = 1",
      [userId],
    ) ?? null
  );
}

export async function requireUser(permission?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  if (permission && !can(user.role, permission)) {
    redirect(`/tableau-de-bord?erreur=${encodeURIComponent("Vous n'avez pas accès à cette fonction.")}`);
  }
  return user;
}

export async function login(email: string, password: string): Promise<SessionUser> {
  const row = get<SessionUser & { password_hash: string; active: number }>(
    "SELECT id, email, name, role, agent_id, password_hash, active FROM users WHERE email = ?",
    [email.trim().toLowerCase()],
  );
  if (!row || !row.active || !verifyPassword(password, row.password_hash)) {
    throw new Error("Identifiant ou mot de passe incorrect.");
  }
  const jar = await cookies();
  jar.set("cauris_session", signSession(row.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 3600,
  });
  audit(row.id, "connexion", row.email);
  return row;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  jar.delete("cauris_session");
}

export function changePassword(userId: number, current: string, next: string): void {
  const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", [userId]);
  if (!row || !verifyPassword(current, row.password_hash)) throw new Error("Le mot de passe actuel est incorrect.");
  if (next.length < 10) throw new Error("Le nouveau mot de passe doit contenir au moins 10 caractères.");
  run("UPDATE users SET password_hash = ? WHERE id = ?", [hashPassword(next), userId]);
  audit(userId, "mot_de_passe", "Modification du mot de passe");
}
