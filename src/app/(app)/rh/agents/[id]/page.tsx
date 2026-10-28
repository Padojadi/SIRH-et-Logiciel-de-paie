import { notFound } from "next/navigation";
import { AgentForm } from "@/components/agent-form";
import { Flash, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { getAgent, listFiches, listOrg } from "@/lib/hr-store";
import { STATUTS_AGENT } from "@/lib/labels";
import { listConventions } from "@/lib/payroll-store";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Agent" };

export default async function AgentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("rh.read");
  const { id } = await params;
  const { ok, erreur } = await readQuery(searchParams);
  const agent = getAgent(Number(id));
  if (!agent) notFound();
  const statut = STATUTS_AGENT.find((item) => item[0] === agent.statut)?.[1] ?? agent.statut;
  return (
    <>
      <PageHeader
        kicker={agent.matricule}
        title={`${agent.prenom} ${agent.nom}`}
        lede={`${statut} · ${agent.poste || "Poste non renseigné"} · ${agent.org_nom ?? "Sans unité"}`}
        actions={agent.fiche_id ? <LinkButton href={`/rh/fiches/${agent.fiche_id}`} secondary>Ouvrir la fiche</LinkButton> : null}
      />
      <Flash ok={ok} erreur={erreur} />
      {can(user.role, "rh.write") ? (
        <AgentForm
          agent={agent}
          unites={listOrg().map((unit) => ({ id: unit.id, label: `${unit.code} — ${unit.name}` }))}
          fiches={listFiches().map((fiche) => ({ id: fiche.id, label: `${fiche.code} — ${fiche.title}` }))}
          conventions={listConventions().map((item) => ({ id: item.id, label: item.name }))}
        />
      ) : (
        <section className="panel">
          <p>Convention : {agent.convention_nom ?? "aucune"}.</p>
          <p>Fiche : {agent.fiche_titre ?? "aucune"}.</p>
          <p>Rémunération : {agent.statut === "vacataire" ? `${fcfa(agent.taux_journalier)} par jour` : fcfa(agent.salaire_base)}.</p>
          <p>Parts fiscales : {agent.parts_fiscales}. {agent.actif ? "Dossier actif." : "Dossier inactif."}</p>
        </section>
      )}
    </>
  );
}
