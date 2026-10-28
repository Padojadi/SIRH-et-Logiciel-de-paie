import { creerUtilisateur } from "@/app/actions";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { all } from "@/lib/db";
import { listAgents } from "@/lib/hr-store";
import { ROLE_LABEL, ROLES, isRole } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Utilisateurs" };

export default async function Utilisateurs({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("admin");
  const query = await readQuery(searchParams);
  const users = all<{ id: number; email: string; name: string; role: string; active: number; agent_id: number | null }>(
    "SELECT id, email, name, role, active, agent_id FROM users ORDER BY name",
  );
  const agents = listAgents();
  return (
    <>
      <PageHeader kicker="Administration" title="Utilisateurs" lede="Chaque personne a un rôle. Le lien vers un agent ouvre son compteur, sa fiche et ses bulletins." />
      <Flash ok={query.ok} erreur={query.erreur} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Nom</th><th>Identifiant</th><th>Rôle</th><th>Agent</th></tr></thead>
          <tbody>
            {users.map((item) => {
              const agent = agents.find((row) => row.id === item.agent_id);
              return (
                <tr key={item.id}>
                  <td>{item.name}{item.active ? "" : " (inactif)"}</td>
                  <td>{item.email}</td>
                  <td>{isRole(item.role) ? ROLE_LABEL[item.role] : item.role}</td>
                  <td>{agent ? `${agent.matricule} ${agent.prenom} ${agent.nom}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <form action={creerUtilisateur} className="panel" style={{ marginTop: "1rem" }}>
        <h2>Nouvel utilisateur</h2>
        <div className="form-grid">
          <label>Nom<input name="name" required /></label>
          <label>Identifiant<input type="email" name="email" required /></label>
          <label>Mot de passe<input name="mot_de_passe" type="text" required minLength={10} /></label>
          <label>Rôle
            <select name="role" defaultValue="agent">
              {ROLES.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
            </select>
          </label>
          <label>Agent lié
            <select name="agent_id" defaultValue="">
              <option value="">Aucun</option>
              {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.matricule} — {agent.prenom} {agent.nom}</option>)}
            </select>
          </label>
        </div>
        <button type="submit">Créer le compte</button>
      </form>
    </>
  );
}
