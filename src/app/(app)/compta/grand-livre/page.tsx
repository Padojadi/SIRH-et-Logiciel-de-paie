import { faireLettrage } from "@/app/actions";
import { DateRange, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { livre } from "@/lib/books-store";
import { frDate } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";
import { exercice } from "@/lib/settings";

export const metadata = { title: "Grand livre" };

export default async function GrandLivre({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const bounds = exercice();
  const from = query.get("from") || bounds.from;
  const to = query.get("to") || bounds.to;
  const compte = query.get("compte") ?? "";
  const books = livre(from, to, compte || undefined);
  return (
    <>
      <PageHeader
        kicker="Comptabilité"
        title="Grand livre"
        lede="Le report à nouveau reprend le solde antérieur à la période. Le lettrage rapproche des lignes d'un même compte dont le débit égale le crédit."
        actions={<LinkButton href={`/api/fichier?type=grand-livre&from=${from}&to=${to}&compte=${encodeURIComponent(compte)}`} secondary>Excel</LinkButton>}
      />
      {query.ok ? <p className="flash ok">{query.ok}</p> : null}
      {query.erreur ? <p className="flash err">{query.erreur}</p> : null}
      <DateRange from={from} to={to} />
      <form className="actions" method="get">
        <input type="hidden" name="from" value={from} />
        <input type="hidden" name="to" value={to} />
        <label>Compte<input name="compte" defaultValue={compte} placeholder="401" /></label>
        <button className="secondary" type="submit">Filtrer</button>
      </form>
      {books.map((book) => (
        <section className="panel" key={book.code} style={{ marginTop: "0.8rem" }}>
          <h2>{book.code} — {book.libelle}</h2>
          <form action={faireLettrage}>
            <input type="hidden" name="compte" value={book.code} />
            <table>
              <thead><tr>{can(user.role, "compta.write") ? <th></th> : null}<th>Date</th><th>Journal</th><th>Pièce</th><th>Libellé</th><th className="num">Débit</th><th className="num">Crédit</th><th className="num">Solde</th><th>Lettrage</th></tr></thead>
              <tbody>
                {book.lignes.map((ligne, index) => (
                  <tr key={`${ligne.ligneId}-${index}`}>
                    {can(user.role, "compta.write") ? <td>{ligne.ligneId ? <input type="checkbox" name="ligne" value={ligne.ligneId} /> : null}</td> : null}
                    <td>{frDate(ligne.date)}</td>
                    <td>{ligne.journal}</td>
                    <td>{ligne.piece}</td>
                    <td>{ligne.libelle}</td>
                    <td className="num">{ligne.debit ? fcfa(ligne.debit) : ""}</td>
                    <td className="num">{ligne.credit ? fcfa(ligne.credit) : ""}</td>
                    <td className="num">{fcfa(ligne.solde)}</td>
                    <td>{ligne.lettrage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">Totaux {fcfa(book.totalDebit)} / {fcfa(book.totalCredit)}</p>
            {can(user.role, "compta.write") ? (
              <div className="actions">
                <label>Code de lettrage<input name="code" maxLength={4} placeholder="A1" /></label>
                <button className="secondary" type="submit">Lettrer la sélection</button>
              </div>
            ) : null}
          </form>
        </section>
      ))}
    </>
  );
}
