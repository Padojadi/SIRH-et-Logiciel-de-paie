import type { SessionUser } from "./auth";
import {
  assertEquilibre,
  balanceSixColonnes,
  balanceTotals,
  bilanSimplifie,
  buildFec,
  chiffreAffaires,
  compteDeResultat,
  creancesClients,
  echeancierLineaire,
  grandLivre,
  tresorerieNette,
  type Move,
} from "./accounting-engine";
import { parseReleve } from "./bank-formats";
import { all, get, run, transaction } from "./db";
import { franc } from "./format";
import { getAgent } from "./hr-store";
import { audit, framework, setting } from "./settings";

export type CompteRow = { id: number; framework: string; code: string; libelle: string; classe: number; nature: string; actif: number; analytique_defaut: string };
export type EcritureLine = { compte: string; libelle: string; debit: number; credit: number; analytique: string };

export function comptesSaisie(): { code: string; libelle: string }[] {
  return all("SELECT code, libelle FROM comptes WHERE framework = ? AND actif = 1 AND length(code) >= 3 ORDER BY code", [framework()]);
}

export function listComptes(query = "", onlyActive = false): CompteRow[] {
  const q = `%${query.trim()}%`;
  return all<CompteRow>(
    `SELECT * FROM comptes WHERE framework = ? AND (? = 0 OR actif = 1) AND (code LIKE ? OR libelle LIKE ?)
     ORDER BY code LIMIT 400`,
    [framework(), onlyActive ? 1 : 0, q, q],
  );
}

export function saveCompte(input: { code: string; libelle: string; nature: string; analytique: string }, userId: number): void {
  const code = input.code.trim();
  if (!/^\d{2,8}$/.test(code)) throw new Error("Le numéro de compte doit contenir de 2 à 8 chiffres.");
  const existing = get<{ id: number }>("SELECT id FROM comptes WHERE framework = ? AND code = ?", [framework(), code]);
  if (existing) {
    run("UPDATE comptes SET libelle = ?, nature = ?, analytique_defaut = ?, actif = 1 WHERE id = ?", [
      input.libelle.trim(), input.nature, input.analytique, existing.id,
    ]);
  } else {
    run("INSERT INTO comptes (framework, code, libelle, classe, nature, analytique_defaut) VALUES (?, ?, ?, ?, ?, ?)", [
      framework(), code, input.libelle.trim(), Number(code[0]), input.nature, input.analytique,
    ]);
  }
  audit(userId, "compte", code);
}

export function toggleCompte(id: number): void {
  run("UPDATE comptes SET actif = CASE actif WHEN 1 THEN 0 ELSE 1 END WHERE id = ? AND framework = ?", [id, framework()]);
}

export function listJournaux() {
  return all<{ id: number; code: string; libelle: string; type: string }>("SELECT * FROM journaux ORDER BY code");
}

function analytiqueAuto(user: SessionUser | null, compte: string, explicit: string): string {
  if (explicit.trim()) return explicit.trim();
  const account = get<{ analytique_defaut: string }>("SELECT analytique_defaut FROM comptes WHERE framework = ? AND code = ?", [framework(), compte]);
  if (account?.analytique_defaut) return account.analytique_defaut;
  if (!user?.agent_id) return "";
  let orgId = getAgent(user.agent_id)?.org_unit_id ?? null;
  while (orgId) {
    const axis = get<{ code: string }>("SELECT code FROM axes_analytiques WHERE org_unit_id = ?", [orgId]);
    if (axis) return axis.code;
    orgId = get<{ parent_id: number | null }>("SELECT parent_id FROM org_units WHERE id = ?", [orgId])?.parent_id ?? null;
  }
  return "";
}

export function moves(): Move[] {
  return all<Move>(`
    SELECT c.code, c.libelle, c.nature, c.classe, e.date AS date, l.debit, l.credit,
           e.id AS ecritureId, l.id AS ligneId, j.code AS journal, e.numero_piece AS piece,
           l.libelle AS lineLabel, l.lettrage
    FROM lignes_ecriture l
    JOIN ecritures e ON e.id = l.ecriture_id
    JOIN comptes c ON c.id = l.compte_id
    JOIN journaux j ON j.id = e.journal_id
    WHERE c.framework = ?
    ORDER BY e.date, e.id, l.id
  `, [framework()]);
}

