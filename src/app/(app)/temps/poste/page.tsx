import { PosteTravail } from "@/components/poste-travail";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getAgent } from "@/lib/hr-store";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";
import { etatJournee } from "@/lib/time-store";

export const metadata = { title: "Poste de travail" };

export default async function Poste({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("temps.self");
  const query = await readQuery(searchParams);
  const requested = Number(query.get("agent"));
  const agentId = requested && can(user.role, "temps.manage") ? requested : user.agent_id;
  if (!agentId) {
    return <PageHeader title="Poste de travail" lede="Ce compte n'est lié à aucun agent. Le comptage démarre depuis la session d'un agent." />;
  }
  const agent = getAgent(agentId);
  const etat = etatJournee(agentId);
  return (
    <>
      <PageHeader
        kicker="Temps de travail"
        title={agent ? `${agent.prenom} ${agent.nom}` : "Poste de travail"}
        lede="La journée s'ouvre quand la session, le visage et une localisation autorisée sont réunis, entre 6 h et 8 h, et se termine entre 15 h et 18 h. Le compteur se bloque après deux minutes sans utilisation. Un shift, un travail planifié ou une exception active élargit la plage, pas ces deux contrôles."
      />
      <PosteTravail initial={etat} agentId={agentId} personnel={agentId === user.agent_id} />
    </>
  );
}
