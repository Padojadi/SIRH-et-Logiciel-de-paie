import { notFound } from "next/navigation";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getEcriture } from "@/lib/books-store";
import { frDate } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Écriture" };

export default async function EcriturePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("compta.read");
  const { id } = await params;
  const { ok, erreur } = await readQuery(searchParams);
  const ecriture = getEcriture(Number(id));
  if (!ecriture) notFound();
  return (
    <>
      <PageHeader kicker={`${ecriture.journal} · ${ecriture.mode}`} title={ecriture.numero_piece} lede={`${frDate(ecriture.date)} — ${ecriture.libelle}`} />
      <Flash ok={ok} erreur={erreur} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Compte</th><th>Libellé</th><th>Analytique</th><th>Lettrage</th><th className="num">Débit</th><th className="num">Crédit</th></tr></thead>
          <tbody>
            {ecriture.lignes.map((ligne, index) => (
              <tr key={index}>
                <td>{ligne.code}<br /><span className="muted">{ligne.compte}</span></td>
                <td>{ligne.libelle}</td>
                <td>{ligne.analytique || "—"}</td>
                <td>{ligne.lettrage || "—"}</td>
                <td className="num">{ligne.debit ? fcfa(ligne.debit) : ""}</td>
                <td className="num">{ligne.credit ? fcfa(ligne.credit) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
