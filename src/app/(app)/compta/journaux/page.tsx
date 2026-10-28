import Link from "next/link";
import { DateRange, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listEcritures } from "@/lib/books-store";
import { frDate } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { readQuery } from "@/lib/query";
import { exercice } from "@/lib/settings";

export const metadata = { title: "Journaux" };

export default async function Journaux({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const bounds = exercice();
  const from = query.get("from") || bounds.from;
  const to = query.get("to") || bounds.to;
  const ecritures = listEcritures(from, to);
  return (
    <>
      <PageHeader kicker="Comptabilité" title="Journaux" lede="Achats, ventes, banque, opérations diverses et paie. Chaque pièce est équilibrée." />
      <Flash ok={query.ok} erreur={query.erreur} />
      <DateRange from={from} to={to} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Date</th><th>Journal</th><th>Pièce</th><th>Libellé</th><th className="num">Débit</th><th className="num">Crédit</th></tr></thead>
          <tbody>
            {ecritures.map((item) => (
              <tr key={item.id}>
                <td>{frDate(item.date)}</td>
                <td>{item.journal}</td>
                <td><Link href={`/compta/journaux/${item.id}`}>{item.numero_piece}</Link></td>
                <td>{item.libelle}</td>
                <td className="num">{fcfa(item.debit)}</td>
                <td className="num">{fcfa(item.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
