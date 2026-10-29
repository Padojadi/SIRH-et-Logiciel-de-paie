import type { BulletinResult, ConventionConfig } from "./payroll-engine";
import { SENEGAL_2026, computeBulletin, tranchesMontantTexte, tranchesTauxTexte } from "./payroll-engine";
import { poster } from "./books-store";
import { all, get, run, transaction } from "./db";
import { franc } from "./format";
import { audit } from "./settings";
import type { SessionUser } from "./auth";

export type ConventionRow = { id: number; name: string; description: string; config_json: string; active: number };
export type PeriodeRow = { id: number; mois: string; statut: string; ecriture_id: number | null; created_at: string };

export function listConventions(): ConventionRow[] {
  return all<ConventionRow>("SELECT * FROM conventions ORDER BY name");
}

export function getConvention(id: number): (ConventionRow & { config: ConventionConfig }) | undefined {
  const row = get<ConventionRow>("SELECT * FROM conventions WHERE id = ?", [id]);
  if (!row) return undefined;
  return { ...row, config: JSON.parse(row.config_json) as ConventionConfig };
}

export function saveConvention(input: { id?: number; name: string; description: string; config: ConventionConfig }, userId: number): number {
  const json = JSON.stringify(input.config);
  if (input.id) {
    run("UPDATE conventions SET name = ?, description = ?, config_json = ? WHERE id = ?", [input.name.trim(), input.description.trim(), json, input.id]);
    audit(userId, "convention", input.name);
    return input.id;
  }
  const id = run("INSERT INTO conventions (name, description, config_json) VALUES (?, ?, ?)", [input.name.trim(), input.description.trim(), json]);
  audit(userId, "convention", input.name);
  return id;
}

export function defaultConvention(): ConventionConfig {
  return structuredClone(SENEGAL_2026);
}

export { tranchesMontantTexte, tranchesTauxTexte };

export function listPeriodes(): PeriodeRow[] {
  return all<PeriodeRow>("SELECT * FROM periodes_paie ORDER BY mois DESC");
}

export function getPeriode(id: number) {
  const periode = get<PeriodeRow>("SELECT * FROM periodes_paie WHERE id = ?", [id]);
  if (!periode) return undefined;
  const bulletins = all<{
    id: number; agent_id: number; prenom: string; nom: string; matricule: string; poste: string; statut: string;
    brut: number; net: number; charges_salariales: number; charges_patronales: number; org_nom: string | null; detail_json: string;
  }>(`
    SELECT b.*, a.prenom, a.nom, a.matricule, a.poste, a.statut, o.name AS org_nom
    FROM bulletins b JOIN agents a ON a.id = b.agent_id
    LEFT JOIN org_units o ON o.id = a.org_unit_id
    WHERE b.periode_id = ? ORDER BY a.nom
  `, [id]);
  return { periode, bulletins };
}

export function getBulletin(id: number) {
  return get<{
    id: number; periode_id: number; agent_id: number; prenom: string; nom: string; matricule: string; poste: string;
    statut: string; parts_fiscales: number; org_nom: string | null; convention: string; mois: string; detail_json: string;
    brut: number; net: number; charges_salariales: number; charges_patronales: number;
  }>(`
    SELECT b.*, a.prenom, a.nom, a.matricule, a.poste, a.statut, a.parts_fiscales, o.name AS org_nom,
           c.name AS convention, p.mois
    FROM bulletins b
    JOIN agents a ON a.id = b.agent_id
    JOIN periodes_paie p ON p.id = b.periode_id
    LEFT JOIN org_units o ON o.id = a.org_unit_id
    LEFT JOIN conventions c ON c.id = a.convention_id
    WHERE b.id = ?
  `, [id]);
}

export function ouvrirPeriode(mois: string, userId: number): number {
  const existing = get<{ id: number }>("SELECT id FROM periodes_paie WHERE mois = ?", [mois]);
  if (existing) return existing.id;
  const id = run("INSERT INTO periodes_paie (mois, statut, created_at) VALUES (?, 'ouverte', ?)", [mois, new Date().toISOString()]);
  audit(userId, "paie", `Ouverture ${mois}`);
  return id;
}

