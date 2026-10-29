import { regulariserTemps } from "@/app/actions";
import { Badge, DateRange, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { formatHeureCourte, frDate } from "@/lib/dates";
import { defaultEvalRange, listAgents } from "@/lib/hr-store";
import { ARRIVEE } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";
import { journeesPeriode } from "@/lib/time-store";

export const metadata = { title: "Journées" };

export default async function Journees({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("temps.read");
  const query = await readQuery(searchParams);
  const fallback = defaultEvalRange();
  const from = query.get("from") || fallback.from;
  const to = query.get("to") || fallback.to;
  const lignes = journeesPeriode(from, to);
  const taches = all<{ id: number; title: string; code: string }>(
    "SELECT t.id, t.title, f.code FROM fiche_taches t JOIN fiches f ON f.id = t.fiche_id ORDER BY f.code, t.ordre",
  );
  return (
    <>
      <PageHeader
        kicker="Temps de travail"
        title="Journées"
        lede="Temps compté devant le système et régularisations, pour une mission ou un travail qui n'a pas pu rester affiché à l'écran."
      />
      <Flash ok={query.ok} erreur={query.erreur} />
      <DateRange from={from} to={to} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Date</th><th>Agent</th><th>Unité</th><th>Arrivée</th><th className="num">Temps</th></tr></thead>
          <tbody>
            {lignes.map((ligne) => (
              <tr key={ligne.id}>
                <td>{frDate(ligne.date)}</td>
                <td>{ligne.matricule} {ligne.prenom} {ligne.nom}</td>
                <td>{ligne.org_nom ?? "—"}</td>
                <td>{ligne.statut_arrivee ? <Badge>{ARRIVEE[ligne.statut_arrivee as keyof typeof ARRIVEE] ?? ligne.statut_arrivee}</Badge> : "—"}</td>
                <td className="num">{formatHeureCourte(ligne.secondes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {can(user.role, "temps.manage") ? (
        <form action={regulariserTemps} className="panel" style={{ marginTop: "1rem" }}>
          <h2>Régulariser un temps</h2>
          <div className="form-grid">
            <label>Agent
              <select name="agent_id" required>
                {listAgents().filter((agent) => agent.actif).map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.matricule} — {agent.prenom} {agent.nom}</option>
                ))}
              </select>
            </label>
            <label>Date<input type="date" name="date" required /></label>
            <label>Durée (heures)<input name="heures" inputMode="decimal" required placeholder="2,5" /></label>
            <label>Tâche de la fiche
              <select name="tache_id" defaultValue="">
                <option value="">Non imputée</option>
                {taches.map((tache) => <option key={tache.id} value={tache.id}>{tache.code} — {tache.title}</option>)}
              </select>
            </label>
            <label className="span-2">Motif<input name="motif" required placeholder="Mission hors site, formation, panne du poste…" /></label>
          </div>
          <button type="submit">Enregistrer la régularisation</button>
        </form>
      ) : null}
    </>
  );
}
