export type Search = Record<string, string | string[] | undefined>;

export function corrigerEncodage(value: string | undefined): string | undefined {
  if (!value || !value.includes("Ã")) return value;
  const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return decoded.includes("\uFFFD") ? value : decoded;
}

export async function readQuery(searchParams: Promise<unknown>) {
  const raw = (await searchParams) as Search;
  const get = (key: string) => {
    const value = raw[key];
    return corrigerEncodage(Array.isArray(value) ? value[0] : value);
  };
  return { get, ok: get("ok"), erreur: get("erreur") };
}