export function poster(user: SessionUser, input: { journal: string; piece: string; date: string; libelle: string; mode: string; lines: EcritureLine[] }): number {
  const clean = input.lines
    .map((line) => ({ ...line, debit: franc(line.debit), credit: franc(line.credit), analytique: analytiqueAuto(user, line.compte, line.analytique) }))
    .filter((line) => line.compte && (line.debit || line.credit));
  assertEquilibre(clean);
  const journal = get<{ id: number }>("SELECT id FROM journaux WHERE code = ?", [input.journal]);
  if (!journal) throw new Error("Journal inconnu.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new Error("Date invalide.");
  return transaction(() => {
    const ecritureId = run(
      "INSERT INTO ecritures (journal_id, numero_piece, date, libelle, mode, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [journal.id, input.piece.trim() || `P-${Date.now()}`, input.date, input.libelle.trim() || "Écriture", input.mode, user.id, new Date().toISOString()],
    );
    for (const line of clean) {
      const compte = get<{ id: number; actif: number }>("SELECT id, actif FROM comptes WHERE framework = ? AND code = ?", [framework(), line.compte.trim()]);
      if (!compte || !compte.actif) throw new Error(`Compte ${line.compte} introuvable ou inactif dans le référentiel ${framework()}.`);
      run(
        "INSERT INTO lignes_ecriture (ecriture_id, compte_id, libelle, debit, credit, analytique) VALUES (?, ?, ?, ?, ?, ?)",
        [ecritureId, compte.id, line.libelle || input.libelle, line.debit, line.credit, line.analytique],
      );
    }
    audit(user.id, "ecriture", `${input.journal} ${input.piece}`);
    return ecritureId;
  });
}

export function posterGroupees(user: SessionUser, lignes: (EcritureLine & { journal: string; date: string; piece: string })[], mode: string): number {
  const groups = new Map<string, (EcritureLine & { journal: string; date: string; piece: string })[]>();
  for (const line of lignes) {
    if (!line.compte || (!Number(line.debit) && !Number(line.credit))) continue;
    const key = `${line.journal}|${line.date}|${line.piece}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }
  if (!groups.size) throw new Error("Aucune ligne à enregistrer.");
  let count = 0;
  for (const [key, group] of groups) {
    const [journal, date, piece] = key.split("|");
    poster(user, { journal, date, piece, libelle: group[0]?.libelle || piece, mode, lines: group });
    count += 1;
  }
  return count;
}

export function listEcritures(from: string, to: string) {
  return all<{ id: number; date: string; numero_piece: string; libelle: string; journal: string; debit: number; credit: number }>(
    `SELECT e.id, e.date, e.numero_piece, e.libelle, j.code AS journal,
            SUM(l.debit) AS debit, SUM(l.credit) AS credit
     FROM ecritures e JOIN journaux j ON j.id = e.journal_id
     JOIN lignes_ecriture l ON l.ecriture_id = e.id
     JOIN comptes c ON c.id = l.compte_id
     WHERE e.date >= ? AND e.date <= ? AND c.framework = ?
     GROUP BY e.id ORDER BY e.date DESC, e.id DESC`,
    [from, to, framework()],
  );
}

export function getEcriture(id: number) {
  const head = get<{ id: number; date: string; numero_piece: string; libelle: string; journal: string; mode: string }>(
    `SELECT e.id, e.date, e.numero_piece, e.libelle, j.code AS journal, e.mode
     FROM ecritures e JOIN journaux j ON j.id = e.journal_id WHERE e.id = ?`,
    [id],
  );
  if (!head) return undefined;
  const lignes = all<{ code: string; compte: string; libelle: string; debit: number; credit: number; analytique: string; lettrage: string }>(
    `SELECT c.code, c.libelle AS compte, l.libelle, l.debit, l.credit, l.analytique, l.lettrage
     FROM lignes_ecriture l JOIN comptes c ON c.id = l.compte_id WHERE l.ecriture_id = ?`,
    [id],
  );
  return { ...head, lignes };
}

export function lettrer(ids: number[], code: string, userId: number): void {
  if (ids.length < 2) throw new Error("Sélectionnez au moins deux lignes.");
  const rows = all<{ id: number; compte_id: number; debit: number; credit: number }>(
    `SELECT id, compte_id, debit, credit FROM lignes_ecriture WHERE id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  if (rows.length !== ids.length) throw new Error("Ligne introuvable.");
  if (new Set(rows.map((row) => row.compte_id)).size !== 1) throw new Error("Le lettrage concerne un seul compte.");
  const debit = rows.reduce((sum, row) => sum + row.debit, 0);
  const credit = rows.reduce((sum, row) => sum + row.credit, 0);
  if (debit !== credit) throw new Error("Les lignes lettrées doivent s'équilibrer.");
  const letter = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,4}$/.test(letter)) throw new Error("Le code de lettrage contient 1 à 4 caractères.");
  const today = new Date().toISOString().slice(0, 10);
  for (const id of ids) run("UPDATE lignes_ecriture SET lettrage = ?, date_lettrage = ? WHERE id = ?", [letter, today, id]);
  audit(userId, "lettrage", letter);
}

