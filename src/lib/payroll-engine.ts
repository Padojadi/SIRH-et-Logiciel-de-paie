export type TrancheTaux = { jusqua: number | null; taux: number };
export type TrancheMontant = { jusqua: number | null; montant: number };
export type PartsRow = { parts: number; taux: number; min: number; max: number };

export type ConventionConfig = {
  modeVacataire: boolean;
  plafondIpres: number;
  tauxIpresSalarie: number;
  tauxIpresEmployeur: number;
  plafondIpresCadre: number;
  tauxIpresCadreSalarie: number;
  tauxIpresCadreEmployeur: number;
  plafondIpm: number;
  tauxIpmSalarie: number;
  tauxIpmEmployeur: number;
  plafondCss: number;
  tauxCssAf: number;
  tauxCssAt: number;
  tauxCfce: number;
  abattement: number;
  plafondAbattement: number;
  ir: TrancheTaux[];
  trimf: TrancheMontant[];
  reductionsParts: PartsRow[];
  source: string;
};

export type LigneBulletin = {
  code: string;
  libelle: string;
  base: number;
  taux: number | null;
  gain: number;
  retenue: number;
  partEmployeur: number;
};

export type BulletinResult = {
  brut: number;
  net: number;
  chargesSalariales: number;
  chargesPatronales: number;
  irAnnuel: number;
  baseIr: number;
  lignes: LigneBulletin[];
};

export const SENEGAL_2026: ConventionConfig = {
  modeVacataire: false,
  plafondIpres: 432_000,
  tauxIpresSalarie: 0.056,
  tauxIpresEmployeur: 0.084,
  plafondIpresCadre: 1_296_000,
  tauxIpresCadreSalarie: 0.024,
  tauxIpresCadreEmployeur: 0.036,
  plafondIpm: 250_000,
  tauxIpmSalarie: 0.02,
  tauxIpmEmployeur: 0.02,
  plafondCss: 63_000,
  tauxCssAf: 0.07,
  tauxCssAt: 0.03,
  tauxCfce: 0.03,
  abattement: 0.3,
  plafondAbattement: 900_000,
  ir: [
    { jusqua: 630_000, taux: 0 },
    { jusqua: 1_500_000, taux: 0.2 },
    { jusqua: 4_000_000, taux: 0.3 },
    { jusqua: 8_000_000, taux: 0.35 },
    { jusqua: 13_500_000, taux: 0.37 },
    { jusqua: 50_000_000, taux: 0.4 },
    { jusqua: null, taux: 0.43 },
  ],
  trimf: [
    { jusqua: 599_999, montant: 900 },
    { jusqua: 999_999, montant: 3_600 },
    { jusqua: 1_999_999, montant: 4_800 },
    { jusqua: 6_999_999, montant: 12_000 },
    { jusqua: 11_999_999, montant: 18_000 },
    { jusqua: null, montant: 36_000 },
  ],
  reductionsParts: [
    { parts: 1, taux: 0, min: 0, max: 0 },
    { parts: 1.5, taux: 0.1, min: 100_000, max: 300_000 },
    { parts: 2, taux: 0.15, min: 200_000, max: 650_000 },
    { parts: 2.5, taux: 0.2, min: 300_000, max: 1_100_000 },
    { parts: 3, taux: 0.25, min: 400_000, max: 1_650_000 },
    { parts: 3.5, taux: 0.3, min: 500_000, max: 2_030_000 },
    { parts: 4, taux: 0.35, min: 600_000, max: 2_490_000 },
    { parts: 4.5, taux: 0.4, min: 700_000, max: 2_755_000 },
    { parts: 5, taux: 0.45, min: 800_000, max: 3_180_000 },
  ],
  source:
    "Paramètres indicatifs au 1er janvier 2026 (IPRES, CSS, TRIMF et barème IR du CGI sénégalais). À valider et à modifier avant toute paie réelle.",
};

export function impotProgressif(base: number, tranches: TrancheTaux[]): number {
  let prev = 0;
  let tax = 0;
  for (const t of tranches) {
    const cap = t.jusqua ?? Number.POSITIVE_INFINITY;
    const slice = Math.max(0, Math.min(base, cap) - prev);
    tax += slice * t.taux;
    prev = cap;
    if (base <= cap) break;
  }
  return tax;
}

export function montantTranche(base: number, tranches: TrancheMontant[]): number {
  for (const t of tranches) {
    if (t.jusqua === null || base <= t.jusqua) return t.montant;
  }
  return tranches.length ? tranches[tranches.length - 1].montant : 0;
}

export function reductionPourParts(irAnnuel: number, parts: number, rows: PartsRow[]): number {
  const sorted = [...rows].sort((a, b) => a.parts - b.parts);
  let row = sorted[0];
  for (const r of sorted) {
    if (parts + 1e-9 >= r.parts) row = r;
  }
  if (!row || row.taux <= 0 || irAnnuel <= 0) return 0;
  const raw = irAnnuel * row.taux;
  return Math.min(irAnnuel, Math.min(row.max, Math.max(row.min, raw)));
}

function r(n: number): number {
  return Math.round(n);
}

