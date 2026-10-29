import { notFound } from "next/navigation";
import { ajouterLocalisation, retirerLocalisation } from "@/app/actions";
import { AgentForm } from "@/components/agent-form";
import { Flash, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { getAgent, listFiches, listOrg } from "@/lib/hr-store";
import { STATUTS_AGENT } from "@/lib/labels";
import { listConventions } from "@/lib/payroll-store";
import { can } from "@/lib/permissions";
import { lieuxAgent } from "@/lib/presence-store";
import { get } from "@/lib/db";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Agent" };

export default async function AgentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("rh.read");
  const { id } = await params;
  const { ok, erreur } = await readQuery(searchParams);
  const agent = getAgent(Number(id));
  if (!agent) notFound();
  const statut = STATUTS_AGENT.find((item) => item[0] === agent.statut)?.[1] ?? agent.statut;
  const lieux = lieuxAgent(agent.id);
  const visage = get<{ enregistre_le: string }>("SELECT enregistre_le FROM identites_faciales WHERE agent_id = ?", [agent.id]);
  const peutLieux = can(user.role, "rh.write");
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
      <section className="panel">
        <h2>Localisations autorisées</h2>
        <p>Le compteur de temps ne démarre que dans l'un de ces périmètres, et seulement si le visage devant la caméra correspond à l'identité enregistrée.</p>
        <p>{visage ? `Visage enregistré le ${visage.enregistre_le.slice(0, 16).replace("T", " ")}, heure de Dakar.` : "Visage non enregistré. L'agent le capture dans Mon accès, après son mot de passe personnel."}</p>
        {lieux.length === 0 ? <p>Aucun lieu.</p> : (
          <table>
            <thead><tr><th>Lieu</th><th className="num">Latitude</th><th className="num">Longitude</th><th className="num">Rayon</th><th></th></tr></thead>
            <tbody>
              {lieux.map((lieu) => (
                <tr key={lieu.id}>
                  <td>{lieu.nom}</td>
                  <td className="num">{lieu.latitude}</td>
                  <td className="num">{lieu.longitude}</td>
                  <td className="num">{lieu.rayon_metres} m</td>
                  <td>
                    {peutLieux ? (
                      <form action={retirerLocalisation}>
                        <input type="hidden" name="id" value={lieu.id} />
                        <input type="hidden" name="agent_id" value={agent.id} />
                        <button className="secondary" type="submit">Retirer</button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {peutLieux ? (
          <form action={ajouterLocalisation} className="form-grid">
            <input type="hidden" name="agent_id" value={agent.id} />
            <label>Nom<input name="nom" required placeholder="Siège, agence, chantier" /></label>
            <label>Latitude<input name="latitude" required inputMode="decimal" placeholder="14.6937" /></label>
            <label>Longitude<input name="longitude" required inputMode="decimal" placeholder="-17.4441" /></label>
            <label>Rayon (mètres)<input name="rayon" required inputMode="numeric" defaultValue="200" /></label>
            <button type="submit">Ajouter le lieu</button>
          </form>
        ) : null}
      </section>
    </>
  );
}