export function balance(from: string, to: string) {
  const rows = balanceSixColonnes(moves(), from, to);
  return { rows, totals: balanceTotals(rows) };
}

export function livre(from: string, to: string, compte?: string) {
  const books = grandLivre(moves(), from, to);
  return compte ? books.filter((book) => book.code.startsWith(compte)) : books;
}

export function etats(from: string, to: string) {
  const data = moves();
  const debut = setting("exercice_debut", `${to.slice(0, 4)}-01-01`);
  return {
    resultat: compteDeResultat(data, from, to),
    bilan: bilanSimplifie(data, debut, to),
    ca: chiffreAffaires(data, from, to),
    creances: creancesClients(data, to),
    tresorerie: tresorerieNette(data, to),
  };
}

export function fec(from: string, to: string): string {
  const rows = all<{
    journalCode: string; journalLib: string; ecritureNum: number; date: string; compte: string; compteLib: string;
    piece: string; libelle: string; debit: number; credit: number; lettrage: string; dateLettrage: string;
  }>(`
    SELECT j.code AS journalCode, j.libelle AS journalLib, e.id AS ecritureNum, e.date AS date,
           c.code AS compte, c.libelle AS compteLib, e.numero_piece AS piece, l.libelle AS libelle,
           l.debit, l.credit, l.lettrage, l.date_lettrage AS dateLettrage
    FROM lignes_ecriture l
    JOIN ecritures e ON e.id = l.ecriture_id
    JOIN journaux j ON j.id = e.journal_id
    JOIN comptes c ON c.id = l.compte_id
    WHERE c.framework = ? AND e.date >= ? AND e.date <= ?
    ORDER BY e.date, e.id, l.id
  `, [framework(), from, to]);
  return buildFec(rows.map((row) => ({ ...row, ecritureNum: String(row.ecritureNum), auxNum: "", auxLib: "" })));
}

export function declarationTva(from: string, to: string) {
  const data = moves().filter((move) => move.date >= from && move.date <= to);
  const sum = (prefix: string, sens: "debit" | "credit") =>
    data.filter((move) => move.code.startsWith(prefix)).reduce((total, move) => total + (sens === "debit" ? move.debit - move.credit : move.credit - move.debit), 0);
  const collectee = sum("443", "credit");
  const deductible = sum("445", "debit");
  return {
    collectee,
    deductible,
    nette: collectee - deductible,
    baseVentes: sum("70", "credit"),
    baseAchats: sum("60", "debit") + sum("61", "debit") + sum("62", "debit"),
  };
}

export function importReleve(filename: string, content: string, userId: number): number {
  const lignes = parseReleve(content);
  if (!lignes.length) throw new Error("Aucun mouvement reconnu. Formats acceptés : OFX, CFONB 120 (CNFOB) et CSV date;libellé;montant.");
  return transaction(() => {
    const id = run("INSERT INTO releves (nom_fichier, importe_le) VALUES (?, ?)", [filename, new Date().toISOString()]);
    for (const line of lignes) {
      run("INSERT INTO lignes_releve (releve_id, date, libelle, montant, reference) VALUES (?, ?, ?, ?, ?)", [
        id, line.date, line.libelle, franc(line.montant), line.reference,
      ]);
    }
    audit(userId, "releve", `${filename} (${lignes.length})`);
    return lignes.length;
  });
}

