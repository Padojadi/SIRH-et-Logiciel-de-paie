import { basculerCompte, enregistrerCompte } from "@/app/actions";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listComptes } from "@/lib/books-store";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";
import { framework } from "@/lib/settings";

export const metadata = { title: "Plan comptable" };

export default async function Plan({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const q = query.get("q") ?? "";
  const comptes = listComptes(q);
  const ref = framework();
  return (
    <>
      <PageHeader
        kicker="Comptabilité"
        title="Plan comptable"
        lede={ref === "SYCEBNL"
          ? "Référentiel SYCEBNL actif. La nomenclature livrée est un plan de départ, à compléter avant une comptabilité réelle. L'historique SYSCOHADA reste en base et réapparaît si vous revenez à ce référentiel."
          : "Plan SYSCOHADA intégré, personnalisable. Les comptes de classe 9 servent à l'analytique. La saisie n'utilise que les comptes actifs d'au moins trois chiffres."}
      />
      <Flash ok={query.ok} erreur={query.erreur} />
      <form className="actions" method="get">
        <label>Recherche<input name="q" defaultValue={q} placeholder="Numéro ou intitulé" /></label>
        <button className="secondary" type="submit">Filtrer</button>
      </form>
      <p className="muted">{comptes.length} compte(s) affiché(s), dans la limite de 400.</p>
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Numéro</th><th>Intitulé</th><th>Nature</th><th>Analytique</th><th></th></tr></thead>
          <tbody>
            {comptes.map((compte) => (
              <tr key={compte.id}>
                <td>{compte.code}</td>
                <td>{compte.libelle}</td>
                <td>{compte.nature}</td>
                <td>{compte.analytique_defaut || "—"}</td>
                <td>
                  <Badge kind={compte.actif ? "ok" : undefined}>{compte.actif ? "Actif" : "Inactif"}</Badge>
                  {can(user.role, "compta.write") ? (
                    <form action={basculerCompte} style={{ display: "inline", marginLeft: "0.4rem" }}>
                      <input type="hidden" name="id" value={compte.id} />
                      <button className="secondary" type="submit">{compte.actif ? "Désactiver" : "Activer"}</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can(user.role, "compta.write") ? (
        <form action={enregistrerCompte} className="panel" style={{ marginTop: "1rem" }}>
          <h2>Ajouter ou renommer un compte</h2>
          <div className="form-grid">
            <label>Numéro<input name="code" required placeholder="6011" /></label>
            <label>Intitulé<input name="libelle" required /></label>
            <label>Nature
              <select name="nature" defaultValue="charge">
                <option value="actif">Actif</option>
                <option value="passif">Passif</option>
                <option value="charge">Charge</option>
                <option value="produit">Produit</option>
                <option value="amortissement">Amortissement</option>
                <option value="analytique">Analytique</option>
              </select>
            </label>
            <label>Analytique par défaut<input name="analytique" placeholder="901" /></label>
          </div>
          <button type="submit">Enregistrer le compte</button>
        </form>
      ) : null}
    </>
  );
}
