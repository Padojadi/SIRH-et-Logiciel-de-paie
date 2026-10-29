import { enregistrerBudget } from "@/app/actions";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { comptesSaisie, listBudgets } from "@/lib/books-store";
import { dakarToday, frMois, yearMonth } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Budgets" };

export default async function Budgets({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const periode = query.get("periode") || yearMonth(dakarToday());
  const rows = listBudgets(periode);
  return (
    <>
      <PageHeader kicker="Comptabilité" title="Budgets" lede="Un montant par compte et par mois. L'écart compare le budget au réalisé du mois, charges en débit et produits en crédit." />
      <Flash ok={query.ok} erreur={query.erreur} />
      <form className="actions" method="get">
        <label>Période<input type="month" name="periode" defaultValue={periode} /></label>
        <button className="secondary" type="submit">Afficher</button>
      </form>
      <h2>{frMois(periode)}</h2>
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Compte</th><th>Libellé</th><th className="num">Budget</th><th className="num">Réalisé</th><th className="num">Écart</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.compte_code}>
                <td>{row.compte_code}</td>
                <td>{row.libelle}</td>
                <td className="num">{fcfa(row.montant)}</td>
                <td className="num">{fcfa(row.actual)}</td>
                <td className="num">{fcfa(row.ecart)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can(user.role, "compta.write") ? (
        <form action={enregistrerBudget} className="form-grid panel" style={{ marginTop: "1rem" }}>
          <input type="hidden" name="periode" value={periode} />
          <label>Compte
            <input name="compte" list="comptes-budget" required />
          </label>
          <label>Montant<input name="montant" inputMode="numeric" required /></label>
          <datalist id="comptes-budget">{comptesSaisie().map((compte) => <option key={compte.code} value={compte.code}>{compte.libelle}</option>)}</datalist>
          <div><button type="submit">Enregistrer</button></div>
        </form>
      ) : null}
    </>
  );
}