export function lignesReleve() {
  return all<{ id: number; date: string; libelle: string; montant: number; reference: string; pointe: number; ligne_ecriture_id: number | null }>(
    "SELECT * FROM lignes_releve ORDER BY date DESC, id DESC LIMIT 300",
  );
}

export function lignesBanqueOuvertes() {
  const code = setting("compte_banque", "5211");
  return all<{ id: number; date: string; libelle: string; debit: number; credit: number; piece: string }>(
    `SELECT l.id, e.date, l.libelle, l.debit, l.credit, e.numero_piece AS piece
     FROM lignes_ecriture l
     JOIN ecritures e ON e.id = l.ecriture_id
     JOIN comptes c ON c.id = l.compte_id
     WHERE c.framework = ? AND c.code = ?
       AND l.id NOT IN (SELECT ligne_ecriture_id FROM lignes_releve WHERE ligne_ecriture_id IS NOT NULL)
     ORDER BY e.date DESC`,
    [framework(), code],
  );
}

export function pointer(releveId: number, ligneId: number, userId: number): void {
  const bank = get<{ montant: number; pointe: number }>("SELECT montant, pointe FROM lignes_releve WHERE id = ?", [releveId]);
  const book = get<{ debit: number; credit: number }>("SELECT debit, credit FROM lignes_ecriture WHERE id = ?", [ligneId]);
  if (!bank || !book || bank.pointe) throw new Error("Ligne de rapprochement invalide.");
  const expected = bank.montant >= 0 ? book.debit : book.credit;
  if (expected !== Math.abs(bank.montant)) throw new Error("Les montants ne correspondent pas.");
  run("UPDATE lignes_releve SET ligne_ecriture_id = ?, pointe = 1 WHERE id = ?", [ligneId, releveId]);
  audit(userId, "rapprochement", `${releveId} → ${ligneId}`);
}

export function rapprochementAuto(userId: number): number {
  const banks = lignesReleve().filter((line) => !line.pointe);
  const books = lignesBanqueOuvertes();
  let n = 0;
  for (const bank of banks) {
    const matches = books.filter((line) => {
      const amount = bank.montant >= 0 ? line.debit : line.credit;
      return amount === Math.abs(bank.montant) && Math.abs(Date.parse(line.date) - Date.parse(bank.date)) <= 5 * 86400000;
    });
    if (matches.length === 1) {
      pointer(bank.id, matches[0].id, userId);
      books.splice(books.findIndex((line) => line.id === matches[0].id), 1);
      n += 1;
    }
  }
  return n;
}

export function listFournisseurs() {
  return all<{ id: number; nom: string; nif: string; iban: string; compte_code: string }>("SELECT * FROM fournisseurs ORDER BY nom");
}

export function saveFournisseur(input: { nom: string; nif: string; iban: string; compte: string }, userId: number): void {
  run("INSERT INTO fournisseurs (nom, nif, iban, compte_code) VALUES (?, ?, ?, ?)", [input.nom.trim(), input.nif, input.iban, input.compte || "4011"]);
  audit(userId, "fournisseur", input.nom);
}

export function listFactures() {
  return all<{
    id: number; numero: string; date_facture: string; echeance: string | null; ht: number; tva: number; ttc: number;
    statut: string; fournisseur: string; compte_charge: string;
  }>(`
    SELECT f.*, s.nom AS fournisseur FROM factures_fournisseurs f
    JOIN fournisseurs s ON s.id = f.fournisseur_id ORDER BY f.date_facture DESC
  `);
}

export function saveFacture(input: { fournisseurId: number; numero: string; date: string; echeance: string; ht: number; compte: string }, userId: number): void {
  const rate = Number(setting("tva_taux", "0.18"));
  const ht = franc(input.ht);
  const tva = franc(ht * rate);
  run(
    `INSERT INTO factures_fournisseurs (fournisseur_id, numero, date_facture, echeance, ht, tva, ttc, compte_charge, statut)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'brouillon')`,
    [input.fournisseurId, input.numero.trim(), input.date, input.echeance || null, ht, tva, ht + tva, input.compte],
  );
  audit(userId, "facture", input.numero);
}

