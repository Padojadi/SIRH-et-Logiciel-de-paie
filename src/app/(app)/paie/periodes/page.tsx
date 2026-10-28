import Link from "next/link";
import { ouvrirMois } from "@/app/actions";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dakarToday, frMois, yearMonth } from "@/lib/dates";
import { listPeriodes } from "@/lib/payroll-store";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Périodes de paie" };

const STATUT: Record<string, string> = {
  ouverte: "Ouverte",
  calculee: "Calculée",
  cloturee: "Clôturée",
  comptabilisee: "Comptabilisée",
};

export default async function Periodes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("paie.read");
  const query = await readQuery(searchParams);
  return (
    <>
      <PageHeader kicker="Paie" title="Périodes et bulletins" lede="Ouvrez un mois, saisissez les primes, les jours de vacataires et les retenues, puis calculez. La comptabilisation passe l'écriture dans le journal PA." />
      <Flash ok={query.ok} erreur={query.erreur} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Mois</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {listPeriodes().map((periode) => (
              <tr key={periode.id}>
                <td><Link href={`/paie/periodes/${periode.id}`}>{frMois(periode.mois)}</Link></td>
                <td>{STATUT[periode.statut] ?? periode.statut}</td>
                <td><Link href={`/paie/remontee?periode=${periode.id}`}>Remontée</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can(user.role, "paie.write") ? (
        <form action={ouvrirMois} className="actions panel" style={{ marginTop: "1rem" }}>
          <label>Mois<input type="month" name="mois" defaultValue={yearMonth(dakarToday())} required /></label>
          <button type="submit">Ouvrir le mois</button>
        </form>
      ) : null}
    </>
  );
}
