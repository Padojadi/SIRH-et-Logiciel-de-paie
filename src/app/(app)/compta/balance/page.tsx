import { DateRange, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { balance } from "@/lib/books-store";
import { fcfa } from "@/lib/format";
import { readQuery } from "@/lib/query";
import { exercice } from "@/lib/settings";

export const metadata = { title: "Balance" };

export default async function Balance({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const bounds = exercice();
  const from = query.get("from") || bounds.from;
  const to = query.get("to") || bounds.to;
  const data = balance(from, to);
  return (
    <>
      <PageHeader
        kicker="Comptabilité"
        title="Balance à six colonnes"
        lede="Ouverture, mouvements et soldes, au débit et au crédit. Les totaux débit et crédit de chaque paire doivent coïncider."
        actions={
          <>
            <LinkButton href={`/api/fichier?type=balance-xlsx&from=${from}&to=${to}`} secondary>Excel</LinkButton>
            <LinkButton href={`/api/fichier?type=balance-docx&from=${from}&to=${to}`} secondary>Word</LinkButton>
          </>
        }
      />
      <DateRange from={from} to={to} />
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>Compte</th><th>Libellé</th>
              <th className="num">Ouv. D</th><th className="num">Ouv. C</th>
              <th className="num">Mouv. D</th><th className="num">Mouv. C</th>
              <th className="num">Solde D</th><th className="num">Solde C</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.libelle}</td>
                <td className="num">{row.ouvDebit || ""}</td>
                <td className="num">{row.ouvCredit || ""}</td>
                <td className="num">{row.movDebit || ""}</td>
                <td className="num">{row.movCredit || ""}</td>
                <td className="num">{row.solDebit || ""}</td>
                <td className="num">{row.solCredit || ""}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={2}>Totaux</th>
              <th className="num">{fcfa(data.totals.ouvDebit)}</th>
              <th className="num">{fcfa(data.totals.ouvCredit)}</th>
              <th className="num">{fcfa(data.totals.movDebit)}</th>
              <th className="num">{fcfa(data.totals.movCredit)}</th>
              <th className="num">{fcfa(data.totals.solDebit)}</th>
              <th className="num">{fcfa(data.totals.solCredit)}</th>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
