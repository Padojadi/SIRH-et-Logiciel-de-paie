import type { SessionUser } from "./auth";
import { dakarParts, dakarToday, weekday } from "./dates";
import { all, get, run, transaction } from "./db";
import { descendants, getAgent, listOrg } from "./hr-store";
import { audit, timeSettings } from "./settings";
import {
  IDLE_LIMIT_SEC,
  MAX_EXCEPTION_GAP_SEC,
  buildDayWindows,
  creditHeartbeat,
  statutArrivee,
} from "./time-engine";

export type ExceptionRow = {
  id: number;
  nom: string;
  motif: string;
  active: number;
  compter_hors_plage: number;
  compter_malgre_inactivite: number;
  portee: string;
  org_unit_id: number | null;
  agent_id: number | null;
  date_debut: string | null;
  date_fin: string | null;
  heure_debut: string | null;
  heure_fin: string | null;
  jours: string;
  notes: string;
};

export type ShiftRow = { id: number; name: string; start_time: string; end_time: string; jours: string; org_unit_id: number | null };
export type PlanRow = { id: number; agent_id: number; date: string; start_time: string; end_time: string; tache_id: number | null; libelle: string; agent_nom?: string };

function activeException(agentId: number, orgUnitId: number | null, date: string, seconds: number): ExceptionRow | undefined {
  const units = listOrg();
  return all<ExceptionRow>("SELECT * FROM exceptions_temps WHERE active = 1").find((item) => {
    if (item.date_debut && date < item.date_debut) return false;
    if (item.date_fin && date > item.date_fin) return false;
    if (item.portee === "agent" && item.agent_id !== agentId) return false;
    if (item.portee === "unite") {
      if (!item.org_unit_id || !orgUnitId || !descendants(item.org_unit_id, units).includes(orgUnitId)) return false;
    }
    if (item.jours && !item.jours.split(",").map(Number).includes(weekday(date))) return false;
    if (item.heure_debut && item.heure_fin) {
      const start = Number(item.heure_debut.slice(0, 2)) * 3600 + Number(item.heure_debut.slice(3, 5)) * 60;
      let end = Number(item.heure_fin.slice(0, 2)) * 3600 + Number(item.heure_fin.slice(3, 5)) * 60;
      if (end <= start) end += 86400;
      const inside = (seconds >= start && seconds <= end) || (seconds + 86400 >= start && seconds + 86400 <= end);
      if (!inside) return false;
    }
    return true;
  });
}

function context(agentId: number, date: string, seconds: number) {
  const agent = getAgent(agentId);
  if (!agent) throw new Error("Agent introuvable.");
  const shift = get<{ start_time: string; end_time: string; jours: string }>(
    `SELECT s.start_time, s.end_time, s.jours
     FROM agent_shifts a JOIN shifts s ON s.id = a.shift_id
     WHERE a.agent_id = ? AND (a.date_debut IS NULL OR a.date_debut <= ?) AND (a.date_fin IS NULL OR a.date_fin >= ?)`,
    [agentId, date, date],
  );
  const shiftToday = shift && shift.jours.split(",").map(Number).includes(weekday(date)) ? shift : null;
  const planned = all<{ start_time: string; end_time: string }>(
    "SELECT start_time, end_time FROM travaux_planifies WHERE agent_id = ? AND date = ?",
    [agentId, date],
  );
  const exception = activeException(agentId, agent.org_unit_id, date, seconds);
  const windows = buildDayWindows({
    settings: timeSettings(),
    shift: shiftToday ? { start: shiftToday.start_time, end: shiftToday.end_time } : null,
    planned: planned.map((item) => ({ start: item.start_time, end: item.end_time })),
    exception: exception
      ? { heureDebut: exception.heure_debut, heureFin: exception.heure_fin, horsPlage: exception.compter_hors_plage === 1 }
      : null,
  });
  return { agent, windows, exception };
}

export function etatJournee(agentId: number, now = new Date()) {
  const parts = dakarParts(now);
  const ctx = context(agentId, parts.date, parts.seconds);
  const journee = get<{ secondes: number; statut_arrivee: string | null; first_login_at: string | null }>(
    "SELECT secondes, statut_arrivee, first_login_at FROM journees WHERE agent_id = ? AND date = ?",
    [agentId, parts.date],
  );
  const taches = all<{ id: number; title: string; minutes_par_jour: number; secondes: number }>(
    `SELECT t.id, t.title, t.minutes_par_jour, COALESCE(SUM(tr.secondes), 0) AS secondes
     FROM fiche_taches t
     LEFT JOIN tranches_temps tr ON tr.tache_id = t.id AND tr.agent_id = ? AND tr.date = ?
     WHERE t.fiche_id = ?
     GROUP BY t.id
     ORDER BY t.ordre`,
    [agentId, parts.date, ctx.agent.fiche_id ?? 0],
  );
  const inside = ctx.windows.windows.some((window) => {
    const t = parts.seconds;
    return (t >= window.start && t < window.end) || (t + 86400 >= window.start && t + 86400 < window.end);
  });
  return {
    date: parts.date,
    secondes: journee?.secondes ?? 0,
    statutArrivee: journee?.statut_arrivee ?? null,
    commencee: Boolean(journee?.first_login_at),
    dansLaPlage: inside,
    exception: ctx.exception ? ctx.exception.nom : null,
    fiche: ctx.agent.fiche_titre ?? "",
    poste: ctx.agent.poste,
    taches,
  };
}

