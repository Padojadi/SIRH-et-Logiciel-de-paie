import Link from "next/link";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { etats } from "@/lib/books-store";
import { all } from "@/lib/db";
import { dakarToday, formatHeureCourte, frMois, monthStart } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { defaultEvalRange, evaluer, scopeFor } from "@/lib/hr-store";
import { AVIS_FICHE, AVIS_UNITE } from "@/lib/labels";
import { listPeriodes } from "@/lib/payroll-store";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";
import { exercice } from "@/lib/settings";
import { etatJournee } from "@/lib/time-store";

export const metadata = { title: "Tableau de bord" };

export default async function TableauDeBord({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const { ok, erreur } = await readQuery(searchParams);
  const today = dakarToday();
  const books = exercice();
  const finances = can(user.role, "compta.read") ? etats(books.from, books.to) : null;
  const mois = can(user.role, "compta.read") ? etats(monthStart(today), today) : null;
  const range = defaultEvalRange();
  const evaluation = can(user.role, "eval") ? evaluer(range.from, range.to, scopeFor(user)) : null;
  const periode = can(user.role, "paie.read") ? listPeriodes()[0] : undefined;
  const propre = user.agent_id ? etatJournee(user.agent_id) : null;
  const bulletins = user.agent_id
    ? all<{ id: number; mois: string; net: number }>(
      `SELECT b.id, p.mois, b.net FROM bulletins b JOIN periodes_paie p ON p.id = b.periode_id
       WHERE b.agent_id = ? ORDER BY p.mois DESC LIMIT 3`,
      [user.agent_id],
    )
    : [];
  const avisPerso = user.agent_id ? evaluer(range.from, range.to).agents.find((agent) => agent.id === user.agent_id) : undefined;
  const recruter = evaluation?.unites.filter((unit) => unit.avis === "recruter").length ?? 0;
  const reaffecter = evaluation?.unites.filter((unit) => unit.avis === "reaffecter").length ?? 0;

  return (
    <>
      <PageHeader
        kicker="Aujourd'hui"
        title={`Bonjour ${user.name.split(" ")[0]}`}
        lede="Vue d'ensemble de l'activité, des effectifs et de la situation financière de l'organisation."
      />
      <Flash ok={ok} erreur={erreur} />
      <div className="grid stats">
        {finances ? (
          <>
            <article className="card stat"><span>Chiffre d'affaires de l'exercice</span><b>{fcfa(finances.ca)}</b></article>
            <article className="card stat"><span>Créances clients</span><b>{fcfa(finances.creances)}</b></article>
            <article className="card stat"><span>Trésorerie disponible</span><b>{fcfa(finances.tresorerie)}</b></article>
            <article className="card stat"><span>Résultat du mois</span><b>{fcfa(mois?.resultat.resultat ?? 0)}</b></article>
          </>
        ) : null}
        {evaluation ? (
          <>
            <article className="card stat"><span>Agents évalués</span><b>{evaluation.agents.length}</b></article>
            <article className="card stat"><span>Unités à recruter</span><b>{recruter}</b></article>
            <article className="card stat"><span>Unités à réaffecter</span><b>{reaffecter}</b></article>
            <article className="card stat"><span>Fiches à alléger</span><b>{evaluation.agents.filter((agent) => agent.avis === "alleger").length}</b></article>
          </>
        ) : null}
        {periode ? (
          <article className="card stat"><span>Dernière paie</span><b>{frMois(periode.mois)}</b><span>{periode.statut}</span></article>
        ) : null}
        {propre ? (
          <article className="card stat"><span>Temps compté aujourd'hui</span><b>{formatHeureCourte(propre.secondes)}</b><span>{propre.dansLaPlage ? "Dans la plage" : "Hors plage"}</span></article>
        ) : null}
      </div>
      <div className="grid cards-2" style={{ marginTop: "1rem" }}>
        {propre ? (
          <section className="panel">
            <h2>Poste de travail</h2>
            <p>{propre.fiche || "Aucune fiche n'est encore attachée à votre dossier."}</p>
            {avisPerso ? <p>Avis sur la période : {AVIS_FICHE[avisPerso.avis]}.</p> : null}
            <Link className="button" href="/temps/poste">Ouvrir le compteur</Link>
          </section>
        ) : null}
        {bulletins.length ? (
          <section className="panel">
            <h2>Mes bulletins</h2>
            <ul>
              {bulletins.map((bulletin) => (
                <li key={bulletin.id}>
                  <Link href={`/paie/bulletins/${bulletin.id}`}>{frMois(bulletin.mois)}</Link> — {fcfa(bulletin.net)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {evaluation ? (
          <section className="panel">
            <h2>Décisions d'effectifs</h2>
            <p className="muted">Période du {range.from.split("-").reverse().join("/")} au {range.to.split("-").reverse().join("/")}.</p>
            <ul>
              {evaluation.unites.filter((unit) => unit.effectif > 0 && unit.avis !== "effectif_suffisant").slice(0, 6).map((unit) => (
                <li key={unit.id}>{unit.nom} — {AVIS_UNITE[unit.avis]}</li>
              ))}
            </ul>
            <Link href="/rh/evaluations">Voir les évaluations</Link>
          </section>
        ) : null}
      </div>
    </>
  );
}
