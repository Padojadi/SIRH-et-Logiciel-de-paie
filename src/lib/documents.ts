import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { frDate, frMois } from "./dates";
import { fcfa, pdfSafe } from "./format";
import { setting } from "./settings";

function wrap(text: string, font: { widthOfTextAtSize: (text: string, size: number) => number }, size: number, width: number): string[] {
  const words = pdfSafe(text).split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(trial, size) > width && current) {
      lines.push(current);
      current = word;
    } else current = trial;
  }
  if (current) lines.push(current);
  return lines;
}

export async function pdfFiche(fiche: { code: string; title: string; mission: string; profil: string; org?: string; taches: { title: string; description: string; minutes_par_jour: number }[] }): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const draw = (text: string, x: number, y: number, size: number, strong = false) => {
    page.drawText(pdfSafe(text), { x, y, size, font: strong ? bold : font, color: rgb(0.08, 0.14, 0.11) });
  };
  draw(setting("organisation", "Cauris"), 40, 800, 10);
  draw("Fiche de poste", 40, 770, 22, true);
  draw(`${fiche.code} — ${fiche.title}`, 40, 744, 13, true);
  if (fiche.org) draw(fiche.org, 40, 726, 11);
  let y = 700;
  for (const line of wrap(fiche.mission, font, 11, 500)) {
    draw(line, 40, y, 11);
    y -= 16;
  }
  y -= 10;
  draw("Profil", 40, y, 13, true);
  y -= 18;
  for (const line of wrap(fiche.profil || "—", font, 11, 500)) {
    draw(line, 40, y, 11);
    y -= 16;
  }
  y -= 8;
  draw("Tâches et temps journalier prévu", 40, y, 13, true);
  y -= 20;
  const total = fiche.taches.reduce((sum, task) => sum + task.minutes_par_jour, 0);
  for (const task of fiche.taches) {
    draw(`${task.title} — ${task.minutes_par_jour} min`, 40, y, 11, true);
    y -= 16;
    if (task.description) {
      for (const line of wrap(task.description, font, 10, 500)) {
        draw(line, 52, y, 10);
        y -= 14;
      }
    }
  }
  draw(`Charge prévue : ${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")}`, 40, y - 8, 12, true);
  return pdf.save();
}

export async function docxFiche(fiche: { code: string; title: string; mission: string; profil: string; org?: string; taches: { title: string; description: string; minutes_par_jour: number }[] }): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: setting("organisation", "Cauris"), heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: `${fiche.code} — ${fiche.title}`, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun(fiche.org ?? "")] }),
        new Paragraph({ text: "Mission", heading: HeadingLevel.HEADING_2 }),
        new Paragraph(fiche.mission),
        new Paragraph({ text: "Profil", heading: HeadingLevel.HEADING_2 }),
        new Paragraph(fiche.profil || "—"),
        new Paragraph({ text: "Tâches", heading: HeadingLevel.HEADING_2 }),
        ...fiche.taches.flatMap((task) => [
          new Paragraph({ children: [new TextRun({ text: `${task.title} (${task.minutes_par_jour} min)`, bold: true })] }),
          new Paragraph(task.description || ""),
        ]),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

export async function pdfBulletin(input: {
  mois: string;
  agent: string;
  matricule: string;
  poste: string;
  convention: string;
  parts: number;
  brut: number;
  net: number;
  chargesPatronales: number;
  lignes: { libelle: string; base: number; taux: number | null; gain: number; retenue: number; partEmployeur: number }[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const text = (value: string, x: number, y: number, size = 10, strong = false) => {
    page.drawText(pdfSafe(value), { x, y, size, font: strong ? bold : font, color: rgb(0.1, 0.12, 0.1) });
  };
  text(setting("organisation", "Cauris"), 40, 800, 12, true);
  text(`${setting("adresse", "")} ${setting("ville", "")}`.trim(), 40, 784, 9);
  text(`NIF ${setting("nif", "")}`, 40, 770, 9);
  text("Bulletin de paie", 360, 800, 16, true);
  text(frMois(input.mois), 360, 780, 11);
  text(`${input.agent} · ${input.matricule}`, 40, 740, 13, true);
  text(`${input.poste} · ${input.convention} · ${input.parts} part(s)`, 40, 724, 10);
  let y = 690;
  text("Élément", 40, y, 9, true);
  text("Base", 280, y, 9, true);
  text("Gain", 380, y, 9, true);
  text("Retenue", 460, y, 9, true);
  y -= 8;
  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 0.5, color: rgb(0.7, 0.65, 0.55) });
  for (const ligne of input.lignes) {
    y -= 18;
    if (y < 80) break;
    text(ligne.libelle, 40, y, 9);
    text(ligne.base ? fcfa(ligne.base) : "", 250, y, 9);
    text(ligne.gain ? fcfa(ligne.gain) : "", 360, y, 9);
    text(ligne.retenue ? fcfa(ligne.retenue) : "", 450, y, 9);
  }
  y -= 28;
  text(`Net à payer : ${fcfa(input.net)}`, 40, y, 14, true);
  text(`Charges patronales : ${fcfa(input.chargesPatronales)}`, 40, y - 18, 10);
  text("Barème indicatif paramétré dans la convention. Le bulletin établi par l'employeur fait foi après validation.", 40, 48, 8);
  return pdf.save();
}

export async function xlsxTable(nom: string, headers: string[], rows: (string | number)[][]): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet(nom.slice(0, 31));
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  sheet.columns.forEach((column) => { column.width = 22; });
  const buffer = await book.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function docxBalance(titre: string, headers: string[], rows: (string | number)[][]): Promise<Buffer> {
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ text: titre, heading: HeadingLevel.HEADING_1 }),
        new Table({
          rows: [headers, ...rows].map((row) => new TableRow({
            children: row.map((cell) => new TableCell({ children: [new Paragraph(String(cell))] })),
          })),
        }),
      ],
    }],
  });
  return Packer.toBuffer(doc);
}

export function nomFichier(base: string, ext: string): string {
  return `${base}-${frDate(new Date().toISOString().slice(0, 10)).replaceAll("/", "")}.${ext}`;
}
