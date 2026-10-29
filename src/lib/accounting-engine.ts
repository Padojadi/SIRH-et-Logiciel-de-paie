import { franc } from "./format";

export type Move = {
  code: string;
  libelle: string;
  nature: string;
  classe: number;
  date: string;
  debit: number;
  credit: number;
  ecritureId?: number;
  ligneId?: number;
  journal?: string;
  piece?: string;
  lineLabel?: string;
  lettrage?: string;
};

export type BalanceRow = {
  code: string;
  libelle: string;
  nature: string;
  classe: number;
  ouvDebit: number;
  ouvCredit: number;
  movDebit: number;
  movCredit: number;
  solDebit: number;
  solCredit: number;
};

export function assertEquilibre(lines: { debit: number; credit: number }[]): void {
  let debit = 0;
  let credit = 0;
  let n = 0;
  for (const line of lines) {
    const d = franc(line.debit);
    const c = franc(line.credit);
    if (d < 0 || c < 0) throw new Error("Un montant négatif n'est pas accepté : inversez débit et crédit.");
    if (d > 0 && c > 0) throw new Error("Une ligne ne peut pas porter à la fois un débit et un crédit.");
    if (d === 0 && c === 0) continue;
    debit += d;
    credit += c;
    n += 1;
  }
  if (n < 2) throw new Error("Une écriture contient au moins deux lignes.");
  if (debit !== credit || debit <= 0) {
    throw new Error(`Écriture déséquilibrée : débit ${debit} FCFA, crédit ${credit} FCFA.`);
  }
}

function split(net: number): { debit: number; credit: number } {
  if (net > 0) return { debit: net, credit: 0 };
  if (net < 0) return { debit: 0, credit: -net };
  return { debit: 0, credit: 0 };
}

export function balanceSixColonnes(moves: Move[], from: string, to: string): BalanceRow[] {
  const map = new Map<string, BalanceRow & { ouv: number; movD: number; movC: number }>();
  for (const m of moves) {
    if (m.nature === "analytique" || m.nature === "indicateur") continue;
    let row = map.get(m.code);
    if (!row) {
      row = {
        code: m.code,
        libelle: m.libelle,
        nature: m.nature,
        classe: m.classe,
        ouvDebit: 0,
        ouvCredit: 0,
        movDebit: 0,
        movCredit: 0,
        solDebit: 0,
        solCredit: 0,
        ouv: 0,
        movD: 0,
        movC: 0,
      };
      map.set(m.code, row);
    }
    const d = franc(m.debit);
    const c = franc(m.credit);
    if (m.date < from) row.ouv += d - c;
    else if (m.date <= to) {
      row.movD += d;
      row.movC += c;
    }
  }
  const rows = [...map.values()]
    .map((row) => {
      const ouv = split(row.ouv);
      const sol = split(row.ouv + row.movD - row.movC);
      return {
        code: row.code,
        libelle: row.libelle,
        nature: row.nature,
        classe: row.classe,
        ouvDebit: ouv.debit,
        ouvCredit: ouv.credit,
        movDebit: row.movD,
        movCredit: row.movC,
        solDebit: sol.debit,
        solCredit: sol.credit,
      };
    })
    .filter((r) => r.ouvDebit || r.ouvCredit || r.movDebit || r.movCredit)
    .sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));
  return rows;
}

export function balanceTotals(rows: BalanceRow[]) {
  return rows.reduce(
    (acc, r) => ({
      ouvDebit: acc.ouvDebit + r.ouvDebit,
      ouvCredit: acc.ouvCredit + r.ouvCredit,
      movDebit: acc.movDebit + r.movDebit,
      movCredit: acc.movCredit + r.movCredit,
      solDebit: acc.solDebit + r.solDebit,
      solCredit: acc.solCredit + r.solCredit,
    }),
    { ouvDebit: 0, ouvCredit: 0, movDebit: 0, movCredit: 0, solDebit: 0, solCredit: 0 },
  );
}

export type GrandLivreCompte = {
  code: string;
  libelle: string;
  lignes: {
    date: string;
    journal: string;
    piece: string;
    libelle: string;
    debit: number;
    credit: number;
    solde: number;
    ligneId: number;
    lettrage: string;
  }[];
  totalDebit: number;
  totalCredit: number;
};