export function calculerPeriode(mois: string, variables: { agentId: number; primes: number; jours: number; retenues: number }[], userId: number): number {
  const periodeId = ouvrirPeriode(mois, userId);
  const periode = get<PeriodeRow>("SELECT * FROM periodes_paie WHERE id = ?", [periodeId]);
  if (!periode || periode.statut === "cloturee" || periode.statut === "comptabilisee") {
    throw new Error("Cette période est figée.");
  }
  const agents = all<{
    id: number; statut: string; salaire_base: number; taux_journalier: number; parts_fiscales: number; trimf_double: number; convention_id: number | null; actif: number;
  }>("SELECT * FROM agents WHERE actif = 1");
  transaction(() => {
    run("DELETE FROM bulletins WHERE periode_id = ?", [periodeId]);
    run("DELETE FROM variables_paie WHERE periode_id = ?", [periodeId]);
    for (const agent of agents) {
      const variable = variables.find((item) => item.agentId === agent.id);
      const primes = franc(variable?.primes ?? 0);
      const jours = variable?.jours ?? (agent.statut === "vacataire" ? 0 : 0);
      const retenues = franc(variable?.retenues ?? 0);
      run("INSERT INTO variables_paie (periode_id, agent_id, primes, jours, retenues) VALUES (?, ?, ?, ?, ?)", [
        periodeId, agent.id, primes, jours, retenues,
      ]);
      if (!agent.convention_id) continue;
      const config = JSON.parse(get<{ config_json: string }>("SELECT config_json FROM conventions WHERE id = ?", [agent.convention_id])!.config_json) as ConventionConfig;
      const brut = agent.statut === "vacataire" ? agent.taux_journalier * jours : agent.salaire_base + primes;
      if (brut <= 0) continue;
      const bulletin = computeBulletin(config, { brutMensuel: brut, parts: agent.parts_fiscales, trimfDouble: agent.trimf_double === 1, autresRetenues: retenues });
      run(
        `INSERT INTO bulletins (periode_id, agent_id, brut, net, charges_salariales, charges_patronales, detail_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [periodeId, agent.id, bulletin.brut, bulletin.net, bulletin.chargesSalariales, bulletin.chargesPatronales, JSON.stringify(bulletin)],
      );
    }
    run("UPDATE periodes_paie SET statut = 'calculee' WHERE id = ?", [periodeId]);
    audit(userId, "paie", `Calcul ${mois}`);
  });
  return periodeId;
}

export function cloturerPeriode(id: number, userId: number): void {
  run("UPDATE periodes_paie SET statut = 'cloturee' WHERE id = ?", [id]);
  audit(userId, "paie", `Clôture ${id}`);
}

export function comptabiliserPaie(id: number, user: SessionUser): number {
  const periode = get<PeriodeRow>("SELECT * FROM periodes_paie WHERE id = ?", [id]);
  if (!periode) throw new Error("Période introuvable.");
  if (periode.ecriture_id) throw new Error("Cette paie est déjà comptabilisée.");
  if (periode.statut !== "calculee" && periode.statut !== "cloturee") throw new Error("Calculez la paie avant de la comptabiliser.");
  const bulletins = all<{ detail_json: string }>("SELECT detail_json FROM bulletins WHERE periode_id = ?", [id]);
  if (!bulletins.length) throw new Error("Aucun bulletin sur cette période.");
  const totals = { brut: 0, net: 0, ipres: 0, ipm: 0, cssAf: 0, cssAt: 0, cfce: 0, ir: 0, trimf: 0, retenues: 0, patronalSocial: 0 };
  for (const bulletin of bulletins) {
    const detail = JSON.parse(bulletin.detail_json) as BulletinResult;
    for (const line of detail.lignes) {
      if (line.code === "BRUT") totals.brut += line.gain;
      if (line.code === "IPRES" || line.code === "IPRES_CADRE") totals.ipres += line.retenue + line.partEmployeur;
      if (line.code === "IPM") totals.ipm += line.retenue + line.partEmployeur;
      if (line.code === "CSS_AF") totals.cssAf += line.partEmployeur;
      if (line.code === "CSS_AT") totals.cssAt += line.partEmployeur;
      if (line.code === "CFCE") totals.cfce += line.partEmployeur;
      if (line.code === "IR") totals.ir += line.retenue;
      if (line.code === "TRIMF") totals.trimf += line.retenue;
      if (line.code === "RETENUE") totals.retenues += line.retenue;
      if (["IPRES", "IPRES_CADRE", "IPM", "CSS_AF", "CSS_AT"].includes(line.code)) totals.patronalSocial += line.partEmployeur;
    }
    totals.net += detail.net;
  }
  const lines = [
    { compte: "6611", libelle: `Salaires ${periode.mois}`, debit: totals.brut, credit: 0, analytique: "902" },
    { compte: "6641", libelle: `Charges sociales ${periode.mois}`, debit: totals.patronalSocial, credit: 0, analytique: "902" },
    { compte: "6418", libelle: `CFCE ${periode.mois}`, debit: totals.cfce, credit: 0, analytique: "902" },
    { compte: "422", libelle: `Net à payer ${periode.mois}`, debit: 0, credit: totals.net, analytique: "" },
    { compte: "4313", libelle: `IPRES ${periode.mois}`, debit: 0, credit: totals.ipres, analytique: "" },
    { compte: "4318", libelle: `IPM ${periode.mois}`, debit: 0, credit: totals.ipm, analytique: "" },
    { compte: "4311", libelle: `CSS familles ${periode.mois}`, debit: 0, credit: totals.cssAf, analytique: "" },
    { compte: "4312", libelle: `CSS accidents ${periode.mois}`, debit: 0, credit: totals.cssAt, analytique: "" },
    { compte: "4471", libelle: `IR ${periode.mois}`, debit: 0, credit: totals.ir, analytique: "" },
    { compte: "4472", libelle: `TRIMF ${periode.mois}`, debit: 0, credit: totals.trimf, analytique: "" },
    { compte: "4478", libelle: `CFCE ${periode.mois}`, debit: 0, credit: totals.cfce, analytique: "" },
    { compte: "4211", libelle: `Retenues ${periode.mois}`, debit: 0, credit: totals.retenues, analytique: "" },
  ].filter((line) => line.debit || line.credit);
  const debit = lines.reduce((sum, line) => sum + line.debit, 0);
  const credit = lines.reduce((sum, line) => sum + line.credit, 0);
  const gap = debit - credit;
  if (gap !== 0) {
    const netLine = lines.find((line) => line.compte === "422");
    if (!netLine || Math.abs(gap) > bulletins.length) {
      throw new Error(`La paie ne s'équilibre pas (${debit} / ${credit}).`);
    }
    netLine.credit += gap;
  }
  const day = `${periode.mois}-28`;
  const ecriture = poster(user, {
    journal: "PA",
    piece: `PAIE-${periode.mois}`,
    date: day,
    libelle: `Paie ${periode.mois}`,
    mode: "piece",
    lines,
  });
  run("UPDATE periodes_paie SET statut = 'comptabilisee', ecriture_id = ? WHERE id = ?", [ecriture, id]);
  audit(user.id, "paie", `Comptabilisation ${periode.mois}`);
  return ecriture;
}

export function remontee(periodeId: number) {
  const data = getPeriode(periodeId);
  if (!data) return undefined;
  const byOrg = new Map<string, { org: string; effectif: number; brut: number; net: number; charges: number; vacataires: number }>();
  for (const bulletin of data.bulletins) {
    const key = bulletin.org_nom ?? "Non affecté";
    const row = byOrg.get(key) ?? { org: key, effectif: 0, brut: 0, net: 0, charges: 0, vacataires: 0 };
    row.effectif += 1;
    row.brut += bulletin.brut;
    row.net += bulletin.net;
    row.charges += bulletin.charges_patronales;
    if (bulletin.statut === "vacataire") row.vacataires += 1;
    byOrg.set(key, row);
  }
  const total = data.bulletins.reduce(
    (acc, bulletin) => ({
      brut: acc.brut + bulletin.brut,
      net: acc.net + bulletin.net,
      chargesSalariales: acc.chargesSalariales + bulletin.charges_salariales,
      chargesPatronales: acc.chargesPatronales + bulletin.charges_patronales,
    }),
    { brut: 0, net: 0, chargesSalariales: 0, chargesPatronales: 0 },
  );
  return { ...data, unites: [...byOrg.values()], total };
}

export function variablesPeriode(periodeId: number) {
  return all<{ agent_id: number; primes: number; jours: number; retenues: number }>(
    "SELECT agent_id, primes, jours, retenues FROM variables_paie WHERE periode_id = ?",
    [periodeId],
  );
}
