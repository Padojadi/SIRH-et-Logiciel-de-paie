import { all, get, run, transaction } from "./db";
import { addDays, dakarToday, eachDate, isWeekday, monthStart, weekday } from "./dates";
import { avisFiche, avisUnite, parseHHMM, type AvisFiche, type AvisUnite } from "./time-engine";
import { audit, timeSettings } from "./settings";
import type { SessionUser } from "./auth";

export type OrgUnit = { id: number; parent_id: number | null; type: string; code: string; name: string };
export type AgentRow = {
  id: number;
  matricule: string;
  prenom: string;
  nom: string;
  email: string | null;
  date_embauche: string | null;
  statut: string;
  org_unit_id: number | null;
  fiche_id: number | null;
  convention_id: number | null;
  poste: string;
  salaire_base: number;
  taux_journalier: number;
  parts_fiscales: number;
  trimf_double: number;
  iban: string;
  actif: number;
  org_nom?: string;
  fiche_titre?: string;
  convention_nom?: string;
};

export function listOrg(): OrgUnit[] {
  return all<OrgUnit>("SELECT * FROM org_units ORDER BY code");
}

export function descendants(rootId: number, units = listOrg()): number[] {
  const ids = [rootId];
  let changed = true;
  while (changed) {
    changed = false;
    for (const unit of units) {
      if (unit.parent_id && ids.includes(unit.parent_id) && !ids.includes(unit.id)) {
        ids.push(unit.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function createOrg(input: { parentId: number | null; type: string; code: string; name: string }, userId: number): void {
  if (!/^[A-Z0-9-]{2,12}$/.test(input.code)) throw new Error("Le code d'unité doit contenir 2 à 12 lettres ou chiffres.");
  run("INSERT INTO org_units (parent_id, type, code, name) VALUES (?, ?, ?, ?)", [
    input.parentId,
    input.type,
    input.code.toUpperCase(),
    input.name.trim(),
  ]);
  audit(userId, "organisation", `Création de ${input.code}`);
}

export function listAgents(): AgentRow[] {
  return all<AgentRow>(`
    SELECT a.*, o.name AS org_nom, f.title AS fiche_titre, c.name AS convention_nom
    FROM agents a
    LEFT JOIN org_units o ON o.id = a.org_unit_id
    LEFT JOIN fiches f ON f.id = a.fiche_id
    LEFT JOIN conventions c ON c.id = a.convention_id
    ORDER BY a.nom, a.prenom
  `);
}

export function getAgent(id: number): AgentRow | undefined {
  return get<AgentRow>(`
    SELECT a.*, o.name AS org_nom, f.title AS fiche_titre, c.name AS convention_nom
    FROM agents a
    LEFT JOIN org_units o ON o.id = a.org_unit_id
    LEFT JOIN fiches f ON f.id = a.fiche_id
    LEFT JOIN conventions c ON c.id = a.convention_id
    WHERE a.id = ?
  `, [id]);
}

export function saveAgent(input: Omit<AgentRow, "org_nom" | "fiche_titre" | "convention_nom" | "id" | "matricule"> & { id?: number }, userId: number): number {
  if (!input.prenom.trim() || !input.nom.trim()) throw new Error("Le nom et le prénom sont obligatoires.");
  if (input.id) {
    run(
      `UPDATE agents SET prenom=?, nom=?, email=?, date_embauche=?, statut=?, org_unit_id=?, fiche_id=?, convention_id=?, poste=?, salaire_base=?, taux_journalier=?, parts_fiscales=?, trimf_double=?, iban=?, actif=? WHERE id=?`,
      [input.prenom.trim(), input.nom.trim(), input.email, input.date_embauche, input.statut, input.org_unit_id, input.fiche_id, input.convention_id, input.poste, input.salaire_base, input.taux_journalier, input.parts_fiscales, input.trimf_double, input.iban, input.actif, input.id],
    );
    audit(userId, "agent", `Mise à jour de l'agent ${input.id}`);
    return input.id;
  }
  const count = get<{ n: number }>("SELECT COUNT(*) AS n FROM agents");
  const matricule = `AG${String(Number(count?.n ?? 0) + 1).padStart(3, "0")}`;
  const id = run(
    `INSERT INTO agents (matricule, prenom, nom, email, date_embauche, statut, org_unit_id, fiche_id, convention_id, poste, salaire_base, taux_journalier, parts_fiscales, trimf_double, iban, actif)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [matricule, input.prenom.trim(), input.nom.trim(), input.email, input.date_embauche, input.statut, input.org_unit_id, input.fiche_id, input.convention_id, input.poste, input.salaire_base, input.taux_journalier, input.parts_fiscales, input.trimf_double, input.iban, input.actif],
  );
  audit(userId, "agent", `Création de ${matricule}`);
  return id;
}

export type FicheTask = { id?: number; title: string; description: string; minutes_par_jour: number };
export type Fiche = {
  id: number;
  code: string;
  title: string;
  org_unit_id: number | null;
  mission: string;
  profil: string;
  status: string;
  version: number;
  org_nom?: string;
  taches?: FicheTask[];
};

export function listFiches(): Fiche[] {
  return all<Fiche>(`
    SELECT f.*, o.name AS org_nom,
      (SELECT COALESCE(SUM(minutes_par_jour), 0) FROM fiche_taches t WHERE t.fiche_id = f.id) AS minutes
    FROM fiches f LEFT JOIN org_units o ON o.id = f.org_unit_id
    ORDER BY f.code
  `);
}

export function getFiche(id: number): Fiche | undefined {
  const fiche = get<Fiche>("SELECT f.*, o.name AS org_nom FROM fiches f LEFT JOIN org_units o ON o.id = f.org_unit_id WHERE f.id = ?", [id]);
  if (!fiche) return undefined;
  fiche.taches = all<FicheTask>("SELECT id, title, description, minutes_par_jour FROM fiche_taches WHERE fiche_id = ? ORDER BY ordre", [id]);
  return fiche;
}

export function saveFiche(input: { id?: number; code: string; title: string; orgUnitId: number | null; mission: string; profil: string; status: string; taches: FicheTask[] }, userId: number): number {
  if (!input.title.trim() || !input.mission.trim()) throw new Error("Le titre et la mission sont obligatoires.");
  if (!input.taches.length) throw new Error("La fiche doit contenir au moins une tâche.");
  const now = new Date().toISOString();
  return transaction(() => {
    let id = input.id ?? 0;
    if (id) {
      run("UPDATE fiches SET code=?, title=?, org_unit_id=?, mission=?, profil=?, status=?, version=version+1, updated_at=? WHERE id=?", [
        input.code, input.title.trim(), input.orgUnitId, input.mission.trim(), input.profil.trim(), input.status, now, id,
      ]);
      run("DELETE FROM fiche_taches WHERE fiche_id = ?", [id]);
    } else {
      id = run(
        "INSERT INTO fiches (code, title, org_unit_id, mission, profil, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [input.code, input.title.trim(), input.orgUnitId, input.mission.trim(), input.profil.trim(), input.status, now, now],
      );
    }
    input.taches.forEach((task, index) => {
      if (!task.title.trim() || task.minutes_par_jour <= 0) throw new Error("Chaque tâche a un intitulé et une durée positive.");
      run("INSERT INTO fiche_taches (fiche_id, title, description, minutes_par_jour, ordre) VALUES (?, ?, ?, ?, ?)", [
        id, task.title.trim(), task.description.trim(), Math.round(task.minutes_par_jour), index + 1,
      ]);
    });
    audit(userId, "fiche", `Fiche ${input.code}`);
    return id;
  });
}

export type AgentEval = {
  id: number;
  matricule: string;
  nom: string;
  poste: string;
  statut: string;
  orgId: number;
  orgNom: string;
  ficheId: number;
  ficheTitre: string;
  jours: number;
  minutesPrevues: number;
  minutesImputees: number;
  secondesPresence: number;
  secondesTheoriques: number;
  avis: AvisFiche;
};

export type UniteEval = {
  id: number;
  parentId: number | null;
  type: string;
  code: string;
  nom: string;
  effectif: number;
  avis: AvisUnite;
  surcharge: number;
  sousCharge: number;
};

function duration(start: string, end: string): number {
  const s = parseHHMM(start);
  let e = parseHHMM(end);
  if (e <= s) e += 86400;
  return e - s;
}

export function defaultEvalRange(): { from: string; to: string } {
  const today = dakarToday();
  const yesterday = addDays(today, -1);
  let from = monthStart(today);
  if (from > yesterday) from = monthStart(yesterday);
  return { from, to: today };
}

export function evaluer(from: string, to: string, scopeOrgId?: number | null): { agents: AgentEval[]; unites: UniteEval[] } {
  const units = listOrg();
  const allowed = scopeOrgId ? new Set(descendants(scopeOrgId, units)) : null;
  const settings = timeSettings();
  const agents = listAgents().filter((agent) => agent.actif && agent.fiche_id && agent.org_unit_id && (!allowed || allowed.has(agent.org_unit_id)));
  const tasks = all<{ fiche_id: number; minutes: number }>(
    "SELECT fiche_id, SUM(minutes_par_jour) AS minutes FROM fiche_taches GROUP BY fiche_id",
  );
  const minutesByFiche = new Map(tasks.map((task) => [task.fiche_id, Number(task.minutes)]));
  const shifts = all<{ agent_id: number; start_time: string; end_time: string; jours: string; date_debut: string | null; date_fin: string | null }>(
    `SELECT a.agent_id, s.start_time, s.end_time, s.jours, a.date_debut, a.date_fin
     FROM agent_shifts a JOIN shifts s ON s.id = a.shift_id`,
  );
  const plans = all<{ agent_id: number; date: string; start_time: string; end_time: string }>(
    "SELECT agent_id, date, start_time, end_time FROM travaux_planifies WHERE date >= ? AND date <= ?",
    [from, to],
  );
  const journees = all<{ agent_id: number; date: string; secondes: number }>(
    "SELECT agent_id, date, secondes FROM journees WHERE date >= ? AND date <= ?",
    [from, to],
  );
  const tranches = all<{ agent_id: number; secondes: number; fiche_id: number | null }>(
    `SELECT t.agent_id, t.secondes, ft.fiche_id
     FROM tranches_temps t LEFT JOIN fiche_taches ft ON ft.id = t.tache_id
     WHERE t.date >= ? AND t.date <= ?`,
    [from, to],
  );
  const dates = eachDate(from, to);
  const result: AgentEval[] = [];
  for (const agent of agents) {
    const ficheMinutes = minutesByFiche.get(agent.fiche_id!) ?? 0;
    const ownShifts = shifts.filter((shift) => shift.agent_id === agent.id);
    const ownPlans = plans.filter((plan) => plan.agent_id === agent.id);
    const ownDays = new Set(journees.filter((day) => day.agent_id === agent.id).map((day) => day.date));
    const workDays: string[] = [];
    let theoretical = 0;
    for (const date of dates) {
      const shift = ownShifts.find((item) => {
        if (item.date_debut && date < item.date_debut) return false;
        if (item.date_fin && date > item.date_fin) return false;
        return item.jours.split(",").map(Number).includes(weekday(date));
      });
      const dayPlans = ownPlans.filter((plan) => plan.date === date);
      const worked = ownDays.has(date);
      let counted = false;
      if (agent.statut === "vacataire") counted = worked || dayPlans.length > 0;
      else if (shift) counted = true;
      else if (isWeekday(date) || dayPlans.length > 0) counted = true;
      if (!counted) continue;
      workDays.push(date);
      if (agent.statut === "vacataire") theoretical += ficheMinutes * 60;
      else if (shift) theoretical += duration(shift.start_time, shift.end_time);
      else theoretical += settings.dureeTheoriqueSec;
      const main = shift
        ? { start: parseHHMM(shift.start_time), end: duration(shift.start_time, shift.end_time) + parseHHMM(shift.start_time) }
        : { start: parseHHMM(settings.debutComptage), end: parseHHMM(settings.finComptage) };
      for (const plan of dayPlans) {
        const start = parseHHMM(plan.start_time);
        const span = duration(plan.start_time, plan.end_time);
        const overlapStart = Math.max(start, main.start);
        const overlapEnd = Math.min(start + span, main.end);
        const overlap = Math.max(0, overlapEnd - overlapStart);
        theoretical += Math.max(0, span - overlap);
      }
    }
    if (workDays.length === 0) continue;
    const presence = journees.filter((day) => day.agent_id === agent.id && workDays.includes(day.date)).reduce((sum, day) => sum + day.secondes, 0);
    const imputed = tranches
      .filter((slice) => slice.agent_id === agent.id && slice.fiche_id === agent.fiche_id)
      .reduce((sum, slice) => sum + slice.secondes, 0);
    result.push({
      id: agent.id,
      matricule: agent.matricule,
      nom: `${agent.prenom} ${agent.nom}`,
      poste: agent.poste,
      statut: agent.statut,
      orgId: agent.org_unit_id!,
      orgNom: agent.org_nom ?? "",
      ficheId: agent.fiche_id!,
      ficheTitre: agent.fiche_titre ?? "",
      jours: workDays.length,
      minutesPrevues: ficheMinutes * workDays.length,
      minutesImputees: Math.round(imputed / 60),
      secondesPresence: presence,
      secondesTheoriques: theoretical,
      avis: avisFiche({
        minutesPrevues: ficheMinutes * workDays.length,
        minutesImputees: imputed / 60,
        secondesPresence: presence,
        secondesTheoriques: theoretical,
      }),
    });
  }
  const unites: UniteEval[] = units
    .filter((unit) => !allowed || allowed.has(unit.id))
    .map((unit) => {
      const ids = new Set(descendants(unit.id, units));
      const people = result.filter((agent) => ids.has(agent.orgId));
      const surcharge = people.filter((agent) => agent.avis === "alleger").length;
      const sousCharge = people.filter((agent) => agent.avis === "alourdir").length;
      return {
        id: unit.id,
        parentId: unit.parent_id,
        type: unit.type,
        code: unit.code,
        nom: unit.name,
        effectif: people.length,
        avis: avisUnite(people.map((agent) => agent.avis)),
        surcharge,
        sousCharge,
      };
    })
    .filter((unit) => unit.effectif > 0);
  return { agents: result, unites };
}

export function scopeFor(user: SessionUser): number | null {
  if (user.role !== "responsable" || !user.agent_id) return null;
  return getAgent(user.agent_id)?.org_unit_id ?? null;
}
