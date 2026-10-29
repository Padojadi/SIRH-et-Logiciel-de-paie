import Link from "next/link";
import { Badge, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listFiches, type Fiche } from "@/lib/hr-store";
import { can } from "@/lib/permissions";

export const metadata = { title: "Fiches de poste" };

const STATUT: Record<string, string> = { brouillon: "Brouillon", active: "Active", archivee: "Archivée" };

export default async function Fiches() {
  const user = await requireUser("rh.read");
  const fiches = listFiches() as (Fiche & { minutes: number })[];
  return (
    <>
      <PageHeader
        kicker="Ressources humaines"
        title="Fiches de poste"
        lede="Chaque fiche décrit la mission et le temps prévu par tâche. Elle sert de référence au compteur et à l'évaluation de la charge."
        actions={can(user.role, "rh.write") ? <LinkButton href="/rh/fiches/nouvelle">Nouvelle fiche</LinkButton> : null}
      />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Code</th><th>Intitulé</th><th>Unité</th><th>Statut</th><th className="num">Charge / jour</th><th></th></tr></thead>
          <tbody>
            {fiches.map((fiche) => (
              <tr key={fiche.id}>
                <td><Link href={`/rh/fiches/${fiche.id}`}>{fiche.code}</Link></td>
                <td>{fiche.title}</td>
                <td>{fiche.org_nom ?? "—"}</td>
                <td><Badge kind={fiche.status === "active" ? "ok" : undefined}>{STATUT[fiche.status] ?? fiche.status}</Badge></td>
                <td className="num">{Math.floor(fiche.minutes / 60)} h {String(fiche.minutes % 60).padStart(2, "0")}</td>
                <td><a href={`/api/fichier?type=fiche-pdf&id=${fiche.id}`}>PDF</a> · <a href={`/api/fichier?type=fiche-docx&id=${fiche.id}`}>Word</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