export function computeBulletin(
  config: ConventionConfig,
  input: { brutMensuel: number; parts: number; trimfDouble?: boolean; autresRetenues?: number },
): BulletinResult {
  const brut = r(input.brutMensuel);
  const baseIpres = Math.min(brut, config.plafondIpres);
  const ipresS = r(baseIpres * config.tauxIpresSalarie);
  const ipresE = r(baseIpres * config.tauxIpresEmployeur);
  const assietteCadre = Math.min(Math.max(brut - config.plafondIpres, 0), config.plafondIpresCadre - config.plafondIpres);
  const ipresCadreS = r(assietteCadre * config.tauxIpresCadreSalarie);
  const ipresCadreE = r(assietteCadre * config.tauxIpresCadreEmployeur);
  const baseIpm = Math.min(brut, config.plafondIpm);
  const ipmS = r(baseIpm * config.tauxIpmSalarie);
  const ipmE = r(baseIpm * config.tauxIpmEmployeur);
  const baseCss = Math.min(brut, config.plafondCss);
  const cssAf = r(baseCss * config.tauxCssAf);
  const cssAt = r(baseCss * config.tauxCssAt);
  const cfce = r(brut * config.tauxCfce);

  const brutAnnuel = brut * 12;
  const abattement = Math.min(brutAnnuel * config.abattement, config.plafondAbattement);
  const cotisationsAnnuelles = (ipresS + ipresCadreS + ipmS) * 12;
  const baseIr = Math.floor(Math.max(0, brutAnnuel - abattement - cotisationsAnnuelles) / 1000) * 1000;
  const irAvantParts = impotProgressif(baseIr, config.ir);
  const reduction = reductionPourParts(irAvantParts, input.parts, config.reductionsParts);
  const irAnnuel = Math.max(0, irAvantParts - reduction);
  const ir = r(irAnnuel / 12);
  const trimfAnnuel = montantTranche(brutAnnuel, config.trimf) * (input.trimfDouble ? 2 : 1);
  const trimf = r(trimfAnnuel / 12);
  const autres = r(input.autresRetenues ?? 0);

  const lignes: LigneBulletin[] = [
    { code: "BRUT", libelle: "Salaire brut", base: brut, taux: null, gain: brut, retenue: 0, partEmployeur: 0 },
    {
      code: "IPRES",
      libelle: "IPRES régime général",
      base: baseIpres,
      taux: config.tauxIpresSalarie,
      gain: 0,
      retenue: ipresS,
      partEmployeur: ipresE,
    },
  ];
  if (ipresCadreS || ipresCadreE) {
    lignes.push({
      code: "IPRES_CADRE",
      libelle: "IPRES régime cadre",
      base: assietteCadre,
      taux: config.tauxIpresCadreSalarie,
      gain: 0,
      retenue: ipresCadreS,
      partEmployeur: ipresCadreE,
    });
  }
  lignes.push(
    {
      code: "IPM",
      libelle: "IPM / assurance maladie",
      base: baseIpm,
      taux: config.tauxIpmSalarie,
      gain: 0,
      retenue: ipmS,
      partEmployeur: ipmE,
    },
    {
      code: "CSS_AF",
      libelle: "CSS prestations familiales",
      base: baseCss,
      taux: config.tauxCssAf,
      gain: 0,
      retenue: 0,
      partEmployeur: cssAf,
    },
    {
      code: "CSS_AT",
      libelle: "CSS accidents du travail",
      base: baseCss,
      taux: config.tauxCssAt,
      gain: 0,
      retenue: 0,
      partEmployeur: cssAt,
    },
    {
      code: "CFCE",
      libelle: "CFCE",
      base: brut,
      taux: config.tauxCfce,
      gain: 0,
      retenue: 0,
      partEmployeur: cfce,
    },
    { code: "TRIMF", libelle: "TRIMF", base: brutAnnuel, taux: null, gain: 0, retenue: trimf, partEmployeur: 0 },
    { code: "IR", libelle: "Impôt sur le revenu", base: baseIr, taux: null, gain: 0, retenue: ir, partEmployeur: 0 },
  );
  if (autres) {
    lignes.push({
      code: "RETENUE",
      libelle: "Autres retenues",
      base: autres,
      taux: null,
      gain: 0,
      retenue: autres,
      partEmployeur: 0,
    });
  }

  const chargesSalariales = ipresS + ipresCadreS + ipmS + trimf + ir + autres;
  const chargesPatronales = ipresE + ipresCadreE + ipmE + cssAf + cssAt + cfce;
  const net = brut - chargesSalariales;
  return { brut, net, chargesSalariales, chargesPatronales, irAnnuel, baseIr, lignes };
}

export function parseTranchesTaux(text: string): TrancheTaux[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [cap, rate] = line.split(/[:=]/).map((s) => s.trim());
      return {
        jusqua: cap === "*" || cap === "" ? null : Number(cap.replace(/\s/g, "")),
        taux: Number(rate.replace(",", ".")),
      };
    });
}

export function parseTranchesMontant(text: string): TrancheMontant[] {
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [cap, amount] = line.split(/[:=]/).map((s) => s.trim());
      return {
        jusqua: cap === "*" ? null : Number(cap.replace(/\s/g, "")),
        montant: Number(amount.replace(/\s/g, "")),
      };
    });
}

export function tranchesTauxTexte(rows: TrancheTaux[]): string {
  return rows.map((r) => `${r.jusqua ?? "*"}:${r.taux}`).join("\n");
}

export function tranchesMontantTexte(rows: TrancheMontant[]): string {
  return rows.map((r) => `${r.jusqua ?? "*"}:${r.montant}`).join("\n");
}
