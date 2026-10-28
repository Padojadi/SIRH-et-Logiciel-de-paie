import { dakarParts } from "./dates";

export type SecWindow = { start: number; end: number };
export type Arrival = "avant_plage" | "a_l_heure" | "retard";
export type AvisFiche = "alleger" | "alourdir" | "equilibree" | "assiduite";
export type AvisUnite = "recruter" | "reaffecter" | "effectif_suffisant";

export const SEUIL_PRESENCE_ASSIDUITE = 0.7;
export const SEUIL_PRESENCE_ALOURDIR = 0.85;
export const SEUIL_CHARGE_ALLEGER = 1.15;
export const SEUIL_CHARGE_ALOURDIR = 0.8;
export const SEUIL_PART_RECRUTER = 0.25;
export const SEUIL_PART_REAFFECTER = 0.2;
export const IDLE_LIMIT_SEC = 120;
export const MAX_EXCEPTION_GAP_SEC = 4 * 3600;

export type TimeSettings = {
  debutComptage: string;
  limiteArrivee: string;
  finComptage: string;
  dureeTheoriqueSec: number;
};

export function parseHHMM(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw new Error("Heure invalide.");
  return Number(match[1]) * 3600 + Number(match[2]) * 60;
}

export function hhmm(total: number): string {
  const sec = ((total % 86400) + 86400) % 86400;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function endExclusive(start: string, end: string): number {
  const s = parseHHMM(start);
  let e = parseHHMM(end);
  if (e <= s) e += 86400;
  return e;
}

/** Durée couverte par l'union des fenêtres, sans double comptage. */
export function secondsInUnion(from: number, to: number, windows: SecWindow[]): number {
  if (to <= from) return 0;
  const cuts: SecWindow[] = [];
  for (const w of windows) {
    const a = Math.max(from, w.start);
    const b = Math.min(to, w.end);
    if (b > a) cuts.push({ start: a, end: b });
  }
  cuts.sort((x, y) => x.start - y.start || x.end - y.end);
  let total = 0;
  let curEnd = -Infinity;
  for (const c of cuts) {
    if (c.start >= curEnd) {
      total += c.end - c.start;
      curEnd = c.end;
    } else if (c.end > curEnd) {
      total += c.end - curEnd;
      curEnd = c.end;
    }
  }
  return total;
}

function secondsInWindows(fromSec: number, toSec: number, windows: SecWindow[]): number {
  let total = secondsInUnion(fromSec, toSec, windows);
  total += secondsInUnion(fromSec + 86400, toSec + 86400, windows);
  return total;
}

export function buildDayWindows(input: {
  settings: TimeSettings;
  shift: { start: string; end: string } | null;
  planned: { start: string; end: string }[];
  exception: { heureDebut: string | null; heureFin: string | null; horsPlage: boolean } | null;
}): {
  windows: SecWindow[];
  arrivalStart: number;
  arrivalEnd: number;
  windowEnd: number;
  crossesMidnight: boolean;
  theoreticalSec: number;
} {
  const planned = input.planned.map((p) => ({
    start: parseHHMM(p.start),
    end: endExclusive(p.start, p.end),
  }));
  let main: SecWindow;
  let arrivalStart: number;
  let arrivalEnd: number;
  let theoretical: number;
  if (input.shift) {
    const start = parseHHMM(input.shift.start);
    const end = endExclusive(input.shift.start, input.shift.end);
    main = { start, end };
    arrivalStart = start;
    arrivalEnd = start + 2 * 3600;
    theoretical = end - start;
  } else {
    main = {
      start: parseHHMM(input.settings.debutComptage),
      end: parseHHMM(input.settings.finComptage),
    };
    arrivalStart = main.start;
    arrivalEnd = parseHHMM(input.settings.limiteArrivee);
    theoretical = input.settings.dureeTheoriqueSec;
  }
  const windows = [main, ...planned];
  if (input.exception?.horsPlage) {
    if (input.exception.heureDebut && input.exception.heureFin) {
      windows.push({
        start: parseHHMM(input.exception.heureDebut),
        end: endExclusive(input.exception.heureDebut, input.exception.heureFin),
      });
    } else {
      windows.push({ start: 0, end: 86400 });
    }
  }
  let extra = 0;
  for (const p of planned) {
    const overlap = secondsInUnion(p.start, p.end, [main]);
    extra += Math.max(0, p.end - p.start - overlap);
  }
  return {
    windows,
    arrivalStart,
    arrivalEnd,
    windowEnd: main.end,
    crossesMidnight: main.end > 86400,
    theoreticalSec: theoretical + extra,
  };
}

export function statutArrivee(
  loginSec: number,
  spec: { arrivalStart: number; arrivalEnd: number; windowEnd: number; crossesMidnight: boolean },
): Arrival {
  if (!spec.crossesMidnight) {
    if (loginSec < spec.arrivalStart) return "avant_plage";
    if (loginSec <= spec.arrivalEnd) return "a_l_heure";
    return "retard";
  }
  const morningEnd = spec.windowEnd - 86400;
  const arrivalMorningEnd = Math.max(0, spec.arrivalEnd - 86400);
  if (loginSec >= spec.arrivalStart) {
    return loginSec <= spec.arrivalEnd ? "a_l_heure" : "retard";
  }
  if (loginSec <= morningEnd) {
    return loginSec <= arrivalMorningEnd ? "a_l_heure" : "retard";
  }
  return "avant_plage";
}

export function creditHeartbeat(input: {
  lastBeat: Date | null;
  now: Date;
  active: boolean;
  idleLimitSec: number;
  windows: SecWindow[];
  ignoreIdle: boolean;
  maxIdleCreditSec: number;
}): { seconds: number; motif: "premier_pointage" | "compte" | "inactivite" | "hors_plage" | "exception" } {
  if (!input.lastBeat) return { seconds: 0, motif: "premier_pointage" };
  const prev = dakarParts(input.lastBeat);
  const now = dakarParts(input.now);
  if (prev.date !== now.date) return { seconds: 0, motif: "premier_pointage" };
  let delta = now.seconds - prev.seconds;
  if (delta <= 0) return { seconds: 0, motif: "inactivite" };
  const idleBlocked = !input.active || delta > input.idleLimitSec;
  if (idleBlocked && !input.ignoreIdle) return { seconds: 0, motif: "inactivite" };
  if (idleBlocked && input.ignoreIdle && delta > input.maxIdleCreditSec) {
    return { seconds: 0, motif: "inactivite" };
  }
  const fromSec = now.seconds - delta;
  const seconds =
    fromSec < 0
      ? secondsInWindows(0, now.seconds, input.windows)
      : secondsInWindows(fromSec, now.seconds, input.windows);
  if (seconds <= 0) return { seconds: 0, motif: "hors_plage" };
  return { seconds, motif: idleBlocked ? "exception" : "compte" };
}

export function avisFiche(input: {
  minutesPrevues: number;
  minutesImputees: number;
  secondesPresence: number;
  secondesTheoriques: number;
}): AvisFiche {
  const presence = input.secondesTheoriques > 0 ? input.secondesPresence / input.secondesTheoriques : 0;
  const charge = input.minutesPrevues > 0 ? input.minutesImputees / input.minutesPrevues : 1;
  if (input.secondesTheoriques > 0 && presence < SEUIL_PRESENCE_ASSIDUITE) return "assiduite";
  if (input.minutesPrevues > 0 && charge > SEUIL_CHARGE_ALLEGER) return "alleger";
  if (input.minutesPrevues > 0 && charge < SEUIL_CHARGE_ALOURDIR && presence >= SEUIL_PRESENCE_ALOURDIR) {
    return "alourdir";
  }
  return "equilibree";
}

export function avisUnite(items: AvisFiche[]): AvisUnite {
  if (items.length === 0) return "effectif_suffisant";
  const surcharge = items.filter((i) => i === "alleger").length / items.length;
  const sousCharge = items.filter((i) => i === "alourdir").length / items.length;
  if (surcharge >= SEUIL_PART_RECRUTER && sousCharge < SEUIL_PART_REAFFECTER) return "recruter";
  if (surcharge >= SEUIL_PART_REAFFECTER && sousCharge >= SEUIL_PART_REAFFECTER) return "reaffecter";
  return "effectif_suffisant";
}

export function validateStandardHours(debut: string, limite: string, fin: string): void {
  const d = parseHHMM(debut);
  const l = parseHHMM(limite);
  const f = parseHHMM(fin);
  if (d < 6 * 3600 || d > 8 * 3600) throw new Error("Le début de comptage doit rester entre 06:00 et 08:00.");
  if (l < d || l > 8 * 3600) throw new Error("La limite d'arrivée doit rester entre le début de comptage et 08:00.");
  if (f < 15 * 3600 || f > 18 * 3600) throw new Error("La fin de comptage doit rester entre 15:00 et 18:00.");
  if (f <= l) throw new Error("La fin de comptage doit être postérieure à la limite d'arrivée.");
}
