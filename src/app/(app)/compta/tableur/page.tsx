import { Tableur } from "@/components/tableur";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSheet } from "@/lib/books-store";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Tableur" };

export default async function TableurPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const sheet = getSheet();
  let grid: Record<string, string> = {};
  try {
    grid = JSON.parse(sheet.grid_json) as Record<string, string>;
  } catch {
    grid = {};
  }
  return (
    <>
      <PageHeader kicker="Comptabilité" title="Tableur" lede="Feuille de calcul intégrée : nombres, références de cellules et sommes. Elle est partagée par les utilisateurs de la comptabilité." />
      <Flash ok={query.ok} erreur={query.erreur} />
      <Tableur nom={sheet.nom} initial={grid} />
    </>
  );
}