export function grandLivre(moves: Move[], from: string, to: string): GrandLivreCompte[] {
  const map = new Map<string, GrandLivreCompte>();
  const opening = new Map<string, { libelle: string; net: number }>();
  for (const m of moves) {
    if (m.nature === "analytique" || m.nature === "indicateur" || m.date >= from) continue;
    const row = opening.get(m.code) ?? { libelle: m.libelle, net: 0 };
    row.net += franc(m.debit) - franc(m.credit);
    opening.set(m.code, row);
  }
  const sorted = [...moves]
    .filter((m) => m.nature !== "analytique" && m.nature !== "indicateur" && m.date >= from && m.date <= to)
    .sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }) || a.date.localeCompare(b.date) || (a.ligneId ?? 0) - (b.ligneId ?? 0));
  for (const [code, row] of opening) {
    if (!row.net) continue;
    const book: GrandLivreCompte = { code, libelle: row.libelle, lignes: [], totalDebit: 0, totalCredit: 0 };
    const debit = row.net > 0 ? row.net : 0;
    const credit = row.net < 0 ? -row.net : 0;
    book.totalDebit = debit;
    book.totalCredit = credit;
    book.lignes.push({
      date: from,
      journal: "AN",
      piece: "OUVERTURE",
      libelle: "Report à nouveau",
      debit,
      credit,
      solde: row.net,
      ligneId: 0,
      lettrage: "",
    });
    map.set(code, book);
  }
  for (const m of sorted) {
    let book = map.get(m.code);
    if (!book) {
      book = { code: m.code, libelle: m.libelle, lignes: [], totalDebit: 0, totalCredit: 0 } satisfies GrandLivreCompte;
      map.set(m.code, book);
    }
    const debit = franc(m.debit);
    const credit = franc(m.credit);
    book.totalDebit += debit;
    book.totalCredit += credit;
    book.lignes.push({
      date: m.date,
      journal: m.journal ?? "",
      piece: m.piece ?? "",
      libelle: m.lineLabel || m.libelle,
      debit,
      credit,
      solde: book.totalDebit - book.totalCredit,
      ligneId: m.ligneId ?? 0,
      lettrage: m.lettrage ?? "",
    });
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }));
}

export type ResultatSection = { code: string; libelle: string; montant: number };

export function compteDeResultat(moves: Move[], from: string, to: string): {
  charges: ResultatSection[];
  produits: ResultatSection[];
  totalCharges: number;
  totalProduits: number;
  resultat: number;
} {
  const groups = new Map<string, { libelle: string; labelRank: number; nature: "charge" | "produit"; montant: number }>();
  for (const m of moves) {
    if (m.date < from || m.date > to) continue;
    if (m.nature !== "charge" && m.nature !== "produit") continue;
    const key = m.code.slice(0, 2);
    let g = groups.get(key);
    if (!g) {
      g = { libelle: "", labelRank: 99, nature: m.nature, montant: 0 };
      groups.set(key, g);
    }
    const sens = m.nature === "charge" ? franc(m.debit) - franc(m.credit) : franc(m.credit) - franc(m.debit);
    g.montant += sens;
    if (m.code.length < g.labelRank) {
      g.libelle = m.libelle;
      g.labelRank = m.code.length;
    }
  }
  const charges: ResultatSection[] = [];
  const produits: ResultatSection[] = [];
  for (const [code, g] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr", { numeric: true }))) {
    if (!g.montant) continue;
    const section = { code, libelle: g.libelle, montant: g.montant };
    if (g.nature === "charge") charges.push(section);
    else produits.push(section);
  }
  const totalCharges = charges.reduce((s, r) => s + r.montant, 0);
  const totalProduits = produits.reduce((s, r) => s + r.montant, 0);
  return { charges, produits, totalCharges, totalProduits, resultat: totalProduits - totalCharges };
}

export type Bilan = {
  actif: { libelle: string; montant: number }[];
  passif: { libelle: string; montant: number }[];
  totalActif: number;
  totalPassif: number;
  resultat: number;
};

function netDebit(moves: Move[], pred: (m: Move) => boolean): number {
  return moves.filter(pred).reduce((s, m) => s + franc(m.debit) - franc(m.credit), 0);
}

export function bilanSimplifie(moves: Move[], exerciceDebut: string, to: string): Bilan {
  const until = moves.filter((m) => m.date <= to && m.nature !== "indicateur" && m.nature !== "analytique");
  const byAccount = new Map<string, { classe: number; nature: string; net: number }>();
  for (const m of until) {
    let row = byAccount.get(m.code);
    if (!row) {
      row = { classe: m.classe, nature: m.nature, net: 0 };
      byAccount.set(m.code, row);
    }
    row.net += franc(m.debit) - franc(m.credit);
  }
  let immoBrute = 0;
  let amort = 0;
  let stocks = 0;
  let creances = 0;
  let dettes = 0;
  let tresoActif = 0;
  let tresoPassif = 0;
  let capitaux = 0;
  for (const row of byAccount.values()) {
    if (row.classe === 2 && row.nature === "actif") immoBrute += row.net;
    else if (row.classe === 2 && row.nature === "amortissement") amort += -row.net;
    else if (row.classe === 3) stocks += row.net;
    else if (row.classe === 4) {
      if (row.net > 0) creances += row.net;
      else dettes += -row.net;
    } else if (row.classe === 5) {
      if (row.net > 0) tresoActif += row.net;
      else tresoPassif += -row.net;
    } else if (row.classe === 1) capitaux += -row.net;
  }
  const resultat = compteDeResultat(
    moves.filter((m) => m.date >= exerciceDebut),
    exerciceDebut,
    to,
  ).resultat;
  const actif = [
    { libelle: "Immobilisations brutes", montant: immoBrute },
    { libelle: "Amortissements et dépréciations", montant: -amort },
    { libelle: "Immobilisations nettes", montant: immoBrute - amort },
    { libelle: "Stocks", montant: stocks },
    { libelle: "Créances", montant: creances },
    { libelle: "Trésorerie", montant: tresoActif },
  ];
  if (resultat < 0) actif.push({ libelle: "Perte de l'exercice", montant: -resultat });
  const passif = [
    { libelle: "Ressources durables", montant: capitaux },
    { libelle: "Dettes", montant: dettes },
    { libelle: "Trésorerie passive", montant: tresoPassif },
  ];
  if (resultat > 0) passif.push({ libelle: "Résultat bénéficiaire", montant: resultat });
  const totalActif = actif.filter((l) => l.libelle !== "Immobilisations brutes" && l.libelle !== "Amortissements et dépréciations").reduce((s, l) => s + l.montant, 0);
  const totalPassif = passif.reduce((s, l) => s + l.montant, 0);
  return { actif, passif, totalActif, totalPassif, resultat };
}

