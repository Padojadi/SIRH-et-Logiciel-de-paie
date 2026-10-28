import Link from "next/link";
import { LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { frMois } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { all } from "@/lib/db";
import { defaultEvalRange, evaluer, getAgent, getFiche } from "@/lib/hr-store";
import { AVIS_FICHE } from "@/lib/labels";

export const metadata = { title: "Ma fiche de poste" };

export default async function MaFiche() {
  const user = await requireUser("rh.self");
  const agent = user.agent_id ? getAgent(user.agent_id) : undefined;
  const fiche = agent?.fiche_id ? getFiche(agent.fiche_id) : undefined;
  const range = defaultEvalRange();
  const avis = agent ? evaluer(range.from, range.to).agents.find((item) => item.id === agent.id) : undefined;
  const bulletins = agent
    ? all<{ id: number; mois: string; net: number }>(
      `SELECT b.id, p.mois, b.net FROM bulletins b JOIN periodes_paie p ON p.id = b.periode_id WHERE b.agent_id = ? ORDER BY p.mois DESC`,
      [agent.id],
    )
    : [];
  if (!fiche) {
    return (
      <>
        <PageHeader title="Ma fiche de poste" lede="Aucune fiche n'est encore attachée à votre dossier." />
      </>
    );
  }
  const total = (fiche.taches ?? []).reduce((sum, task) => sum + task.minutes_par_jour, 0);
  return (
    <>
      <PageHeader
        kicker={fiche.code}
        title={fiche.title}
        lede={avis ? `Avis de la période en cours : ${AVIS_FICHE[avis.avis]}.` : "Votre fiche décrit le travail attendu et le temps prévu."}
        actions={
          <>
            <LinkButton href={`/api/fichier?type=fiche-pdf&id=${fiche.id}`} secondary>PDF</LinkButton>
            <LinkButton href={`/api/fichier?type=fiche-docx&id=${fiche.id}`} secondary>Word</LinkButton>
          </>
        }
      />
      <section className="panel">
        <h2>Mission</h2>
        <p>{fiche.mission}</p>
        <p className="muted">Charge prévue : {Math.floor(total / 60)} h {String(total % 60).padStart(2, "0")} par jour.</p>
        <table>
          <thead><tr><th>Tâche</th><th>Description</th><th className="num">Minutes</th></tr></thead>
          <tbody>
            {(fiche.taches ?? []).map((task) => (
              <tr key={task.id}><td>{task.title}</td><td>{task.description}</td><td className="num">{task.minutes_par_jour}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      {bulletins.length ? (
        <section className="panel" style={{ marginTop: "1rem" }}>
          <h2>Bulletins</h2>
          <ul>
            {bulletins.map((bulletin) => (
              <li key={bulletin.id}><Link href={`/paie/bulletins/${bulletin.id}`}>{frMois(bulletin.mois)}</Link> — net {fcfa(bulletin.net)}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
