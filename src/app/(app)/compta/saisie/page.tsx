import Link from "next/link";
import { SaisieForms } from "@/components/saisie-forms";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { comptesSaisie, listJournaux } from "@/lib/books-store";
import { dakarToday } from "@/lib/dates";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Saisie" };

export default async function Saisie({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("compta.write");
  const query = await readQuery(searchParams);
  const mode = query.get("mode") === "kilometre" ? "kilometre" : "piece";
  return (
    <>
      <PageHeader
        kicker="Comptabilité"
        title="Saisie"
        lede="Par pièce, ou au kilomètre. L'analytique vide est repris du compte, puis de l'unité de l'agent connecté. Les montants sont en francs CFA entiers."
      />
      <Flash ok={query.ok} erreur={query.erreur} />
      <p className="actions">
        <Link className={mode === "piece" ? "button" : "button secondary"} href="/compta/saisie">Par pièce</Link>
        <Link className={mode === "kilometre" ? "button" : "button secondary"} href="/compta/saisie?mode=kilometre">Au kilomètre</Link>
      </p>
      <p className="muted">Date du jour à Dakar : {dakarToday().split("-").reverse().join("/")}.</p>
      <SaisieForms comptes={comptesSaisie()} journaux={listJournaux()} mode={mode} />
    </>
  );
}
