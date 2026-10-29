import Link from "next/link";
import { calculerPaie, cloturer, comptabiliser } from "@/app/actions";
import { Flash, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { frMois } from "@/lib/dates";
import { fcfa } from "@/lib/format";
import { listAgents } from "@/lib/hr-store";
import { getPeriode, variablesPeriode } from "@/lib/payroll-store";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";
import { notFound } from "next/navigation";

export const metadata = { title: "Période de paie" };

export default async function PeriodePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("paie.read");
  const { id } = await params;
  const { ok, erreur } = await readQuery(searchParams);
  const data = getPeriode(Number(id));
  if (!data) notFound();
  const figee = data.periode.statut === "cloturee" || data.periode.statut === "comptabilisee";
  const variables = new Map(variablesPeriode(data.periode.id).map((item) => [item.agent_id, item]));
  const agents = listAgents().filter((agent) => agent.actif);
  const write = can(user.role, "paie.write");
  return (
    <>
      <PageHeader
        kicker="Paie"
        title={frMois(data.periode.mois)}
        lede={`Statut : ${data.periode.statut}. Les vacataires sont payés au taux journalier multiplié par les jours saisis. Un brut nul n'émet pas de bulletin.`}
        actions={
          <>
            <LinkButton href={`/api/fichier?type=paie-xlsx&periode=${data.periode.id}`} secondary>Excel</LinkButton>
            <LinkButton href={`/paie/remontee?periode=${data.periode.id}`} secondary>Remontée</LinkButton>
          </>
        }
      />
      <Flash ok={ok} erreur={erreur} />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Agent</th><th>Poste</th><th className="num">Brut</th><th className="num">Net</th><th className="num">Charges patronales</th><th></th></tr></thead>
          <tbody>
            {data.bulletins.map((bulletin) => (
              <tr key={bulletin.id}>
                <td>{bulletin.matricule} {bulletin.prenom} {bulletin.nom}</td>
                <td>{bulletin.poste}</td>
                <td className="num">{fcfa(bulletin.brut)}</td>
                <td className="num">{fcfa(bulletin.net)}</td>
                <td className="num">{fcfa(bulletin.charges_patronales)}</td>
                <td><Link href={`/paie/bulletins/${bulletin.id}`}>Bulletin</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {write && !figee ? (
        <form action={calculerPaie} className="panel" style={{ marginTop: "1rem" }}>
          <h2>Calculer</h2>
          <input type="hidden" name="mois" value={data.periode.mois} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Agent</th><th>Statut</th><th className="num">Primes</th><th className="num">Jours</th><th className="num">Retenues</th></tr></thead>
              <tbody>
                {agents.map((agent) => {
                  const variable = variables.get(agent.id);
                  return (
                    <tr key={agent.id}>
                      <td>{agent.prenom} {agent.nom}<input type="hidden" name="agent_id" value={agent.id} /></td>
                      <td>{agent.statut}</td>
                      <td><input name="primes" defaultValue={variable?.primes ?? 0} /></td>
                      <td><input name="jours" defaultValue={variable?.jours ?? (agent.statut === "vacataire" ? 0 : 0)} /></td>
                      <td><input name="retenues" defaultValue={variable?.retenues ?? 0} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button type="submit">Calculer la paie</button>
        </form>
      ) : null}
      {write ? (
        <div className="actions" style={{ marginTop: "1rem" }}>
          {!data.periode.ecriture_id && (data.periode.statut === "calculee" || data.periode.statut === "cloturee") ? (
            <form action={comptabiliser}><input type="hidden" name="id" value={data.periode.id} /><button type="submit">Comptabiliser</button></form>
          ) : null}
          {data.periode.statut === "calculee" ? (
            <form action={cloturer}><input type="hidden" name="id" value={data.periode.id} /><button className="secondary" type="submit">Clôturer</button></form>
          ) : null}
          {data.periode.ecriture_id ? <Link href={`/compta/journaux/${data.periode.ecriture_id}`}>Voir l'écriture de paie</Link> : null}
        </div>
      ) : null}
    </>
  );
}
