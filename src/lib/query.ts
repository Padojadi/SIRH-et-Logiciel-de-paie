export type Search = Record<string, string | string[] | undefined>;

export async function readQuery(searchParams: Promise<unknown>) {
  const raw = (await searchParams) as Search;
  const get = (key: string) => {
    const value = raw[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return { get, ok: get("ok"), erreur: get("erreur") };
}
