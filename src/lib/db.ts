import fs from "node:fs";
import path from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { seed } from "./seed";

type Cache = { db?: DatabaseSync };
const globalForDb = globalThis as typeof globalThis & { __cauris?: Cache };
const cache: Cache = globalForDb.__cauris ?? (globalForDb.__cauris = {});

export function dbPath(): string {
  return process.env.CAURIS_DB_PATH || path.join(process.cwd(), "data", "cauris.sqlite");
}

export function db(): DatabaseSync {
  if (!cache.db) {
    const file = dbPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const database = new DatabaseSync(file);
    database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    migrate(database);
    const count = database.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    if (Number(count.n) === 0) seed(database);
    cache.db = database;
  }
  return cache.db;
}

export function closeDb(): void {
  cache.db?.close();
  cache.db = undefined;
}

function plain<T>(row: T): T {
  if (row === null || typeof row !== "object") return row;
  return Object.fromEntries(Object.entries(row as object)) as T;
}

export function all<T>(sql: string, params: SQLInputValue[] = []): T[] {
  return (db().prepare(sql).all(...params) as T[]).map((row) => plain(row));
}

export function get<T>(sql: string, params: SQLInputValue[] = []): T | undefined {
  const row = db().prepare(sql).get(...params) as T | undefined;
  return row === undefined ? undefined : plain(row);
}

export function run(sql: string, params: SQLInputValue[] = []): number {
  const result = db().prepare(sql).run(...params);
  return Number(result.lastInsertRowid);
}

let transactionDepth = 0;

export function transaction<T>(fn: () => T): T {
  const database = db();
  const outer = transactionDepth === 0;
  if (outer) database.exec("BEGIN IMMEDIATE");
  transactionDepth += 1;
  try {
    const value = fn();
    transactionDepth -= 1;
    if (outer) database.exec("COMMIT");
    return value;
  } catch (error) {
    if (outer) {
      transactionDepth = 0;
      database.exec("ROLLBACK");
    } else {
      transactionDepth -= 1;
    }
    throw error;
  }
}

