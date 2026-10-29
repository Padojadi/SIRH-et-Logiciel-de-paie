import Link from "next/link";
import { LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { frMois } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { listPeriodes, remontee } from "@/lib/payroll-store";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Remontée de paie" };

export default async function Remontee({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("paie.read");
  const query = await readQuery(searchParams);
  const periodes = listPeriodes();
  const id = Number(query.get("periode") || periodes[0]?.id || 0);
  const data = id ? remontee(id) : undefined;
  return (
    <>
      <PageHeader
        kicker="Paie"
        title="Remontée des informations"
        lede="Synthèse par unité : effectif payé, dont vacataires, masse brute, nette et charges patronales."
        actions={data ? <LinkButton href={`/api/fichier?type=paie-xlsx&periode=${data.periode.id}`} secondary>Excel</LinkButton> : null}
      />
      <form className="actions" method="get">
        <label>Période
          <select name="periode" defaultValue={String(id)}>
            {periodes.map((periode) => <option key={periode.id} value={periode.id}>{frMois(periode.mois)}</option>)}
          </select>
        </label>
        <button className="secondary" type="submit">Afficher</button>
      </form>
      {data ? (
        <>
          <div className="grid stats">
            <article className="card stat"><span>Brut</span><b>{fcfa(data.total.brut)}</b></article>
            <article className="card stat"><span>Net</span><b>{fcfa(data.total.net)}</b></article>
            <article className="card stat"><span>Charges salariales</span><b>{fcfa(data.total.chargesSalariales)}</b></article>
            <article className="card stat"><span>Charges patronales</span><b>{fcfa(data.total.chargesPatronales)}</b></article>
          </div>
          <div className="table-wrap panel" style={{ marginTop: "1rem" }}>
            <table>
              <thead><tr><th>Unité</th><th className="num">Effectif</th><th className="num">Vacataires</th><th className="num">Brut</th><th className="num">Net</th><th className="num">Charges patronales</th></tr></thead>
              <tbody>
                {data.unites.map((unit) => (
                  <tr key={unit.org}>
                    <td>{unit.org}</td>
                    <td className="num">{unit.effectif}</td>
                    <td className="num">{unit.vacataires}</td>
                    <td className="num">{fcfa(unit.brut)}</td>
                    <td className="num">{fcfa(unit.net)}</td>
                    <td className="num">{fcfa(unit.charges)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p><Link href={`/paie/periodes/${data.periode.id}`}>Ouvrir les bulletins</Link></p>
        </>
      ) : <p>Aucune période de paie.</p>}
    </>
  );
}