export function enregistrerBattement(agentId: number, input: { active: boolean; tacheId: number | null; now?: Date }, userId: number | null): ReturnType<typeof etatJournee> {
  const now = input.now ?? new Date();
  const parts = dakarParts(now);
  const ctx = context(agentId, parts.date, parts.seconds);
  if (input.tacheId) {
    const task = get<{ id: number }>("SELECT id FROM fiche_taches WHERE id = ? AND fiche_id = ?", [input.tacheId, ctx.agent.fiche_id ?? 0]);
    if (!task) throw new Error("Cette tâche n'appartient pas à la fiche de poste de l'agent.");
  }
  transaction(() => {
    let journee = get<{ id: number; last_beat_at: string | null; secondes: number }>(
      "SELECT id, last_beat_at, secondes FROM journees WHERE agent_id = ? AND date = ?",
      [agentId, parts.date],
    );
    if (!journee) {
      const arrival = statutArrivee(parts.seconds, ctx.windows);
      const id = run(
        "INSERT INTO journees (agent_id, date, first_login_at, last_beat_at, statut_arrivee, secondes) VALUES (?, ?, ?, ?, ?, 0)",
        [agentId, parts.date, now.toISOString(), now.toISOString(), arrival],
      );
      journee = { id, last_beat_at: now.toISOString(), secondes: 0 };
      if (userId) audit(userId, "prise_de_poste", `${ctx.agent.matricule} ${parts.date}`);
    }
    const credit = creditHeartbeat({
      lastBeat: journee.last_beat_at ? new Date(journee.last_beat_at) : null,
      now,
      active: input.active,
      idleLimitSec: IDLE_LIMIT_SEC,
      windows: ctx.windows.windows,
      ignoreIdle: ctx.exception?.compter_malgre_inactivite === 1,
      maxIdleCreditSec: MAX_EXCEPTION_GAP_SEC,
    });
    if (credit.seconds > 0) {
      const debut = new Date(now.getTime() - credit.seconds * 1000).toISOString();
      run(
        "INSERT INTO tranches_temps (agent_id, date, tache_id, debut, fin, secondes, source, exception_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [agentId, parts.date, input.tacheId, debut, now.toISOString(), credit.seconds, credit.motif, ctx.exception?.id ?? null],
      );
      run("UPDATE journees SET secondes = secondes + ? WHERE id = ?", [credit.seconds, journee.id]);
    }
    run("UPDATE journees SET last_beat_at = ? WHERE id = ?", [now.toISOString(), journee.id]);
  });
  return etatJournee(agentId, now);
}

export function regulariser(input: { agentId: number; date: string; tacheId: number | null; secondes: number; motif: string }, userId: number): void {
  if (input.secondes <= 0 || input.secondes > 12 * 3600) throw new Error("La durée à régulariser doit être comprise entre une seconde et 12 heures.");
  const agent = getAgent(input.agentId);
  if (!agent) throw new Error("Agent introuvable.");
  transaction(() => {
    const existing = get<{ id: number }>("SELECT id FROM journees WHERE agent_id = ? AND date = ?", [input.agentId, input.date]);
    if (!existing) {
      run(
        "INSERT INTO journees (agent_id, date, first_login_at, last_beat_at, statut_arrivee, secondes) VALUES (?, ?, ?, ?, 'a_l_heure', 0)",
        [input.agentId, input.date, `${input.date}T08:00:00.000Z`, `${input.date}T08:00:00.000Z`],
      );
    }
    run(
      "INSERT INTO tranches_temps (agent_id, date, tache_id, debut, fin, secondes, source) VALUES (?, ?, ?, ?, ?, ?, 'regularisation')",
      [input.agentId, input.date, input.tacheId, `${input.date}T08:00:00.000Z`, `${input.date}T08:00:00.000Z`, input.secondes],
    );
    run("UPDATE journees SET secondes = secondes + ? WHERE agent_id = ? AND date = ?", [input.secondes, input.agentId, input.date]);
    audit(userId, "regularisation", `${agent.matricule} ${input.date} ${input.motif}`);
  });
}

