import { creerUnite } from "@/app/actions";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listOrg } from "@/lib/hr-store";
import { ORG_TYPES, orgTypeLabel } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Organisation" };

export default async function Organisation({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("rh.read");
  const { ok, erreur } = await readQuery(searchParams);
  const unites = listOrg();
  const noms = new Map(unites.map((unit) => [unit.id, unit.name]));
  return (
    <>
      <PageHeader kicker="Ressources humaines" title="Organisation" lede="Directions, services, bureaux, cellules et unités. L'évaluation des effectifs suit cet arbre." />
      <Flash ok={ok} erreur={erreur} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Code</th><th>Nom</th><th>Type</th><th>Rattachement</th></tr></thead>
          <tbody>
            {unites.map((unit) => (
              <tr key={unit.id}>
                <td>{unit.code}</td>
                <td>{unit.name}</td>
                <td>{orgTypeLabel(unit.type)}</td>
                <td>{unit.parent_id ? noms.get(unit.parent_id) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can(user.role, "rh.write") ? (
        <form action={creerUnite} className="panel" style={{ marginTop: "1rem" }}>
          <h2>Nouvelle unité</h2>
          <div className="form-grid">
            <label>Code<input name="code" required placeholder="DRH" /></label>
            <label>Nom<input name="nom" required /></label>
            <label>Type
              <select name="type" defaultValue="service">
                {ORG_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Rattachement
              <select name="parent" defaultValue="">
                <option value="">Racine</option>
                {unites.map((unit) => <option key={unit.id} value={unit.id}>{unit.code} — {unit.name}</option>)}
              </select>
            </label>
          </div>
          <p className="muted">Le code contient 2 à 12 lettres ou chiffres.</p>
          <button type="submit">Créer l'unité</button>
        </form>
      ) : null}
    </>
  );
}
