type Payload = { uid?: number; exp?: number; fin?: number };

function octets(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = base64url.length % 4 === 0 ? "" : "=".repeat(4 - (base64url.length % 4));
  const binary = atob(base64url.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function sessionDoitFinaliser(token: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify("HMAC", key, octets(parts[1]), new TextEncoder().encode(parts[0]));
    if (!valid) return false;
    const payload = JSON.parse(new TextDecoder().decode(octets(parts[0]))) as Payload;
    return payload.fin === 1 && typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}