export function validerFacture(id: number, user: SessionUser): void {
  const facture = get<{ id: number; numero: string; date_facture: string; ht: number; tva: number; ttc: number; compte_charge: string; statut: string; fournisseur_id: number }>(
    "SELECT * FROM factures_fournisseurs WHERE id = ?",
    [id],
  );
  if (!facture || facture.statut !== "brouillon") throw new Error("Seule une facture brouillon peut être validée.");
  const fournisseur = get<{ nom: string; compte_code: string }>("SELECT nom, compte_code FROM fournisseurs WHERE id = ?", [facture.fournisseur_id]);
  transaction(() => {
    const ecriture = poster(user, {
      journal: "AC",
      piece: facture.numero,
      date: facture.date_facture,
      libelle: `Facture ${fournisseur?.nom ?? ""} ${facture.numero}`,
      mode: "piece",
      lines: [
        { compte: facture.compte_charge, libelle: facture.numero, debit: facture.ht, credit: 0, analytique: "" },
        { compte: setting("compte_tva_deductible", "4454"), libelle: `TVA ${facture.numero}`, debit: facture.tva, credit: 0, analytique: "" },
        { compte: fournisseur?.compte_code || "4011", libelle: facture.numero, debit: 0, credit: facture.ttc, analytique: "" },
      ].filter((line) => line.debit || line.credit),
    });
    run("UPDATE factures_fournisseurs SET statut = 'validee', ecriture_id = ? WHERE id = ?", [ecriture, id]);
  });
}

export function creerRemise(ids: number[], user: SessionUser): number {
  const factures = all<{ id: number; ttc: number; numero: string; statut: string; compte_code: string; nom: string }>(
    `SELECT f.id, f.ttc, f.numero, f.statut, s.compte_code, s.nom
     FROM factures_fournisseurs f JOIN fournisseurs s ON s.id = f.fournisseur_id
     WHERE f.id IN (${ids.map(() => "?").join(",")})`,
    ids,
  );
  if (!factures.length || factures.some((facture) => facture.statut !== "validee")) {
    throw new Error("La remise ne contient que des factures validées et non réglées.");
  }
  const date = new Date().toISOString().slice(0, 10);
  const reference = `REM-${date.replaceAll("-", "")}-${factures.length}`;
  const total = factures.reduce((sum, facture) => sum + facture.ttc, 0);
  const lines = [
    ...factures.map((facture) => ({ compte: facture.compte_code, libelle: facture.numero, debit: facture.ttc, credit: 0, analytique: "" })),
    { compte: setting("compte_banque", "5211"), libelle: reference, debit: 0, credit: total, analytique: "" },
  ];
  return transaction(() => {
    const ecriture = poster(user, { journal: "BQ", piece: reference, date, libelle: "Remise en banque fournisseurs", mode: "piece", lines });
    const remise = run("INSERT INTO remises (date, reference, montant, statut, ecriture_id, created_at) VALUES (?, ?, ?, 'emise', ?, ?)", [
      date, reference, total, ecriture, new Date().toISOString(),
    ]);
    for (const facture of factures) {
      run("INSERT INTO remise_factures (remise_id, facture_id) VALUES (?, ?)", [remise, facture.id]);
      run("UPDATE factures_fournisseurs SET statut = 'reglee' WHERE id = ?", [facture.id]);
    }
    audit(user.id, "remise", reference);
    return remise;
  });
}

export function listRemises() {
  return all<{ id: number; date: string; reference: string; montant: number; statut: string }>("SELECT * FROM remises ORDER BY id DESC");
}

export function listImmos() {
  return all<{
    id: number; designation: string; date_acquisition: string; valeur_brute: number; valeur_residuelle: number; duree_mois: number;
    compte_immo: string; compte_amort: string; compte_dotation: string; fournisseur: string; cumule: number;
  }>(`
    SELECT i.*, COALESCE((SELECT SUM(montant) FROM dotations d WHERE d.immobilisation_id = i.id), 0) AS cumule
    FROM immobilisations i ORDER BY i.date_acquisition DESC
  `);
}

