import Link from "next/link";
import { Badge, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { listAgents } from "@/lib/hr-store";
import { STATUTS_AGENT } from "@/lib/labels";
import { can } from "@/lib/permissions";

export const metadata = { title: "Agents" };

export default async function Agents() {
  const user = await requireUser("rh.read");
  const agents = listAgents();
  const statut = (value: string) => STATUTS_AGENT.find((item) => item[0] === value)?.[1] ?? value;
  return (
    <>
      <PageHeader
        kicker="Ressources humaines"
        title="Agents"
        lede="Titulaires, vacataires et stagiaires, avec leur unité, leur fiche de poste et leur convention."
        actions={can(user.role, "rh.write") ? <LinkButton href="/rh/agents/nouveau">Nouvel agent</LinkButton> : null}
      />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Matricule</th><th>Nom</th><th>Statut</th><th>Unité</th><th>Fiche</th><th className="num">Base</th></tr></thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id}>
                <td><Link href={`/rh/agents/${agent.id}`}>{agent.matricule}</Link></td>
                <td>{agent.prenom} {agent.nom}{agent.actif ? "" : " (inactif)"}</td>
                <td><Badge>{statut(agent.statut)}</Badge></td>
                <td>{agent.org_nom ?? "—"}</td>
                <td>{agent.fiche_titre ?? "—"}</td>
                <td className="num">{agent.statut === "vacataire" ? fcfa(agent.taux_journalier) : fcfa(agent.salaire_base)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
