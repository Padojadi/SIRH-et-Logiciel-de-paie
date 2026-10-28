import { lancerDotations } from "@/app/actions";
import { ImmoAssistant } from "@/components/immo-assistant";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listImmos } from "@/lib/books-store";
import { dakarToday, frDate, yearMonth } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Immobilisations" };

export default async function Immobilisations({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const write = can(user.role, "compta.write");
  return (
    <>
      <PageHeader
        kicker="Comptabilité"
        title="Immobilisations"
        lede="Assistant de création, puis dotations linéaires. Une dotation déjà passée sur le mois n'est pas reprise."
      />
      <Flash ok={query.ok} erreur={query.erreur} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Bien</th><th>Acquisition</th><th className="num">Valeur</th><th className="num">Durée</th><th className="num">Amorti</th><th>Comptes</th></tr></thead>
          <tbody>
            {listImmos().map((item) => (
              <tr key={item.id}>
                <td>{item.designation}</td>
                <td>{frDate(item.date_acquisition)}</td>
                <td className="num">{fcfa(item.valeur_brute)}</td>
                <td className="num">{item.duree_mois} mois</td>
                <td className="num">{fcfa(item.cumule)}</td>
                <td>{item.compte_immo} / {item.compte_amort} / {item.compte_dotation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {write ? (
        <div className="grid cards-2" style={{ marginTop: "1rem" }}>
          <div>
            <h2>Assistant de création</h2>
            <ImmoAssistant />
          </div>
          <form action={lancerDotations} className="panel">
            <h2>Générer les dotations</h2>
            <label>Période<input type="month" name="periode" defaultValue={yearMonth(dakarToday())} required /></label>
            <button type="submit">Comptabiliser les dotations du mois</button>
          </form>
        </div>
      ) : null}
    </>
  );
}
