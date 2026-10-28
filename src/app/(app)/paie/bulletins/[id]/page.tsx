import { notFound, redirect } from "next/navigation";
import { LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { frMois } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { getBulletin } from "@/lib/payroll-store";
import { can } from "@/lib/permissions";
import type { BulletinResult } from "@/lib/payroll-engine";

export const metadata = { title: "Bulletin" };

export default async function BulletinPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const bulletin = getBulletin(Number(id));
  if (!bulletin) notFound();
  if (!can(user.role, "paie.read") && bulletin.agent_id !== user.agent_id) {
    redirect("/tableau-de-bord?erreur=Vous n'avez pas accès à ce bulletin.");
  }
  const detail = JSON.parse(bulletin.detail_json) as BulletinResult;
  return (
    <>
      <PageHeader
        kicker={bulletin.matricule}
        title={`${bulletin.prenom} ${bulletin.nom}`}
        lede={`${frMois(bulletin.mois)} · ${bulletin.poste} · ${bulletin.convention ?? "sans convention"} · ${bulletin.parts_fiscales} part(s)`}
        actions={<LinkButton href={`/api/fichier?type=bulletin&id=${bulletin.id}`}>Télécharger le PDF</LinkButton>}
      />
      <section className="panel">
        <table>
          <thead><tr><th>Élément</th><th className="num">Base</th><th className="num">Taux</th><th className="num">Gain</th><th className="num">Retenue</th><th className="num">Part employeur</th></tr></thead>
          <tbody>
            {detail.lignes.map((ligne) => (
              <tr key={ligne.code}>
                <td>{ligne.libelle}</td>
                <td className="num">{ligne.base ? fcfa(ligne.base) : ""}</td>
                <td className="num">{ligne.taux != null ? `${Math.round(ligne.taux * 1000) / 10} %` : ""}</td>
                <td className="num">{ligne.gain ? fcfa(ligne.gain) : ""}</td>
                <td className="num">{ligne.retenue ? fcfa(ligne.retenue) : ""}</td>
                <td className="num">{ligne.partEmployeur ? fcfa(ligne.partEmployeur) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Net à payer : <strong>{fcfa(bulletin.net)}</strong> · Charges patronales : {fcfa(bulletin.charges_patronales)}</p>
      </section>
    </>
  );
}
