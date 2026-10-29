const DAKAR = "Africa/Dakar";

export function dakarParts(date: Date): { date: string; seconds: number } {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: DAKAR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    seconds: hour * 3600 + Number(parts.minute) * 60 + Number(parts.second),
  };
}

export function dakarToday(now = new Date()): string {
  return dakarParts(now).date;
}

export function addDays(iso: string, days: number): string {
  const t = Date.parse(`${iso}T00:00:00Z`) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function addMonths(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1 + delta, 1));
  const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  const month = cursor.getUTCMonth() + 1;
  return `${cursor.getUTCFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** 1 = lundi … 7 = dimanche. */
export function weekday(iso: string): number {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function isWeekday(iso: string): boolean {
  return weekday(iso) <= 5;
}

export function yearMonth(iso: string): string {
  return iso.slice(0, 7);
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function prevMonth(ym: string): string {
  return addMonths(`${ym}-01`, -1).slice(0, 7);
}

export function formatHeure(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

export function formatHeureCourte(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

export function frDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function frMois(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}
