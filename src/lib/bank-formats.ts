export type LigneReleve = {
  date: string;
  libelle: string;
  montant: number;
  reference: string;
};

const CREDIT = "{ABCDEFGHI";
const DEBIT = "}JKLMNOPQR";

export function parseCfonbAmount(field: string): number {
  const raw = field.trim();
  if (!raw) return 0;
  const signChar = raw.slice(-1);
  let sign = 1;
  let last = "";
  const ci = CREDIT.indexOf(signChar);
  const di = DEBIT.indexOf(signChar);
  if (ci >= 0) {
    sign = 1;
    last = String(ci);
  } else if (di >= 0) {
    sign = -1;
    last = String(di);
  } else if (signChar === "-") sign = -1;
  const digits = (ci >= 0 || di >= 0 ? raw.slice(0, -1) : raw.replace(/[+-]/g, "")).replace(/\D/g, "");
  const cents = Number(digits + last);
  if (!Number.isFinite(cents)) return 0;
  return (sign * cents) / 100;
}

export function parseCfonb(content: string): LigneReleve[] {
  const out: LigneReleve[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.startsWith("04") || line.length < 104) continue;
    const jj = line.slice(34, 36);
    const mm = line.slice(36, 38);
    const aa = line.slice(38, 40);
    const year = Number(aa) >= 70 ? `19${aa}` : `20${aa}`;
    const libelle = line.slice(48, 79).trim();
    const montant = parseCfonbAmount(line.slice(90, 104));
    out.push({
      date: `${year}-${mm}-${jj}`,
      libelle: libelle || "Mouvement bancaire",
      montant,
      reference: line.slice(81, 88).trim(),
    });
  }
  return out;
}

function tag(block: string, name: string): string {
  const match = block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, "i"));
  return match ? match[1].trim() : "";
}

export function parseOfx(content: string): LigneReleve[] {
  return content
    .split(/<STMTTRN>/i)
    .slice(1)
    .map((block) => {
      const body = block.split(/<\/STMTTRN>/i)[0];
      const dt = tag(body, "DTPOSTED");
      const amt = Number(tag(body, "TRNAMT").replace(",", "."));
      return {
        date: dt.length >= 8 ? `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}` : "",
        libelle: tag(body, "NAME") || tag(body, "MEMO") || "Mouvement OFX",
        montant: Number.isFinite(amt) ? amt : 0,
        reference: tag(body, "FITID"),
      };
    })
    .filter((l) => l.date && l.montant);
}

export function parseCsvReleve(content: string): LigneReleve[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: LigneReleve[] = [];
  for (const line of lines) {
    if (/^date\b/i.test(line)) continue;
    const cells = line.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cells.length < 3) continue;
    const date = normalizeDate(cells[0]);
    const montant = Number(cells[2].replace(/\s/g, "").replace(",", "."));
    if (!date || !Number.isFinite(montant)) continue;
    out.push({ date, libelle: cells[1] || "Mouvement", montant, reference: cells[3] ?? "" });
  }
  return out;
}

function normalizeDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  return "";
}

export function parseReleve(content: string): LigneReleve[] {
  const head = content.slice(0, 400).toUpperCase();
  if (head.includes("<OFX") || head.includes("STMTTRN")) return parseOfx(content);
  const lines = content.split(/\r?\n/);
  if (lines.some((l) => l.startsWith("04") && l.length >= 104)) return parseCfonb(content);
  return parseCsvReleve(content);
}
