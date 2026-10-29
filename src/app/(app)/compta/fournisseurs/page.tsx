import { ajouterFacture, ajouterFournisseur, preparerRemise, validerFactureAction } from "@/app/actions";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { comptesSaisie, listFactures, listFournisseurs, listRemises } from "@/lib/books-store";
import { frDate } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Fournisseurs" };

const STATUT: Record<string, string> = { brouillon: "Brouillon", validee: "Validée", reglee: "Réglée" };

export default async function Fournisseurs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const fournisseurs = listFournisseurs();
  const factures = listFactures();
  const write = can(user.role, "compta.write");
  const charges = comptesSaisie().filter((compte) => compte.code.startsWith("6"));
  return (
    <>
      <PageHeader
        kicker="Comptabilité"
        title="Fournisseurs"
        lede="Validation des factures, préparation des règlements et remise en banque. La TVA est calculée au taux des paramètres."
      />
      <Flash ok={query.ok} erreur={query.erreur} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Fournisseur</th><th>NIF</th><th>Compte</th><th>IBAN</th></tr></thead>
          <tbody>
            {fournisseurs.map((item) => (
              <tr key={item.id}><td>{item.nom}</td><td>{item.nif || "—"}</td><td>{item.compte_code}</td><td>{item.iban || "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {write ? (
        <form action={ajouterFournisseur} className="form-grid panel" style={{ marginTop: "1rem" }}>
          <label>Nom<input name="nom" required /></label>
          <label>NIF<input name="nif" /></label>
          <label>IBAN<input name="iban" /></label>
          <label>Compte<input name="compte" defaultValue="4011" /></label>
          <div><button type="submit">Ajouter</button></div>
        </form>
      ) : null}
      <h2 style={{ marginTop: "1.2rem" }}>Factures</h2>
      <form action={preparerRemise}>
        <div className="table-wrap panel">
          <table>
            <thead><tr>{write ? <th></th> : null}<th>Numéro</th><th>Fournisseur</th><th>Date</th><th>Échéance</th><th className="num">TTC</th><th>Statut</th><th></th></tr></thead>
            <tbody>
              {factures.map((facture) => (
                <tr key={facture.id}>
                  {write ? <td>{facture.statut === "validee" ? <input type="checkbox" name="facture" value={facture.id} /> : null}</td> : null}
                  <td>{facture.numero}</td>
                  <td>{facture.fournisseur}</td>
                  <td>{frDate(facture.date_facture)}</td>
                  <td>{facture.echeance ? frDate(facture.echeance) : "—"}</td>
                  <td className="num">{fcfa(facture.ttc)}</td>
                  <td><Badge kind={facture.statut === "reglee" ? "ok" : facture.statut === "validee" ? "info" : "warn"}>{STATUT[facture.statut] ?? facture.statut}</Badge></td>
                  <td>
                    {write && facture.statut === "brouillon" ? (
                      <button formAction={validerFactureAction} name="id" value={facture.id} type="submit">Valider</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {write ? <button type="submit" style={{ marginTop: "0.6rem" }}>Préparer la remise des factures cochées</button> : null}
      </form>
      {write ? (
        <form action={ajouterFacture} className="panel" style={{ marginTop: "1rem" }}>
          <h2>Nouvelle facture</h2>
          <div className="form-grid">
            <label>Fournisseur
              <select name="fournisseur_id" required>
                {fournisseurs.map((item) => <option key={item.id} value={item.id}>{item.nom}</option>)}
              </select>
            </label>
            <label>Numéro<input name="numero" required /></label>
            <label>Date<input type="date" name="date" required /></label>
            <label>Échéance<input type="date" name="echeance" /></label>
            <label>Montant HT<input name="ht" inputMode="numeric" required /></label>
            <label>Compte de charge
              <input name="compte" list="charges" required defaultValue="6051" />
            </label>
          </div>
          <datalist id="charges">{charges.map((compte) => <option key={compte.code} value={compte.code}>{compte.libelle}</option>)}</datalist>
          <button type="submit">Créer le brouillon</button>
        </form>
      ) : null}
      <h2 style={{ marginTop: "1.2rem" }}>Remises</h2>
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Date</th><th>Référence</th><th className="num">Montant</th><th>Statut</th></tr></thead>
          <tbody>
            {listRemises().map((remise) => (
              <tr key={remise.id}><td>{frDate(remise.date)}</td><td>{remise.reference}</td><td className="num">{fcfa(remise.montant)}</td><td>{remise.statut}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
