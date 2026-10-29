import { getSessionUser } from "@/lib/auth";
import { balance, declarationTva, fec, livre } from "@/lib/books-store";
import { docxBalance, docxFiche, nomFichier, pdfBulletin, pdfFiche, xlsxTable } from "@/lib/documents";
import { dbPath } from "@/lib/db";
import { getAgent, getFiche } from "@/lib/hr-store";
import { can } from "@/lib/permissions";
import { getBulletin, remontee } from "@/lib/payroll-store";
import { db } from "@/lib/db";
import fs from "node:fs";

export const dynamic = "force-dynamic";

function file(body: Buffer | Uint8Array, type: string, filename: string) {
  const bytes = new Uint8Array(body);
  return new Response(bytes, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Connexion requise", { status: 401 });
  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "";
  const from = url.searchParams.get("from") ?? `${new Date().getFullYear()}-01-01`;
  const to = url.searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  try {
    if (type === "fiche-pdf" || type === "fiche-docx") {
      const fiche = getFiche(Number(url.searchParams.get("id")));
      if (!fiche) return new Response("Fiche introuvable", { status: 404 });
      const owner = user.agent_id ? getAgent(user.agent_id) : undefined;
      if (!can(user.role, "rh.read") && !(can(user.role, "rh.self") && owner?.fiche_id === fiche.id)) {
        return new Response("Accès refusé", { status: 403 });
      }
      const payload = { ...fiche, org: fiche.org_nom, taches: fiche.taches ?? [] };
      if (type === "fiche-pdf") return file(await pdfFiche(payload), "application/pdf", nomFichier(fiche.code, "pdf"));
      return file(await docxFiche(payload), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", nomFichier(fiche.code, "docx"));
    }
    if (type === "bulletin") {
      const bulletin = getBulletin(Number(url.searchParams.get("id")));
      if (!bulletin) return new Response("Bulletin introuvable", { status: 404 });
      if (!can(user.role, "paie.read") && bulletin.agent_id !== user.agent_id) return new Response("Accès refusé", { status: 403 });
      const detail = JSON.parse(bulletin.detail_json) as { lignes: { libelle: string; base: number; taux: number | null; gain: number; retenue: number; partEmployeur: number }[] };
      return file(await pdfBulletin({
        mois: bulletin.mois,
        agent: `${bulletin.prenom} ${bulletin.nom}`,
        matricule: bulletin.matricule,
        poste: bulletin.poste,
        convention: bulletin.convention ?? "",
        parts: bulletin.parts_fiscales,
        brut: bulletin.brut,
        net: bulletin.net,
        chargesPatronales: bulletin.charges_patronales,
        lignes: detail.lignes,
      }), "application/pdf", nomFichier(`bulletin-${bulletin.matricule}`, "pdf"));
    }
    if (!can(user.role, "compta.read") && type !== "paie-xlsx") return new Response("Accès refusé", { status: 403 });
    if (type === "balance-xlsx" || type === "balance-docx") {
      const data = balance(from, to);
      const headers = ["Compte", "Libellé", "Ouverture débit", "Ouverture crédit", "Mouvement débit", "Mouvement crédit", "Solde débit", "Solde crédit"];
      const rows = data.rows.map((row) => [row.code, row.libelle, row.ouvDebit, row.ouvCredit, row.movDebit, row.movCredit, row.solDebit, row.solCredit]);
      if (type === "balance-docx") return file(await docxBalance(`Balance du ${from} au ${to}`, headers, rows), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", nomFichier("balance", "docx"));
      return file(await xlsxTable("Balance", headers, rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nomFichier("balance", "xlsx"));
    }
    if (type === "grand-livre") {
      const books = livre(from, to, url.searchParams.get("compte") ?? undefined);
      const rows = books.flatMap((book) => book.lignes.map((line) => [book.code, book.libelle, line.date, line.journal, line.piece, line.libelle, line.debit, line.credit, line.solde, line.lettrage]));
      return file(await xlsxTable("Grand livre", ["Compte", "Libellé", "Date", "Journal", "Pièce", "Ligne", "Débit", "Crédit", "Solde", "Lettrage"], rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nomFichier("grand-livre", "xlsx"));
    }
    if (type === "fec") {
      if (!can(user.role, "compta.export")) return new Response("Export réglementaire réservé au comptable.", { status: 403 });
      return file(Buffer.from(fec(from, to), "utf8"), "text/plain; charset=utf-8", nomFichier("fec", "txt"));
    }
    if (type === "dgi") {
      const tva = declarationTva(from, to);
      const csv = `Periode;TVA collectee;TVA deductible;TVA nette;Base ventes HT;Base achats HT\n${from} au ${to};${tva.collectee};${tva.deductible};${tva.nette};${tva.baseVentes};${tva.baseAchats}\n`;
      return file(Buffer.from(csv, "utf8"), "text/csv; charset=utf-8", nomFichier("declaration-tva", "csv"));
    }
    if (type === "paie-xlsx") {
      if (!can(user.role, "paie.read")) return new Response("Accès refusé", { status: 403 });
      const data = remontee(Number(url.searchParams.get("periode")));
      if (!data) return new Response("Période introuvable", { status: 404 });
      return file(await xlsxTable("Paie", ["Matricule", "Nom", "Poste", "Unité", "Brut", "Net", "Charges salariales", "Charges patronales"], data.bulletins.map((item) => [item.matricule, `${item.prenom} ${item.nom}`, item.poste, item.org_nom ?? "", item.brut, item.net, item.charges_salariales, item.charges_patronales])), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nomFichier(`paie-${data.periode.mois}`, "xlsx"));
    }
    if (type === "sauvegarde") {
      if (user.role !== "administrateur") return new Response("Accès refusé", { status: 403 });
      db().exec("PRAGMA wal_checkpoint(TRUNCATE)");
      return file(fs.readFileSync(dbPath()), "application/vnd.sqlite3", nomFichier("2tic-sauvegarde", "sqlite"));
    }
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Export impossible", { status: 500 });
  }
  return new Response("Export inconnu", { status: 404 });
}