export function creerImmo(input: {
  designation: string; date: string; valeur: number; residuelle: number; duree: number;
  compteImmo: string; compteAmort: string; compteDotation: string; fournisseur: string; reglement: "dette" | "banque";
}, user: SessionUser): void {
  if (input.duree < 1) throw new Error("La durée d'amortissement est d'au moins un mois.");
  const contrepartie = input.reglement === "banque" ? setting("compte_banque", "5211") : "4042";
  transaction(() => {
    poster(user, {
      journal: "OD",
      piece: `IMMO-${input.date}`,
      date: input.date,
      libelle: input.designation,
      mode: "piece",
      lines: [
        { compte: input.compteImmo, libelle: input.designation, debit: franc(input.valeur), credit: 0, analytique: "" },
        { compte: contrepartie, libelle: input.designation, debit: 0, credit: franc(input.valeur), analytique: "" },
      ],
    });
    run(
      `INSERT INTO immobilisations (designation, date_acquisition, valeur_brute, valeur_residuelle, duree_mois, mode, compte_immo, compte_amort, compte_dotation, fournisseur)
       VALUES (?, ?, ?, ?, ?, 'lineaire', ?, ?, ?, ?)`,
      [input.designation.trim(), input.date, franc(input.valeur), franc(input.residuelle), input.duree, input.compteImmo, input.compteAmort, input.compteDotation, input.fournisseur],
    );
    audit(user.id, "immobilisation", input.designation);
  });
}

export function genererDotations(periode: string, user: SessionUser): number {
  const assets = listImmos();
  let n = 0;
  for (const asset of assets) {
    const already = get("SELECT id FROM dotations WHERE immobilisation_id = ? AND periode = ?", [asset.id, periode]);
    if (already) continue;
    const row = echeancierLineaire({
      valeurBrute: asset.valeur_brute,
      residuelle: asset.valeur_residuelle,
      dureeMois: asset.duree_mois,
      dateAcquisition: asset.date_acquisition,
    }).find((item) => item.periode === periode);
    if (!row || !row.montant) continue;
    const ecriture = poster(user, {
      journal: "OD",
      piece: `DOT-${asset.id}-${periode}`,
      date: `${periode}-28`,
      libelle: `Dotation ${asset.designation}`,
      mode: "piece",
      lines: [
        { compte: asset.compte_dotation, libelle: asset.designation, debit: row.montant, credit: 0, analytique: "" },
        { compte: asset.compte_amort, libelle: asset.designation, debit: 0, credit: row.montant, analytique: "" },
      ],
    });
    run("INSERT INTO dotations (immobilisation_id, periode, montant, ecriture_id) VALUES (?, ?, ?, ?)", [asset.id, periode, row.montant, ecriture]);
    n += 1;
  }
  audit(user.id, "dotations", `${periode} : ${n}`);
  return n;
}

export function listBudgets(periode: string) {
  const budgets = all<{ compte_code: string; montant: number; libelle: string }>(
    `SELECT b.compte_code, b.montant, c.libelle FROM budgets b
     LEFT JOIN comptes c ON c.code = b.compte_code AND c.framework = ?
     WHERE b.periode = ? ORDER BY b.compte_code`,
    [framework(), periode],
  );
  const data = moves().filter((move) => move.date.startsWith(periode));
  return budgets.map((budget) => {
    const actual = data.filter((move) => move.code === budget.compte_code).reduce((sum, move) => {
      return sum + (move.classe === 7 ? move.credit - move.debit : move.debit - move.credit);
    }, 0);
    return { ...budget, actual, ecart: budget.montant - actual };
  });
}

export function saveBudget(compte: string, periode: string, montant: number, userId: number): void {
  run("INSERT INTO budgets (compte_code, periode, montant) VALUES (?, ?, ?) ON CONFLICT(compte_code, periode) DO UPDATE SET montant = excluded.montant", [
    compte, periode, franc(montant),
  ]);
  audit(userId, "budget", `${compte} ${periode}`);
}

export function getSheet() {
  return get<{ id: number; nom: string; grid_json: string }>("SELECT * FROM feuilles_calcul ORDER BY id LIMIT 1")
    ?? { id: 0, nom: "Feuille", grid_json: "{}" };
}

export function saveSheet(nom: string, grid: Record<string, string>, userId: number): void {
  const current = get<{ id: number }>("SELECT id FROM feuilles_calcul ORDER BY id LIMIT 1");
  if (current) run("UPDATE feuilles_calcul SET nom = ?, grid_json = ?, updated_at = ? WHERE id = ?", [nom, JSON.stringify(grid), new Date().toISOString(), current.id]);
  else run("INSERT INTO feuilles_calcul (nom, grid_json, updated_at) VALUES (?, ?, ?)", [nom, JSON.stringify(grid), new Date().toISOString()]);
  audit(userId, "tableur", nom);
}