export function journeesPeriode(from: string, to: string) {
  return all<{
    id: number;
    agent_id: number;
    date: string;
    statut_arrivee: string | null;
    secondes: number;
    prenom: string;
    nom: string;
    matricule: string;
    poste: string;
    org_nom: string | null;
  }>(
    `SELECT j.*, a.prenom, a.nom, a.matricule, a.poste, o.name AS org_nom
     FROM journees j JOIN agents a ON a.id = j.agent_id
     LEFT JOIN org_units o ON o.id = a.org_unit_id
     WHERE j.date >= ? AND j.date <= ?
     ORDER BY j.date DESC, a.nom`,
    [from, to],
  );
}

export function listExceptions(): ExceptionRow[] {
  return all<ExceptionRow>("SELECT * FROM exceptions_temps ORDER BY active DESC, nom");
}

export function saveException(input: Omit<ExceptionRow, "id"> & { id?: number }, userId: number): void {
  if (!input.nom.trim()) throw new Error("Le nom de l'exception est obligatoire.");
  const values = [
    input.nom.trim(),
    input.motif,
    input.active ? 1 : 0,
    input.compter_hors_plage ? 1 : 0,
    input.compter_malgre_inactivite ? 1 : 0,
    input.portee,
    input.org_unit_id,
    input.agent_id,
    input.date_debut || null,
    input.date_fin || null,
    input.heure_debut || null,
    input.heure_fin || null,
    input.jours,
    input.notes ?? "",
  ];
  if (input.id) {
    run(
      `UPDATE exceptions_temps SET nom=?, motif=?, active=?, compter_hors_plage=?, compter_malgre_inactivite=?, portee=?, org_unit_id=?, agent_id=?, date_debut=?, date_fin=?, heure_debut=?, heure_fin=?, jours=?, notes=? WHERE id=?`,
      [...values, input.id],
    );
  } else {
    run(
      `INSERT INTO exceptions_temps (nom, motif, active, compter_hors_plage, compter_malgre_inactivite, portee, org_unit_id, agent_id, date_debut, date_fin, heure_debut, heure_fin, jours, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values,
    );
  }
  audit(userId, "exception_temps", input.nom);
}

export function toggleException(id: number, userId: number): void {
  run("UPDATE exceptions_temps SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?", [id]);
  audit(userId, "exception_temps", `Bascule ${id}`);
}

export function listShifts(): ShiftRow[] {
  return all<ShiftRow>("SELECT * FROM shifts ORDER BY name");
}

export function saveShift(input: ShiftRow, userId: number): void {
  if (input.id) {
    run("UPDATE shifts SET name=?, start_time=?, end_time=?, jours=?, org_unit_id=? WHERE id=?", [
      input.name, input.start_time, input.end_time, input.jours, input.org_unit_id, input.id,
    ]);
  } else {
    run("INSERT INTO shifts (name, start_time, end_time, jours, org_unit_id) VALUES (?, ?, ?, ?, ?)", [
      input.name, input.start_time, input.end_time, input.jours, input.org_unit_id,
    ]);
  }
  audit(userId, "shift", input.name);
}

export function assignShift(agentId: number, shiftId: number, debut: string, userId: number): void {
  run("INSERT INTO agent_shifts (agent_id, shift_id, date_debut) VALUES (?, ?, ?)", [agentId, shiftId, debut]);
  audit(userId, "shift", `Affectation ${shiftId} à l'agent ${agentId}`);
}

export function listAssignments() {
  return all<{ id: number; agent_id: number; shift_id: number; date_debut: string | null; prenom: string; nom: string; shift_nom: string }>(
    `SELECT a.id, a.agent_id, a.shift_id, a.date_debut, ag.prenom, ag.nom, s.name AS shift_nom
     FROM agent_shifts a JOIN agents ag ON ag.id = a.agent_id JOIN shifts s ON s.id = a.shift_id
     ORDER BY ag.nom`,
  );
}

export function listPlans(): PlanRow[] {
  return all<PlanRow>(
    `SELECT p.*, a.prenom || ' ' || a.nom AS agent_nom
     FROM travaux_planifies p JOIN agents a ON a.id = p.agent_id
     ORDER BY p.date DESC`,
  );
}

export function savePlan(input: Omit<PlanRow, "id" | "agent_nom">, userId: number): void {
  run(
    "INSERT INTO travaux_planifies (agent_id, date, start_time, end_time, tache_id, libelle) VALUES (?, ?, ?, ?, ?, ?)",
    [input.agent_id, input.date, input.start_time, input.end_time, input.tache_id, input.libelle],
  );
  audit(userId, "travail_planifie", `${input.date} ${input.libelle}`);
}

export function removePlan(id: number): void {
  run("DELETE FROM travaux_planifies WHERE id = ?", [id]);
}

export function todayIso(): string {
  return dakarToday();
}
