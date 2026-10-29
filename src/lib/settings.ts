import { dakarToday } from "./dates";
import { all, run } from "./db";
import type { TimeSettings } from "./time-engine";

export function settings(): Record<string, string> {
  const rows = all<{ cle: string; valeur: string }>("SELECT cle, valeur FROM parametres");
  return Object.fromEntries(rows.map((row) => [row.cle, row.valeur]));
}

export function setting(key: string, fallback = ""): string {
  return settings()[key] ?? fallback;
}

export function saveSettings(values: Record<string, string>): void {
  for (const [cle, valeur] of Object.entries(values)) {
    run("INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur", [cle, valeur]);
  }
}

export function timeSettings(): TimeSettings {
  const data = settings();
  return {
    debutComptage: data.debut_comptage || "06:00",
    limiteArrivee: data.limite_arrivee || "08:00",
    finComptage: data.fin_comptage || "17:00",
    dureeTheoriqueSec: Number(data.duree_theorique_heures || "8") * 3600,
  };
}

export function framework(): string {
  return setting("referentiel", "SYSCOHADA");
}

export function exercice(): { from: string; to: string } {
  const today = dakarToday();
  const fin = setting("exercice_fin", today);
  return {
    from: setting("exercice_debut", `${today.slice(0, 4)}-01-01`),
    to: fin < today ? fin : today,
  };
}

export function audit(userId: number | null, action: string, detail: string): void {
  run("INSERT INTO audit (user_id, action, detail, created_at) VALUES (?, ?, ?, ?)", [
    userId,
    action,
    detail,
    new Date().toISOString(),
  ]);
}
