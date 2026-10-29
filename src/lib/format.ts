export function franc(n: number): number {
  return Math.round(Number(n) || 0);
}

export function fcfa(n: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(franc(n))}\u00a0FCFA`;
}

export function pct(n: number): string {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(n * 100))}\u00a0%`;
}

export function pdfSafe(value: string): string {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\u202f|\u00a0/g, " ");
}

export function requiredText(value: FormDataEntryValue | null, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} est obligatoire.`);
  return text;
}

export function optionalText(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

export function requiredNumber(value: FormDataEntryValue | null, label: string): number {
  const raw = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!raw) throw new Error(`${label} est obligatoire.`);
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${label} n'est pas un nombre valide.`);
  return n;
}

export function optionalNumber(value: FormDataEntryValue | null): number {
  const raw = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error("Nombre invalide.");
  return n;
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function isHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