function migrate(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      agent_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS org_units (
      id INTEGER PRIMARY KEY,
      parent_id INTEGER,
      type TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conventions (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      config_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS fiches (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      org_unit_id INTEGER,
      mission TEXT NOT NULL,
      profil TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'brouillon',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS fiche_taches (
      id INTEGER PRIMARY KEY,
      fiche_id INTEGER NOT NULL REFERENCES fiches(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      minutes_par_jour INTEGER NOT NULL,
      ordre INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY,
      matricule TEXT UNIQUE NOT NULL,
      prenom TEXT NOT NULL,
      nom TEXT NOT NULL,
      email TEXT,
      date_embauche TEXT,
      statut TEXT NOT NULL,
      org_unit_id INTEGER,
      fiche_id INTEGER,
      convention_id INTEGER,
      poste TEXT NOT NULL DEFAULT '',
      salaire_base INTEGER NOT NULL DEFAULT 0,
      taux_journalier INTEGER NOT NULL DEFAULT 0,
      parts_fiscales REAL NOT NULL DEFAULT 1,
      trimf_double INTEGER NOT NULL DEFAULT 0,
      iban TEXT NOT NULL DEFAULT '',
      actif INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      jours TEXT NOT NULL,
      org_unit_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS agent_shifts (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      shift_id INTEGER NOT NULL,
      date_debut TEXT,
      date_fin TEXT
    );
    CREATE TABLE IF NOT EXISTS travaux_planifies (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      tache_id INTEGER,
      libelle TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS exceptions_temps (
      id INTEGER PRIMARY KEY,
      nom TEXT NOT NULL,
      motif TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      compter_hors_plage INTEGER NOT NULL DEFAULT 1,
      compter_malgre_inactivite INTEGER NOT NULL DEFAULT 1,
      portee TEXT NOT NULL,
      org_unit_id INTEGER,
      agent_id INTEGER,
      date_debut TEXT,
      date_fin TEXT,
      heure_debut TEXT,
      heure_fin TEXT,
      jours TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS journees (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      first_login_at TEXT,
      last_beat_at TEXT,
      statut_arrivee TEXT,
      secondes INTEGER NOT NULL DEFAULT 0,
      UNIQUE(agent_id, date)
    );
    CREATE TABLE IF NOT EXISTS tranches_temps (
      id INTEGER PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      tache_id INTEGER,
      debut TEXT NOT NULL,
      fin TEXT NOT NULL,
      secondes INTEGER NOT NULL,
      source TEXT NOT NULL,
      exception_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS comptes (
      id INTEGER PRIMARY KEY,
      framework TEXT NOT NULL,
      code TEXT NOT NULL,
      libelle TEXT NOT NULL,
      classe INTEGER NOT NULL,
      nature TEXT NOT NULL,
      actif INTEGER NOT NULL DEFAULT 1,
      analytique_defaut TEXT NOT NULL DEFAULT '',
      UNIQUE(framework, code)
    );
    CREATE TABLE IF NOT EXISTS journaux (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      libelle TEXT NOT NULL,
      type TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ecritures (
      id INTEGER PRIMARY KEY,
      journal_id INTEGER NOT NULL,
      numero_piece TEXT NOT NULL,
      date TEXT NOT NULL,
      libelle TEXT NOT NULL,
      mode TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lignes_ecriture (
      id INTEGER PRIMARY KEY,
      ecriture_id INTEGER NOT NULL REFERENCES ecritures(id) ON DELETE CASCADE,
      compte_id INTEGER NOT NULL,
      libelle TEXT NOT NULL DEFAULT '',
      debit INTEGER NOT NULL DEFAULT 0,
      credit INTEGER NOT NULL DEFAULT 0,
      analytique TEXT NOT NULL DEFAULT '',
      lettrage TEXT NOT NULL DEFAULT '',
      date_lettrage TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS axes_analytiques (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      libelle TEXT NOT NULL,
      org_unit_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS fournisseurs (
      id INTEGER PRIMARY KEY,
      nom TEXT NOT NULL,
      nif TEXT NOT NULL DEFAULT '',
      iban TEXT NOT NULL DEFAULT '',
      compte_code TEXT NOT NULL DEFAULT '4011'
    );
    CREATE TABLE IF NOT EXISTS factures_fournisseurs (
      id INTEGER PRIMARY KEY,
      fournisseur_id INTEGER NOT NULL,
      numero TEXT NOT NULL,
      date_facture TEXT NOT NULL,
      echeance TEXT,
      ht INTEGER NOT NULL,
      tva INTEGER NOT NULL,
      ttc INTEGER NOT NULL,
      compte_charge TEXT NOT NULL,
      statut TEXT NOT NULL,
      ecriture_id INTEGER
    );
    CREATE TABLE IF NOT EXISTS remises (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      reference TEXT NOT NULL,
      montant INTEGER NOT NULL,
      statut TEXT NOT NULL,
      ecriture_id INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS remise_factures (
      remise_id INTEGER NOT NULL,
      facture_id INTEGER NOT NULL,
      PRIMARY KEY (remise_id, facture_id)
    );
    CREATE TABLE IF NOT EXISTS releves (
      id INTEGER PRIMARY KEY,
      nom_fichier TEXT NOT NULL,
      importe_le TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lignes_releve (
      id INTEGER PRIMARY KEY,
      releve_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      libelle TEXT NOT NULL,
      montant INTEGER NOT NULL,
      reference TEXT NOT NULL DEFAULT '',
      ligne_ecriture_id INTEGER,
      pointe INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS immobilisations (
      id INTEGER PRIMARY KEY,
      designation TEXT NOT NULL,
      date_acquisition TEXT NOT NULL,
      valeur_brute INTEGER NOT NULL,
      valeur_residuelle INTEGER NOT NULL DEFAULT 0,
      duree_mois INTEGER NOT NULL,
      mode TEXT NOT NULL,
      compte_immo TEXT NOT NULL,
      compte_amort TEXT NOT NULL,
      compte_dotation TEXT NOT NULL,
      fournisseur TEXT NOT NULL DEFAULT '',
      statut TEXT NOT NULL DEFAULT 'en_service'
    );
    CREATE TABLE IF NOT EXISTS dotations (
      id INTEGER PRIMARY KEY,
      immobilisation_id INTEGER NOT NULL,
      periode TEXT NOT NULL,
      montant INTEGER NOT NULL,
      ecriture_id INTEGER,
      UNIQUE(immobilisation_id, periode)
    );
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY,
      compte_code TEXT NOT NULL,
      periode TEXT NOT NULL,
      montant INTEGER NOT NULL,
      UNIQUE(compte_code, periode)
    );
    CREATE TABLE IF NOT EXISTS feuilles_calcul (
      id INTEGER PRIMARY KEY,
      nom TEXT NOT NULL,
      grid_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS periodes_paie (
      id INTEGER PRIMARY KEY,
      mois TEXT NOT NULL UNIQUE,
      statut TEXT NOT NULL,
      ecriture_id INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS variables_paie (
      id INTEGER PRIMARY KEY,
      periode_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      primes INTEGER NOT NULL DEFAULT 0,
      jours REAL NOT NULL DEFAULT 0,
      retenues INTEGER NOT NULL DEFAULT 0,
      UNIQUE(periode_id, agent_id)
    );
    CREATE TABLE IF NOT EXISTS bulletins (
      id INTEGER PRIMARY KEY,
      periode_id INTEGER NOT NULL,
      agent_id INTEGER NOT NULL,
      brut INTEGER NOT NULL,
      net INTEGER NOT NULL,
      charges_salariales INTEGER NOT NULL,
      charges_patronales INTEGER NOT NULL,
      detail_json TEXT NOT NULL,
      UNIQUE(periode_id, agent_id)
    );
    CREATE TABLE IF NOT EXISTS parametres (
      cle TEXT PRIMARY KEY,
      valeur TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lignes_ecriture ON lignes_ecriture(ecriture_id);
    CREATE INDEX IF NOT EXISTS idx_lignes_compte ON lignes_ecriture(compte_id);
    CREATE INDEX IF NOT EXISTS idx_ecritures_date ON ecritures(date);
    CREATE INDEX IF NOT EXISTS idx_tranches ON tranches_temps(agent_id, date);
    CREATE INDEX IF NOT EXISTS idx_comptes_code ON comptes(framework, code);
  `);
}
