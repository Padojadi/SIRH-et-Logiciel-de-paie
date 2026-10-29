import { importerReleve, pointerAuto, pointerLignes } from "@/app/actions";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { lignesBanqueOuvertes, lignesReleve } from "@/lib/books-store";
import { frDate } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";
import { setting } from "@/lib/settings";

export const metadata = { title: "Trésorerie" };

export default async function Tresorerie({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const releves = lignesReleve();
  const livres = lignesBanqueOuvertes();
  const write = can(user.role, "compta.write");
  return (
    <>
      <PageHeader
        kicker="Comptabilité"
        title="Trésorerie et rapprochement"
        lede={`Compte banque ${setting("compte_banque", "5211")}. Un encaissement du relevé se pointe sur un débit comptable du même montant, un décaissement sur un crédit. L'import accepte OFX, CFONB 120 et un CSV date;libellé;montant.`}
      />
      <Flash ok={query.ok} erreur={query.erreur} />
      {write ? (
        <div className="grid cards-2">
          <form action={importerReleve} className="panel">
            <h2>Importer un relevé</h2>
            <label>Fichier<input type="file" name="fichier" accept=".ofx,.txt,.csv,.cfonb" required /></label>
            <button type="submit">Importer</button>
          </form>
          <form action={pointerAuto} className="panel">
            <h2>Pointage automatique</h2>
            <p>Rapproche les lignes de montant égal, à cinq jours près, lorsqu'une seule écriture correspond.</p>
            <button type="submit">Lancer le pointage</button>
          </form>
        </div>
      ) : null}
      <div className="grid cards-2" style={{ marginTop: "1rem" }}>
        <section className="panel">
          <h2>Relevé</h2>
          <table>
            <thead><tr><th>Date</th><th>Libellé</th><th className="num">Montant</th><th></th></tr></thead>
            <tbody>
              {releves.map((ligne) => (
                <tr key={ligne.id}>
                  <td>{frDate(ligne.date)}</td>
                  <td>{ligne.libelle}</td>
                  <td className="num">{fcfa(ligne.montant)}</td>
                  <td>{ligne.pointe ? <Badge kind="ok">Pointé</Badge> : <Badge kind="warn">Ouvert</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h2>Écritures de banque non pointées</h2>
          <table>
            <thead><tr><th>Date</th><th>Pièce</th><th className="num">Débit</th><th className="num">Crédit</th></tr></thead>
            <tbody>
              {livres.map((ligne) => (
                <tr key={ligne.id}>
                  <td>{frDate(ligne.date)}</td>
                  <td>{ligne.piece}</td>
                  <td className="num">{ligne.debit ? fcfa(ligne.debit) : ""}</td>
                  <td className="num">{ligne.credit ? fcfa(ligne.credit) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      {write ? (
        <form action={pointerLignes} className="panel" style={{ marginTop: "1rem" }}>
          <h2>Pointer manuellement</h2>
          <div className="form-grid">
            <label>Ligne de relevé
              <select name="releve" required>
                {releves.filter((ligne) => !ligne.pointe).map((ligne) => (
                  <option key={ligne.id} value={ligne.id}>{frDate(ligne.date)} · {ligne.libelle} · {fcfa(ligne.montant)}</option>
                ))}
              </select>
            </label>
            <label>Écriture
              <select name="ligne" required>
                {livres.map((ligne) => (
                  <option key={ligne.id} value={ligne.id}>{frDate(ligne.date)} · {ligne.piece} · {fcfa(ligne.debit || ligne.credit)}</option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit">Pointer</button>
        </form>
      ) : null}
    </>
  );
}