export function chiffreAffaires(moves: Move[], from: string, to: string): number {
  return moves
    .filter((m) => m.date >= from && m.date <= to && m.code.startsWith("70"))
    .reduce((s, m) => s + franc(m.credit) - franc(m.debit), 0);
}

export function creancesClients(moves: Move[], to: string): number {
  const nets = new Map<string, number>();
  for (const m of moves) {
    if (m.date > to || !m.code.startsWith("41")) continue;
    nets.set(m.code, (nets.get(m.code) ?? 0) + franc(m.debit) - franc(m.credit));
  }
  let total = 0;
  for (const net of nets.values()) if (net > 0) total += net;
  return total;
}

export function tresorerieNette(moves: Move[], to: string): number {
  return netDebit(
    moves.filter((m) => m.date <= to),
    (m) => m.classe === 5,
  );
}

export type EcheanceAmort = { periode: string; montant: number };

export function echeancierLineaire(input: {
  valeurBrute: number;
  residuelle: number;
  dureeMois: number;
  dateAcquisition: string;
}): EcheanceAmort[] {
  const base = franc(input.valeurBrute - input.residuelle);
  if (base <= 0 || input.dureeMois < 1) return [];
  const monthly = base / input.dureeMois;
  const day = Math.min(30, Math.max(1, Number(input.dateAcquisition.slice(8, 10))));
  const firstFraction = (30 - day + 1) / 30;
  const slices = [firstFraction * monthly];
  for (let i = 1; i < input.dureeMois; i += 1) slices.push(monthly);
  if (firstFraction < 0.999) slices.push((1 - firstFraction) * monthly);
  const rounded = slices.map((s) => franc(s));
  const drift = base - rounded.reduce((s, n) => s + n, 0);
  rounded[rounded.length - 1] += drift;
  let year = Number(input.dateAcquisition.slice(0, 4));
  let month = Number(input.dateAcquisition.slice(5, 7));
  const out: EcheanceAmort[] = [];
  for (const montant of rounded) {
    if (montant !== 0) out.push({ periode: `${year}-${String(month).padStart(2, "0")}`, montant });
    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }
  }
  return out;
}

export function fecLigneMontant(n: number): string {
  return franc(n).toFixed(2).replace(".", ",");
}

export function buildFec(
  rows: {
    journalCode: string;
    journalLib: string;
    ecritureNum: string;
    date: string;
    compte: string;
    compteLib: string;
    auxNum: string;
    auxLib: string;
    piece: string;
    libelle: string;
    debit: number;
    credit: number;
    lettrage: string;
    dateLettrage: string;
  }[],
): string {
  const header = [
    "JournalCode",
    "JournalLib",
    "EcritureNum",
    "EcritureDate",
    "CompteNum",
    "CompteLib",
    "CompAuxNum",
    "CompAuxLib",
    "PieceRef",
    "PieceDate",
    "EcritureLib",
    "Debit",
    "Credit",
    "EcritureLet",
    "DateLet",
    "ValidDate",
    "Montantdevise",
    "Idevise",
  ].join("\t");
  const lines = rows.map((r) => {
    const date = r.date.replaceAll("-", "");
    return [
      r.journalCode,
      r.journalLib,
      r.ecritureNum,
      date,
      r.compte,
      r.compteLib,
      r.auxNum,
      r.auxLib,
      r.piece,
      date,
      r.libelle,
      fecLigneMontant(r.debit),
      fecLigneMontant(r.credit),
      r.lettrage,
      r.dateLettrage ? r.dateLettrage.replaceAll("-", "") : "",
      date,
      "",
      "XOF",
    ].join("\t");
  });
  return `${header}\n${lines.join("\n")}\n`;
}
