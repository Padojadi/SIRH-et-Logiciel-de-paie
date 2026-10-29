import assert from "node:assert/strict";
import test from "node:test";
import {
  assertEquilibre,
  balanceSixColonnes,
  balanceTotals,
  bilanSimplifie,
  buildFec,
  chiffreAffaires,
  echeancierLineaire,
} from "../src/lib/accounting-engine";
import { evaluateGrid } from "../src/lib/spreadsheet";
import { parseCfonb, parseOfx, parseReleve } from "../src/lib/bank-formats";

const moves = [
  { code: "1013", libelle: "Capital", nature: "passif", classe: 1, date: "2026-01-02", debit: 0, credit: 1_000_000 },
  { code: "5211", libelle: "Banque", nature: "tresorerie", classe: 5, date: "2026-01-02", debit: 1_000_000, credit: 0 },
  { code: "7061", libelle: "Services", nature: "produit", classe: 7, date: "2026-10-12", debit: 0, credit: 500_000 },
  { code: "4432", libelle: "TVA", nature: "tiers", classe: 4, date: "2026-10-12", debit: 0, credit: 90_000 },
  { code: "4111", libelle: "Clients", nature: "tiers", classe: 4, date: "2026-10-12", debit: 590_000, credit: 0 },
  { code: "6222", libelle: "Loyer", nature: "charge", classe: 6, date: "2026-09-05", debit: 100_000, credit: 0 },
  { code: "5211", libelle: "Banque", nature: "tresorerie", classe: 5, date: "2026-09-05", debit: 0, credit: 100_000 },
];

test("la balance à six colonnes est équilibrée", () => {
  const rows = balanceSixColonnes(moves, "2026-10-01", "2026-10-31");
  const bank = rows.find((r) => r.code === "5211");
  assert.equal(bank?.ouvDebit, 900_000);
  assert.equal(bank?.movDebit, 0);
  assert.equal(bank?.solDebit, 900_000);
  const totals = balanceTotals(rows);
  assert.equal(totals.solDebit, totals.solCredit);
  assert.equal(chiffreAffaires(moves, "2026-10-01", "2026-10-31"), 500_000);
});

test("le bilan simplifié équilibre l'actif et le passif", () => {
  const bilan = bilanSimplifie(moves, "2026-01-01", "2026-10-31");
  assert.equal(bilan.resultat, 400_000);
  assert.equal(bilan.totalActif, bilan.totalPassif);
});

test("une écriture déséquilibrée est refusée", () => {
  assert.throws(() => assertEquilibre([{ debit: 100, credit: 0 }, { debit: 0, credit: 90 }]), /déséquilibrée/);
  assert.doesNotThrow(() => assertEquilibre([{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }]));
});

test("l'amortissement linéaire fait du prorata et tombe juste", () => {
  const plein = echeancierLineaire({
    valeurBrute: 360_000,
    residuelle: 0,
    dureeMois: 36,
    dateAcquisition: "2026-03-01",
  });
  assert.equal(plein.length, 36);
  assert.equal(plein[0].montant, 10_000);
  assert.equal(plein.reduce((s, e) => s + e.montant, 0), 360_000);

  const milieu = echeancierLineaire({
    valeurBrute: 360_000,
    residuelle: 0,
    dureeMois: 36,
    dateAcquisition: "2026-03-16",
  });
  assert.equal(milieu[0].montant, 5_000);
  assert.equal(milieu.at(-1)?.montant, 5_000);
  assert.equal(milieu.reduce((s, e) => s + e.montant, 0), 360_000);
});

test("le tableur calcule les références et SUM", () => {
  const values = evaluateGrid({ A1: "10", A2: "32", A3: "=SUM(A1:A2)", B1: "=A3*2" });
  assert.equal(values.A3, 42);
  assert.equal(values.B1, 84);
});

test("OFX, CFONB et CSV sont lus", () => {
  const ofx = parseOfx(`
    <STMTTRN>
    <TRNTYPE>DEBIT
    <DTPOSTED>20261015
    <TRNAMT>-150000.00
    <FITID>ABC
    <NAME>FOURNISSEUR
    </STMTTRN>`);
  assert.equal(ofx[0].montant, -150000);
  assert.equal(ofx[0].date, "2026-10-15");

  const chars = Array.from("04".padEnd(120, " "));
  for (let i = 0; i < 6; i += 1) chars[34 + i] = "151026"[i];
  const label = "VIR FOURNISSEUR";
  for (let i = 0; i < label.length; i += 1) chars[48 + i] = label[i];
  const amount = "0000001500000{";
  for (let i = 0; i < amount.length; i += 1) chars[90 + i] = amount[i];
  const cfonb = parseCfonb(chars.join(""));
  assert.equal(cfonb[0].date, "2026-10-15");
  assert.equal(cfonb[0].montant, 150000);
  assert.match(cfonb[0].libelle, /FOURNISSEUR/);

  const csv = parseReleve("date;libelle;montant\n01/10/2026;Depot;10000\n");
  assert.equal(csv[0].montant, 10000);
  assert.equal(csv[0].date, "2026-10-01");
});

test("le FEC a dix-huit colonnes", () => {
  const text = buildFec([
    {
      journalCode: "VE",
      journalLib: "Ventes",
      ecritureNum: "1",
      date: "2026-10-12",
      compte: "7061",
      compteLib: "Services vendus",
      auxNum: "",
      auxLib: "",
      piece: "FA-1",
      libelle: "Prestation",
      debit: 0,
      credit: 500000,
      lettrage: "",
      dateLettrage: "",
    },
  ]);
  const [header, line] = text.trim().split("\n");
  assert.equal(header.split("\t").length, 18);
  assert.equal(line.split("\t")[11], "0,00");
  assert.equal(line.split("\t")[12], "500000,00");
});
