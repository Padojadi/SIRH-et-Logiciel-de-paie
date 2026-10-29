import { createHmac } from "node:crypto";

export function signSessionToken(userId: number, secret: string, finaliser = false): string {
  const payload: { uid: number; exp: number; fin?: number } = {
    uid: userId,
    exp: Date.now() + 12 * 3600 * 1000,
  };
  if (finaliser) payload.fin = 1;
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
