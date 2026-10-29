import type { DatabaseSync } from "node:sqlite";
import syscohada from "../../data/syscohada.json";
import sycebnl from "../../data/sycebnl.json";
import { assertEquilibre, echeancierLineaire } from "./accounting-engine";
import { addDays, dakarToday, eachDate, isWeekday, monthStart, prevMonth, weekday, yearMonth } from "./dates";
import { DEMO_ACCOUNTS } from "./demo-accounts";
import { hashPassword } from "./passwords";
import { SENEGAL_2026, computeBulletin, type ConventionConfig } from "./payroll-engine";

type Compte = { code: string; libelle: string; classe: number; nature: string };

function periodeDemonstration(today: string) {
  const yesterday = addDays(today, -1);
  let from = monthStart(today);
  if (from > yesterday) from = monthStart(yesterday);
  return { from, to: today, historiqueJusqua: yesterday };
}

export function seed(database: DatabaseSync): void {
  const today = dakarToday();
  const now = new Date().toISOString();
  const year = today.slice(0, 4);
  const mois = yearMonth(today);
  const window = periodeDemonstration(today);
  const run = (sql: string, ...params: (string | number | null)[]) => database.prepare(sql).run(...params);
  const one = <T>(sql: string, ...params: (string | number | null)[]) => database.prepare(sql).get(...params) as T;

  database.exec("BEGIN");
  try {
    const settings: Record<string, string> = {
      organisation: "SIGRHCP",
      adresse: "18, avenue des Niayes",
      ville: "Dakar",
      nif: "123456789 2A2",
      referentiel: "SYSCOHADA",
      debut_comptage: "06:00",
      limite_arrivee: "08:00",
      fin_comptage: "17:00",
      duree_theorique_heures: "8",
      tva_taux: "0.18",
      exercice_debut: `${year}-01-01`,
      exercice_fin: `${year}-12-31`,
      compte_banque: "5211",
      compte_tva_collectee: "4432",
      compte_tva_deductible: "4454",
      afficher_comptes_demo: "1",
      version: "1.0.0",
    };
    for (const [cle, valeur] of Object.entries(settings)) run("INSERT INTO parametres (cle, valeur) VALUES (?, ?)", cle, valeur);

    const insertCompte = database.prepare(
      "INSERT INTO comptes (framework, code, libelle, classe, nature) VALUES (?, ?, ?, ?, ?)",
    );
    for (const compte of syscohada as Compte[]) {
      insertCompte.run("SYSCOHADA", compte.code, compte.libelle, compte.classe, compte.nature);
    }
    for (const compte of sycebnl as Compte[]) {
      insertCompte.run("SYCEBNL", compte.code, compte.libelle, compte.classe, compte.nature);
    }
    for (const framework of ["SYSCOHADA", "SYCEBNL"]) {
      for (const [code, libelle] of [
        ["901", "Section analytique — Direction générale"],
        ["902", "Section analytique — Ressources humaines"],
        ["903", "Section analytique — Finance"],
        ["904", "Section analytique — Opérations"],
        ["905", "Section analytique — Terrain"],
      ]) {
        insertCompte.run(framework, code, libelle, 9, "analytique");
      }
    }

    const comptes = new Map<string, number>();
    for (const row of database.prepare("SELECT id, code FROM comptes WHERE framework = 'SYSCOHADA'").all() as { id: number; code: string }[]) {
      comptes.set(row.code, Number(row.id));
    }
    const cid = (code: string) => {
      const id = comptes.get(code);
      if (!id) throw new Error(`Compte ${code} absent du plan SYSCOHADA.`);
      return id;
    };

    const journaux = [
      ["AC", "Journal des achats", "ACH"],
      ["VE", "Journal des ventes", "VTE"],
      ["BQ", "Journal de banque", "BQ"],
      ["OD", "Opérations diverses", "OD"],
      ["PA", "Journal de paie", "OD"],
    ] as const;
    for (const [code, libelle, type] of journaux) run("INSERT INTO journaux (code, libelle, type) VALUES (?, ?, ?)", code, libelle, type);
    const journalId = new Map<string, number>();
    for (const row of database.prepare("SELECT id, code FROM journaux").all() as { id: number; code: string }[]) journalId.set(row.code, Number(row.id));

    const org = (parent: number | null, type: string, code: string, name: string) =>
      Number(run("INSERT INTO org_units (parent_id, type, code, name) VALUES (?, ?, ?, ?)", parent, type, code, name).lastInsertRowid);
    const dg = org(null, "direction", "DG", "Direction générale");
    const drh = org(dg, "direction", "DRH", "Direction des ressources humaines");
    const sap = org(drh, "service", "SAP", "Service administration du personnel");
    org(sap, "bureau", "BC", "Bureau des carrières");
    const dfi = org(dg, "direction", "DFI", "Direction financière");
    const sco = org(dfi, "service", "SCO", "Service comptabilité");
    const str = org(dfi, "service", "STR", "Service trésorerie");
    const dop = org(dg, "direction", "DOP", "Direction des opérations");
    const set = org(dop, "service", "SET", "Service des études");
    const bpr = org(set, "bureau", "BPR", "Bureau des projets");
    org(bpr, "cellule", "CSU", "Cellule de suivi");
    const utn = org(bpr, "unite", "UTN", "Unité terrain nord");

    for (const [code, libelle, unit] of [
      ["901", "Direction générale", dg],
      ["902", "Ressources humaines", drh],
      ["903", "Finance", dfi],
      ["904", "Opérations", dop],
      ["905", "Terrain", utn],
    ] as const) {
      run("INSERT INTO axes_analytiques (code, libelle, org_unit_id) VALUES (?, ?, ?)", code, libelle, unit);
    }

    const permanent: ConventionConfig = { ...SENEGAL_2026, modeVacataire: false };
    const vacataire: ConventionConfig = { ...SENEGAL_2026, modeVacataire: true };
    const convPermanent = Number(
      run(
        "INSERT INTO conventions (name, description, config_json) VALUES (?, ?, ?)",
        "Personnel permanent — Sénégal",
        "Barème indicatif IPRES, CSS, TRIMF et IR, à confirmer avant une paie réelle.",
        JSON.stringify(permanent),
      ).lastInsertRowid,
    );
    const convVacataire = Number(
      run(
        "INSERT INTO conventions (name, description, config_json) VALUES (?, ?, ?)",
        "Vacataires et prestataires",
        "Rémunération au temps de vacation. Les taux restent ceux de la convention et peuvent être adaptés.",
        JSON.stringify(vacataire),
      ).lastInsertRowid,
    );

    const fiche = (code: string, title: string, unit: number, mission: string, tasks: [string, number][]) => {
      const id = Number(
        run(
          "INSERT INTO fiches (code, title, org_unit_id, mission, profil, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)",
          code,
          title,
          unit,
          mission,
          "Maîtrise du français professionnel, sens de l'organisation et usage courant des outils de bureau.",
          now,
          now,
        ).lastInsertRowid,
      );
      tasks.forEach(([titleTask, minutes], index) => {
        run(
          "INSERT INTO fiche_taches (fiche_id, title, description, minutes_par_jour, ordre) VALUES (?, ?, ?, ?, ?)",
          id,
          titleTask,
          "",
          minutes,
          index + 1,
        );
      });
      return id;
    };

    const fRh = fiche("FP-RH", "Responsable ressources humaines", sap, "Piloter les effectifs, les fiches de poste et le dialogue avec les unités.", [
      ["Entretiens et suivi des agents", 120],
      ["Mise à jour des fiches de poste", 120],
      ["Reporting social", 90],
      ["Coordination avec la direction", 90],
    ]);
    const fPaie = fiche("FP-PAIE", "Gestionnaire de paie", sap, "Établir la paie, contrôler les variables et restituer les bulletins.", [
      ["Collecte des variables de paie", 150],
      ["Contrôle des bulletins", 120],
      ["Déclarations sociales", 90],
      ["Réponses aux agents", 60],
    ]);
    const fCompta = fiche("FP-COMPTA", "Comptable", sco, "Tenir les journaux, la trésorerie et les états SYSCOHADA.", [
      ["Saisie et révision des écritures", 150],
      ["Rapprochement bancaire", 120],
      ["Suivi fournisseurs", 90],
      ["États de synthèse", 60],
    ]);
    const fAide = fiche("FP-AIDE", "Aide-comptable", sco, "Préparer les pièces, saisir les achats et classer les justificatifs.", [
      ["Codification des pièces", 180],
      ["Saisie des achats", 120],
      ["Classement", 80],
      ["Contrôles de base", 40],
    ]);
    const fTreso = fiche("FP-TRESO", "Gestionnaire de trésorerie", str, "Suivre la banque, les règlements et la caisse.", [
      ["Pointage des relevés", 160],
      ["Préparation des règlements", 140],
      ["Suivi de la caisse", 80],
      ["Prévisions de trésorerie", 40],
    ]);
    const fResp = fiche("FP-ETUDES", "Responsable d'études", set, "Répartir les dossiers et garantir les délais du service.", [
      ["Répartition des dossiers", 120],
      ["Revue des livrables", 120],
      ["Relation avec les directions", 120],
      ["Planification", 60],
    ]);
    const fCharge = fiche("FP-CHARGE", "Chargé d'études", set, "Instruire les dossiers et produire les notes d'analyse.", [
      ["Analyse des dossiers", 180],
      ["Rédaction", 150],
      ["Réunions de travail", 60],
      ["Reporting", 30],
    ]);
    const fVac = fiche("FP-VAC", "Vacataire de saisie", set, "Saisir les pièces des dossiers qui lui sont confiés.", [
      ["Saisie des dossiers", 150],
      ["Contrôle de cohérence", 90],
    ]);
    const fTerrain = fiche("FP-TERRAIN", "Agent de terrain", utn, "Collecter les informations sur les sites et les rendre exploitables.", [
      ["Visites de site", 180],
      ["Comptes rendus", 150],
      ["Transmission au bureau", 90],
    ]);

    const agent = (input: {
      matricule: string;
      prenom: string;
      nom: string;
      statut: string;
      unit: number;
      fiche: number;
      convention: number;
      poste: string;
      salaire: number;
      taux?: number;
      parts?: number;
      embauche: string;
    }) =>
      Number(
        run(
          `INSERT INTO agents (matricule, prenom, nom, email, date_embauche, statut, org_unit_id, fiche_id, convention_id, poste, salaire_base, taux_journalier, parts_fiscales)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          input.matricule,
          input.prenom,
          input.nom,
          `${input.prenom}.${input.nom}`.toLowerCase().replaceAll(" ", "").normalize("NFD").replace(/\p{Diacritic}/gu, "") + "@savanes.demo",
          input.embauche,
          input.statut,
          input.unit,
          input.fiche,
          input.convention,
          input.poste,
          input.salaire,
          input.taux ?? 0,
          input.parts ?? 1,
        ).lastInsertRowid,
      );

    const agents = {
      awa: agent({ matricule: "AG001", prenom: "Awa", nom: "Dieng", statut: "titulaire", unit: sap, fiche: fRh, convention: convPermanent, poste: "Responsable RH", salaire: 750_000, parts: 2, embauche: `${year}-01-06` }),
      ndeye: agent({ matricule: "AG002", prenom: "Ndeye", nom: "Lô", statut: "titulaire", unit: sap, fiche: fPaie, convention: convPermanent, poste: "Gestionnaire de paie", salaire: 450_000, embauche: `${year}-02-01` }),
      moussa: agent({ matricule: "AG003", prenom: "Moussa", nom: "Kane", statut: "titulaire", unit: sco, fiche: fCompta, convention: convPermanent, poste: "Comptable", salaire: 600_000, parts: 1.5, embauche: `${year}-01-06` }),
      coumba: agent({ matricule: "AG004", prenom: "Coumba", nom: "Diop", statut: "titulaire", unit: sco, fiche: fAide, convention: convPermanent, poste: "Aide-comptable", salaire: 280_000, embauche: `${year}-03-01` }),
      khady: agent({ matricule: "AG005", prenom: "Khady", nom: "Bâ", statut: "titulaire", unit: str, fiche: fTreso, convention: convPermanent, poste: "Gestionnaire de trésorerie", salaire: 400_000, embauche: `${year}-01-15` }),
      mamadou: agent({ matricule: "AG006", prenom: "Mamadou", nom: "Niane", statut: "titulaire", unit: str, fiche: fTreso, convention: convPermanent, poste: "Gestionnaire de trésorerie", salaire: 380_000, embauche: `${year}-04-01` }),
      cheikh: agent({ matricule: "AG007", prenom: "Cheikh", nom: "Sow", statut: "titulaire", unit: set, fiche: fResp, convention: convPermanent, poste: "Responsable d'études", salaire: 700_000, parts: 1.5, embauche: `${year}-01-06` }),
      fatou: agent({ matricule: "AG008", prenom: "Fatou", nom: "Gueye", statut: "titulaire", unit: set, fiche: fCharge, convention: convPermanent, poste: "Chargée d'études", salaire: 450_000, embauche: `${year}-02-16` }),
      ibrahima: agent({ matricule: "AG009", prenom: "Ibrahima", nom: "Sarr", statut: "titulaire", unit: set, fiche: fCharge, convention: convPermanent, poste: "Chargé d'études", salaire: 420_000, embauche: `${year}-03-01` }),
      bineta: agent({ matricule: "AG010", prenom: "Bineta", nom: "Coly", statut: "vacataire", unit: set, fiche: fVac, convention: convVacataire, poste: "Vacataire de saisie", salaire: 0, taux: 25_000, embauche: `${year}-06-01` }),
      pape: agent({ matricule: "AG011", prenom: "Pape", nom: "Faye", statut: "titulaire", unit: utn, fiche: fTerrain, convention: convPermanent, poste: "Agent de terrain", salaire: 250_000, embauche: `${year}-05-01` }),
    };

    for (const account of DEMO_ACCOUNTS) {
      const agentId = account.agent
        ? Number((one<{ id: number }>("SELECT id FROM agents WHERE matricule = ?", account.agent)).id)
        : null;
      run(
        "INSERT INTO users (email, password_hash, name, role, agent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        account.email,
        hashPassword(account.password),
        account.name,
        account.role,
        agentId,
        now,
      );
    }

    const shiftSoir = Number(run("INSERT INTO shifts (name, start_time, end_time, jours, org_unit_id) VALUES (?, ?, ?, ?, ?)", "Soir", "14:00", "22:00", "1,2,3,4,5", str).lastInsertRowid);
    run("INSERT INTO shifts (name, start_time, end_time, jours, org_unit_id) VALUES (?, ?, ?, ?, ?)", "Terrain matin", "07:00", "15:00", "1,2,3,4,5", utn);
    run("INSERT INTO agent_shifts (agent_id, shift_id, date_debut) VALUES (?, ?, ?)", agents.mamadou, shiftSoir, `${year}-01-01`);

    let saturday = addDays(today, 1);
    while (weekday(saturday) !== 6) saturday = addDays(saturday, 1);
    const tacheIbra = Number((one<{ id: number }>("SELECT id FROM fiche_taches WHERE fiche_id = ? ORDER BY ordre LIMIT 1", fCharge)).id);
    run(
      "INSERT INTO travaux_planifies (agent_id, date, start_time, end_time, tache_id, libelle) VALUES (?, ?, ?, ?, ?, ?)",
      agents.ibrahima,
      saturday,
      "09:00",
      "13:00",
      tacheIbra,
      "Relecture exceptionnelle des dossiers en attente",
    );

    run(
      `INSERT INTO exceptions_temps (nom, motif, active, compter_hors_plage, compter_malgre_inactivite, portee, agent_id, date_debut, date_fin, heure_debut, heure_fin, jours, notes)
       VALUES (?, ?, 1, 1, 1, 'agent', ?, ?, ?, '17:00', '19:00', '1,2,3,4,5', ?)`,
      "Comité de direction",
      "Réunion hors poste",
      agents.fatou,
      window.from,
      window.to,
      "Le compteur continue pendant la réunion, y compris si le poste n'est pas sollicité.",
    );
    run(
      `INSERT INTO exceptions_temps (nom, motif, active, compter_hors_plage, compter_malgre_inactivite, portee, date_debut, date_fin, notes)
       VALUES (?, ?, 0, 1, 1, 'tous', ?, ?, ?)`,
      "Astreinte générale",
      "Astreinte",
      window.from,
      `${year}-12-31`,
      "Modèle désactivé. L'activation prolonge le comptage pour tous les agents.",
    );

    const weekdays = eachDate(window.from, window.historiqueJusqua).filter(isWeekday);
    const mondays = weekdays.filter((d) => weekday(d) === 1).slice(0, 4);
    const profiles: Record<number, { presence: number; imputed: number; arrival: string; hour: string; days?: string[] }> = {
      [agents.awa]: { presence: 8 * 3600, imputed: 7 * 3600, arrival: "a_l_heure", hour: "07:30:00" },
      [agents.ndeye]: { presence: 8 * 3600, imputed: 7 * 3600, arrival: "a_l_heure", hour: "07:45:00" },
      [agents.moussa]: { presence: 8 * 3600, imputed: 7 * 3600, arrival: "a_l_heure", hour: "07:20:00" },
      [agents.coumba]: { presence: 8 * 3600, imputed: 7 * 3600, arrival: "a_l_heure", hour: "07:55:00" },
      [agents.khady]: { presence: 9 * 3600, imputed: 9 * 3600, arrival: "a_l_heure", hour: "07:00:00" },
      [agents.mamadou]: { presence: Math.round(8.5 * 3600), imputed: Math.round(8.5 * 3600), arrival: "a_l_heure", hour: "14:10:00" },
      [agents.cheikh]: { presence: 8 * 3600, imputed: 7 * 3600, arrival: "a_l_heure", hour: "07:40:00" },
      [agents.fatou]: { presence: Math.round(8.5 * 3600), imputed: Math.round(8.5 * 3600), arrival: "a_l_heure", hour: "07:15:00" },
      [agents.ibrahima]: { presence: Math.round(7.5 * 3600), imputed: 4 * 3600, arrival: "a_l_heure", hour: "07:50:00" },
      [agents.bineta]: { presence: 4 * 3600, imputed: 4 * 3600, arrival: "a_l_heure", hour: "08:00:00", days: mondays.length ? mondays : weekdays.slice(0, 4) },
      [agents.pape]: { presence: 4 * 3600, imputed: 2 * 3600, arrival: "retard", hour: "09:40:00" },
    };

    const insertJournee = database.prepare(
      "INSERT INTO journees (agent_id, date, first_login_at, last_beat_at, statut_arrivee, secondes) VALUES (?, ?, ?, ?, ?, ?)",
    );
    const insertTranche = database.prepare(
      "INSERT INTO tranches_temps (agent_id, date, tache_id, debut, fin, secondes, source) VALUES (?, ?, ?, ?, ?, ?, 'historique')",
    );
    for (const [idText, profile] of Object.entries(profiles)) {
      const agentId = Number(idText);
      const ficheId = Number((one<{ fiche_id: number }>("SELECT fiche_id FROM agents WHERE id = ?", agentId)).fiche_id);
      const tasks = database.prepare("SELECT id, minutes_par_jour FROM fiche_taches WHERE fiche_id = ? ORDER BY ordre").all(ficheId) as { id: number; minutes_par_jour: number }[];
      const weight = tasks.reduce((sum, task) => sum + task.minutes_par_jour, 0);
      for (const date of profile.days ?? weekdays) {
        insertJournee.run(agentId, date, `${date}T${profile.hour}`, `${date}T${profile.hour}`, profile.arrival, profile.presence);
        let left = profile.imputed;
        tasks.forEach((task, index) => {
          const share = index === tasks.length - 1 ? left : Math.round((profile.imputed * task.minutes_par_jour) / weight);
          left -= share;
          if (share > 0) insertTranche.run(agentId, date, task.id, `${date}T${profile.hour}`, `${date}T${profile.hour}`, share);
        });
        const gap = profile.presence - profile.imputed;
        if (gap > 0) insertTranche.run(agentId, date, null, `${date}T${profile.hour}`, `${date}T${profile.hour}`, gap);
      }
    }

    const post = (journal: string, piece: string, date: string, libelle: string, lines: { code: string; debit?: number; credit?: number; libelle?: string; analytique?: string }[]) => {
      assertEquilibre(lines.map((line) => ({ debit: line.debit ?? 0, credit: line.credit ?? 0 })));
      const journalRow = journalId.get(journal);
      if (!journalRow) throw new Error(`Journal ${journal} absent du plan de démonstration.`);
      const ecritureId = Number(
        run(
          "INSERT INTO ecritures (journal_id, numero_piece, date, libelle, mode, created_at) VALUES (?, ?, ?, ?, 'piece', ?)",
          journalRow,
          piece,
          date,
          libelle,
          now,
        ).lastInsertRowid,
      );
      return lines.map((line) => ({
        code: line.code,
        id: Number(
          run(
            "INSERT INTO lignes_ecriture (ecriture_id, compte_id, libelle, debit, credit, analytique) VALUES (?, ?, ?, ?, ?, ?)",
            ecritureId,
            cid(line.code),
            line.libelle ?? libelle,
            line.debit ?? 0,
            line.credit ?? 0,
            line.analytique ?? "",
          ).lastInsertRowid,
        ),
      }));
    };

    post("OD", "AN-001", `${year}-01-02`, "À-nouveaux", [
      { code: "2442", debit: 1_800_000, analytique: "903" },
      { code: "4111", debit: 750_000, analytique: "904" },
      { code: "5211", debit: 3_170_000, analytique: "903" },
      { code: "1013", credit: 5_000_000 },
      { code: "2844", credit: 400_000 },
      { code: "4011", credit: 320_000 },
    ]);

    const prev = prevMonth(mois);
    const on = (ym: string, day: number) => {
      const iso = `${ym}-${String(day).padStart(2, "0")}`;
      return iso >= `${year}-01-02` && iso <= today ? iso : null;
    };
    const rentDate = on(prev, 5) ?? on(mois, 3);
    const saleDate = on(prev, 12) ?? on(mois, 4);
    const cashDate = on(prev, 20) ?? on(mois, 5);
    const payDate = on(prev, 28) ?? on(mois, 6);
    const currentSale = on(mois, 8) ?? on(mois, Math.max(2, Number(today.slice(8, 10))));
    if (rentDate) {
      post("BQ", "LOYER", rentDate, "Loyer des bureaux", [
        { code: "6222", debit: 400_000, analytique: "901" },
        { code: "4454", debit: 72_000 },
        { code: "5211", credit: 472_000 },
      ]);
    }
    if (saleDate) {
      post("VE", "FA-0901", saleDate, "Prestations d'études", [
        { code: "4111", debit: 1_180_000, analytique: "904" },
        { code: "7061", credit: 1_000_000, analytique: "904" },
        { code: "4432", credit: 180_000 },
      ]);
    }
    let encaissementId = 0;
    if (cashDate) {
      encaissementId = post("BQ", "ENC-01", cashDate, "Encaissement client", [
        { code: "5211", debit: 590_000 },
        { code: "4111", credit: 590_000 },
      ]).find((line) => line.code === "5211")!.id;
    }
    let salaireId = 0;
    if (payDate) {
      salaireId = post("BQ", "PAIE-PREC", payDate, "Paie du mois précédent", [
        { code: "6611", debit: 2_000_000, analytique: "902" },
        { code: "6641", debit: 400_000, analytique: "902" },
        { code: "5211", credit: 1_700_000 },
        { code: "4311", credit: 500_000 },
        { code: "4471", credit: 200_000 },
      ]).find((line) => line.code === "5211")!.id;
    }
    if (currentSale && currentSale !== saleDate) {
      post("VE", "FA-1001", currentSale, "Prestations d'études du mois", [
        { code: "4111", debit: 590_000, analytique: "904" },
        { code: "7061", credit: 500_000, analytique: "904" },
        { code: "4432", credit: 90_000 },
      ]);
    }
    const feeDate = on(mois, 15) ?? today;
    const feeLines = post("BQ", "FRAIS", feeDate, "Frais bancaires", [
      { code: "6318", debit: 15_000, analytique: "903" },
      { code: "5211", credit: 15_000 },
    ]);
    const loyerLine = rentDate
      ? Number((one<{ id: number }>("SELECT id FROM lignes_ecriture WHERE libelle = ? AND credit = 472000", "Loyer des bureaux")).id)
      : 0;

    let acq = `${year}-03-01`;
    if (acq > today) acq = `${year}-01-10`;
    post("AC", "IMMO-01", acq, "Acquisition de matériel informatique", [
      { code: "2442", debit: 1_200_000, analytique: "903" },
      { code: "4042", credit: 1_200_000 },
    ]);
    const payImmo = on(acq.slice(0, 7), 10) ?? acq;
    post("BQ", "IMMO-01-R", payImmo, "Règlement du matériel informatique", [
      { code: "4042", debit: 1_200_000 },
      { code: "5211", credit: 1_200_000 },
    ]);
    const immoId = Number(
      run(
        `INSERT INTO immobilisations (designation, date_acquisition, valeur_brute, valeur_residuelle, duree_mois, mode, compte_immo, compte_amort, compte_dotation, fournisseur)
         VALUES (?, ?, ?, 0, 36, 'lineaire', '2442', '2844', '6813', ?)`,
        "Parc informatique — salle des études",
        acq,
        1_200_000,
        "Technologie Sahel",
      ).lastInsertRowid,
    );
    for (const echeance of echeancierLineaire({ valeurBrute: 1_200_000, residuelle: 0, dureeMois: 36, dateAcquisition: acq })) {
      if (echeance.periode >= mois) break;
      const dotationId = post("OD", `DOT-${echeance.periode}`, `${echeance.periode}-28`, `Dotation ${echeance.periode}`, [
        { code: "6813", debit: echeance.montant, analytique: "903" },
        { code: "2844", credit: echeance.montant },
      ]);
      run(
        "INSERT INTO dotations (immobilisation_id, periode, montant, ecriture_id) VALUES (?, ?, ?, ?)",
        immoId,
        echeance.periode,
        echeance.montant,
        Number((one<{ ecriture_id: number }>("SELECT ecriture_id FROM lignes_ecriture WHERE id = ?", dotationId[0].id)).ecriture_id),
      );
    }

    const fournisseur = Number(run("INSERT INTO fournisseurs (nom, nif, iban, compte_code) VALUES (?, ?, ?, '4011')", "Atelier des Niayes", "987654321", "SN08 BK001 01001 123456789012", ).lastInsertRowid);
    run("INSERT INTO fournisseurs (nom, nif, compte_code) VALUES (?, ?, '4011')", "Papeterie Almadies", "192837465");
    const factureDate = on(mois, 10) ?? today;
    const factureEcriture = post("AC", "FF-240", factureDate, "Maintenance du parc", [
      { code: "6243", debit: 150_000, analytique: "904" },
      { code: "4454", debit: 27_000 },
      { code: "4011", credit: 177_000 },
    ]);
    const ecritureFacture = Number((one<{ ecriture_id: number }>("SELECT ecriture_id FROM lignes_ecriture WHERE id = ?", factureEcriture[0].id)).ecriture_id);
    run(
      `INSERT INTO factures_fournisseurs (fournisseur_id, numero, date_facture, echeance, ht, tva, ttc, compte_charge, statut, ecriture_id)
       VALUES (?, 'FF-240', ?, ?, 150000, 27000, 177000, '6243', 'validee', ?)`,
      fournisseur,
      factureDate,
      addDays(factureDate, 30),
      ecritureFacture,
    );
    run(
      `INSERT INTO factures_fournisseurs (fournisseur_id, numero, date_facture, echeance, ht, tva, ttc, compte_charge, statut)
       VALUES (?, 'FF-241', ?, ?, 80000, 14400, 94400, '6261', 'brouillon')`,
      fournisseur,
      factureDate,
      addDays(factureDate, 30),
    );

    for (const [code, montant] of [
      ["6222", 450_000],
      ["7061", 800_000],
      ["6611", 2_100_000],
      ["6243", 200_000],
    ] as const) {
      run("INSERT INTO budgets (compte_code, periode, montant) VALUES (?, ?, ?)", code, mois, montant);
    }

    const releveId = Number(run("INSERT INTO releves (nom_fichier, importe_le) VALUES (?, ?)", "releve-demonstration.ofx", now).lastInsertRowid);
    const addBank = (date: string, libelle: string, montant: number, ligne: number) => {
      run(
        "INSERT INTO lignes_releve (releve_id, date, libelle, montant, reference, ligne_ecriture_id, pointe) VALUES (?, ?, ?, ?, ?, ?, ?)",
        releveId,
        date,
        libelle,
        montant,
        "",
        ligne || null,
        ligne ? 1 : 0,
      );
    };
    if (rentDate && loyerLine) addBank(rentDate, "PRELEVEMENT LOYER", -472_000, loyerLine);
    if (cashDate && encaissementId) addBank(cashDate, "VIREMENT CLIENT", 590_000, encaissementId);
    if (payDate && salaireId) addBank(payDate, "VIREMENT SALAIRES", -1_700_000, salaireId);
    addBank(feeDate, "FRAIS DE TENUE DE COMPTE", -8_000, 0);
    addBank(feeDate, "VIREMENT NON IDENTIFIE", 120_000, 0);
    void feeLines;

    const sheet = {
      A1: "Indicateur",
      B1: "Montant",
      A2: "Chiffre d'affaires visé",
      B2: "800000",
      A3: "Chiffre d'affaires constaté",
      B3: "500000",
      A4: "Écart",
      B4: "=B2-B3",
      A5: "Taux de réalisation",
      B5: "=B3/B2*100",
    };
    run("INSERT INTO feuilles_calcul (nom, grid_json, updated_at) VALUES ('Tableau de bord', ?, ?)", JSON.stringify(sheet), now);

    const periodeId = Number(run("INSERT INTO periodes_paie (mois, statut, created_at) VALUES (?, 'calculee', ?)", mois, now).lastInsertRowid);
    const people = database.prepare("SELECT * FROM agents WHERE actif = 1").all() as {
      id: number;
      statut: string;
      salaire_base: number;
      taux_journalier: number;
      parts_fiscales: number;
      convention_id: number;
      matricule: string;
    }[];
    for (const person of people) {
      const primes = person.matricule === "AG008" ? 50_000 : 0;
      const jours = person.statut === "vacataire" ? 8 : 0;
      run(
        "INSERT INTO variables_paie (periode_id, agent_id, primes, jours, retenues) VALUES (?, ?, ?, ?, 0)",
        periodeId,
        person.id,
        primes,
        jours,
      );
      const config = JSON.parse(
        (one<{ config_json: string }>("SELECT config_json FROM conventions WHERE id = ?", person.convention_id)).config_json,
      ) as ConventionConfig;
      const brut = person.statut === "vacataire" ? person.taux_journalier * jours : person.salaire_base + primes;
      const bulletin = computeBulletin(config, { brutMensuel: brut, parts: person.parts_fiscales });
      run(
        `INSERT INTO bulletins (periode_id, agent_id, brut, net, charges_salariales, charges_patronales, detail_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        periodeId,
        person.id,
        bulletin.brut,
        bulletin.net,
        bulletin.chargesSalariales,
        bulletin.chargesPatronales,
        JSON.stringify(bulletin),
      );
    }

    run("INSERT INTO audit (user_id, action, detail, created_at) VALUES (NULL, 'initialisation', 'Base de démonstration créée', ?)", now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
