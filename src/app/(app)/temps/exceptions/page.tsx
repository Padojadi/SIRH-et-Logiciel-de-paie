import { basculerException, enregistrerException } from "@/app/actions";
import { Badge, Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { frDate } from "@/lib/dates";
import { listAgents, listOrg } from "@/lib/hr-store";
import { readQuery } from "@/lib/query";
import { listExceptions } from "@/lib/time-store";

export const metadata = { title: "Exceptions de temps" };

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default async function Exceptions({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("temps.manage");
  const query = await readQuery(searchParams);
  const exceptions = listExceptions();
  const agents = listAgents();
  const noms = new Map(agents.map((agent) => [agent.id, `${agent.prenom} ${agent.nom}`]));
  const unites = listOrg();
  return (
    <>
      <PageHeader
        kicker="Temps de travail"
        title="Exceptions"
        lede="Une exception active peut continuer le comptage hors de la plage habituelle, ou malgré deux minutes sans utilisation. Elle peut viser un agent, une unité ou tout le monde, sur des jours et des heures précis. Le poste doit rester ouvert : la régularisation couvre le travail sans écran."
      />
      <Flash ok={query.ok} erreur={query.erreur} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Nom</th><th>Portée</th><th>Période</th><th>Heures</th><th>Effet</th><th></th></tr></thead>
          <tbody>
            {exceptions.map((item) => (
              <tr key={item.id}>
                <td>{item.nom}<br /><span className="muted">{item.motif}</span></td>
                <td>{item.portee === "agent" ? noms.get(item.agent_id ?? 0) : item.portee === "unite" ? unites.find((unit) => unit.id === item.org_unit_id)?.name : "Tous"}</td>
                <td>{item.date_debut ? frDate(item.date_debut) : "—"} → {item.date_fin ? frDate(item.date_fin) : "—"}</td>
                <td>{item.heure_debut && item.heure_fin ? `${item.heure_debut} – ${item.heure_fin}` : "Toute la journée"}</td>
                <td>
                  <Badge kind={item.active ? "ok" : undefined}>{item.active ? "Active" : "Inactive"}</Badge>
                  {item.compter_hors_plage ? " hors plage" : ""}
                  {item.compter_malgre_inactivite ? " malgré l'inactivité" : ""}
                </td>
                <td>
                  <form action={basculerException}>
                    <input type="hidden" name="id" value={item.id} />
                    <button className="secondary" type="submit">{item.active ? "Désactiver" : "Activer"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={enregistrerException} className="panel" style={{ marginTop: "1rem" }}>
        <h2>Ajouter une exception</h2>
        <div className="form-grid">
          <label>Nom<input name="nom" required /></label>
          <label>Motif<input name="motif" required /></label>
          <label>Portée
            <select name="portee" defaultValue="agent">
              <option value="agent">Un agent</option>
              <option value="unite">Une unité et ses enfants</option>
              <option value="tous">Tous les agents</option>
            </select>
          </label>
          <label>Agent
            <select name="agent_id" defaultValue="">
              <option value="">—</option>
              {agents.filter((agent) => agent.actif).map((agent) => <option key={agent.id} value={agent.id}>{agent.prenom} {agent.nom}</option>)}
            </select>
          </label>
          <label>Unité
            <select name="org_unit_id" defaultValue="">
              <option value="">—</option>
              {unites.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
            </select>
          </label>
          <label>Du<input type="date" name="date_debut" /></label>
          <label>Au<input type="date" name="date_fin" /></label>
          <label>Heure de début<input type="time" name="heure_debut" /></label>
          <label>Heure de fin<input type="time" name="heure_fin" /></label>
          <div className="span-2">
            <span className="muted">Jours</span>
            <div className="actions">
              {JOURS.map((jour, index) => (
                <label className="check" key={jour}><input type="checkbox" name="jours" value={index + 1} defaultChecked={index < 5} /> {jour}</label>
              ))}
            </div>
          </div>
          <label className="check"><input type="checkbox" name="active" defaultChecked /> Activer immédiatement</label>
          <label className="check"><input type="checkbox" name="compter_hors_plage" defaultChecked /> Compter hors de la plage habituelle</label>
          <label className="check span-2"><input type="checkbox" name="compter_malgre_inactivite" /> Continuer malgré l'inactivité (plafond de 4 heures entre deux signaux)</label>
          <label className="span-2">Notes<textarea name="notes" /></label>
        </div>
        <button type="submit">Enregistrer l'exception</button>
      </form>
    </>
  );
}
