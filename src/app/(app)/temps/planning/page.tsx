import { affecterShift, enregistrerShift, planifierTravail, supprimerPlan } from "@/app/actions";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { frDate } from "@/lib/dates";
import { listAgents, listOrg } from "@/lib/hr-store";
import { readQuery } from "@/lib/query";
import { listAssignments, listPlans, listShifts } from "@/lib/time-store";

export const metadata = { title: "Shifts et travaux" };

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default async function Planning({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("temps.manage");
  const query = await readQuery(searchParams);
  const agents = listAgents().filter((agent) => agent.actif);
  const unites = listOrg();
  const taches = all<{ id: number; title: string; code: string }>(
    "SELECT t.id, t.title, f.code FROM fiche_taches t JOIN fiches f ON f.id = t.fiche_id ORDER BY f.code, t.ordre",
  );
  return (
    <>
      <PageHeader
        kicker="Temps de travail"
        title="Shifts et travaux planifiés"
        lede="Un shift remplace la plage standard : l'arrivée est à l'heure pendant les deux premières heures. Un travail planifié ajoute une fenêtre, y compris le week-end. Les deux entrent dans le temps théorique de l'évaluation."
      />
      <Flash ok={query.ok} erreur={query.erreur} />
      <div className="grid cards-2">
        <section className="panel">
          <h2>Shifts</h2>
          <table>
            <thead><tr><th>Nom</th><th>Horaires</th><th>Jours</th></tr></thead>
            <tbody>
              {listShifts().map((shift) => (
                <tr key={shift.id}>
                  <td>{shift.name}</td>
                  <td>{shift.start_time} – {shift.end_time}</td>
                  <td>{shift.jours.split(",").map((jour) => JOURS[Number(jour) - 1]).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Nouveau shift</h3>
          <form action={enregistrerShift} className="grid">
            <label>Nom<input name="name" required /></label>
            <label>Début<input type="time" name="start_time" required /></label>
            <label>Fin<input type="time" name="end_time" required /></label>
            <label>Unité
              <select name="org_unit_id" defaultValue="">
                <option value="">—</option>
                {unites.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </label>
            <div className="actions">
              {JOURS.map((jour, index) => (
                <label className="check" key={jour}><input type="checkbox" name="jours" value={index + 1} defaultChecked={index < 5} /> {jour}</label>
              ))}
            </div>
            <button type="submit">Enregistrer le shift</button>
          </form>
        </section>
        <section className="panel">
          <h2>Affectations</h2>
          <table>
            <thead><tr><th>Agent</th><th>Shift</th><th>Depuis</th></tr></thead>
            <tbody>
              {listAssignments().map((item) => (
                <tr key={item.id}><td>{item.prenom} {item.nom}</td><td>{item.shift_nom}</td><td>{item.date_debut ? frDate(item.date_debut) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
          <form action={affecterShift} className="grid" style={{ marginTop: "0.8rem" }}>
            <label>Agent
              <select name="agent_id">{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.prenom} {agent.nom}</option>)}</select>
            </label>
            <label>Shift
              <select name="shift_id">{listShifts().map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}</select>
            </label>
            <label>À partir du<input type="date" name="date_debut" required /></label>
            <button type="submit">Affecter</button>
          </form>
        </section>
      </div>
      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2>Travaux planifiés</h2>
        <table>
          <thead><tr><th>Date</th><th>Agent</th><th>Horaire</th><th>Libellé</th><th></th></tr></thead>
          <tbody>
            {listPlans().map((plan) => (
              <tr key={plan.id}>
                <td>{frDate(plan.date)}</td>
                <td>{plan.agent_nom}</td>
                <td>{plan.start_time} – {plan.end_time}</td>
                <td>{plan.libelle}</td>
                <td>
                  <form action={supprimerPlan}>
                    <input type="hidden" name="id" value={plan.id} />
                    <button className="secondary" type="submit">Retirer</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form action={planifierTravail} className="form-grid" style={{ marginTop: "0.8rem" }}>
          <label>Agent
            <select name="agent_id">{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.prenom} {agent.nom}</option>)}</select>
          </label>
          <label>Date<input type="date" name="date" required /></label>
          <label>Début<input type="time" name="start_time" required /></label>
          <label>Fin<input type="time" name="end_time" required /></label>
          <label>Tâche
            <select name="tache_id" defaultValue="">
              <option value="">—</option>
              {taches.map((tache) => <option key={tache.id} value={tache.id}>{tache.code} — {tache.title}</option>)}
            </select>
          </label>
          <label>Libellé<input name="libelle" required /></label>
          <div><button type="submit">Planifier</button></div>
        </form>
      </section>
    </>
  );
}
