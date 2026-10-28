import { DateRange, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { declarationTva, etats } from "@/lib/books-store";
import { fcfa } from "@/lib/format";
import { readQuery } from "@/lib/query";
import { exercice, framework } from "@/lib/settings";

export const metadata = { title: "États financiers" };

export default async function Etats({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("compta.read");
  const query = await readQuery(searchParams);
  const bounds = exercice();
  const from = query.get("from") || bounds.from;
  const to = query.get("to") || bounds.to;
  const data = etats(from, to);
  const tva = declarationTva(from, to);
  return (
    <>
      <PageHeader
        kicker={framework()}
        title="États financiers"
        lede="Compte de résultat et bilan simplifié. Le résultat de l'exercice est reporté au bilan tant que l'année n'est pas close, afin que l'actif égale le passif. La situation de TVA est une aide, pas une déclaration officielle."
      />
      <DateRange from={from} to={to} />
      <div className="grid cards-3">
        <article className="card stat"><span>Chiffre d'affaires</span><b>{fcfa(data.ca)}</b></article>
        <article className="card stat"><span>Résultat</span><b>{fcfa(data.resultat.resultat)}</b></article>
        <article className="card stat"><span>TVA nette</span><b>{fcfa(tva.nette)}</b></article>
      </div>
      <div className="grid cards-2" style={{ marginTop: "1rem" }}>
        <section className="panel">
          <h2>Charges</h2>
          <table>
            <tbody>
              {data.resultat.charges.map((row) => <tr key={row.code}><td>{row.code} {row.libelle}</td><td className="num">{fcfa(row.montant)}</td></tr>)}
              <tr><th>Total</th><th className="num">{fcfa(data.resultat.totalCharges)}</th></tr>
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h2>Produits</h2>
          <table>
            <tbody>
              {data.resultat.produits.map((row) => <tr key={row.code}><td>{row.code} {row.libelle}</td><td className="num">{fcfa(row.montant)}</td></tr>)}
              <tr><th>Total</th><th className="num">{fcfa(data.resultat.totalProduits)}</th></tr>
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h2>Actif</h2>
          <table>
            <tbody>
              {data.bilan.actif.map((row) => <tr key={row.libelle}><td>{row.libelle}</td><td className="num">{fcfa(row.montant)}</td></tr>)}
              <tr><th>Total</th><th className="num">{fcfa(data.bilan.totalActif)}</th></tr>
            </tbody>
          </table>
        </section>
        <section className="panel">
          <h2>Passif</h2>
          <table>
            <tbody>
              {data.bilan.passif.map((row) => <tr key={row.libelle}><td>{row.libelle}</td><td className="num">{fcfa(row.montant)}</td></tr>)}
              <tr><th>Total</th><th className="num">{fcfa(data.bilan.totalPassif)}</th></tr>
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
