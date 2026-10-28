import { Badge, DateRange, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatHeureCourte, frDate } from "@/lib/dates";
import { pct } from "@/lib/format";
import { defaultEvalRange, evaluer, scopeFor } from "@/lib/hr-store";
import { AVIS_FICHE, AVIS_UNITE, orgTypeLabel } from "@/lib/labels";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Évaluations" };

function kind(avis: string): "ok" | "warn" | "danger" | "info" {
  if (avis === "equilibree" || avis === "effectif_suffisant") return "ok";
  if (avis === "assiduite" || avis === "recruter") return "danger";
  if (avis === "alourdir") return "info";
  return "warn";
}

export default async function Evaluations({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("eval");
  const query = await readQuery(searchParams);
  const fallback = defaultEvalRange();
  const from = query.get("from") || fallback.from;
  const to = query.get("to") || fallback.to;
  const data = evaluer(from, to, scopeFor(user));
  return (
    <>
      <PageHeader
        kicker="Ressources humaines"
        title="Évaluations"
        lede="La présence se compare à la durée théorique (ou à la durée du shift). La charge compare le temps imputé aux tâches de la fiche. En dessous de 70 % de présence, l'avis porte d'abord sur l'assiduité. Au-delà de 115 % de charge, la fiche est à alléger. En dessous de 80 % avec une présence d'au moins 85 %, elle est à alourdir. Une unité est à recruter si au moins un quart des agents est en surcharge et moins d'un cinquième en sous-charge, et à réaffecter si les deux parts atteignent 20 %."
      />
      <DateRange from={from} to={to} />
      <p className="muted">Du {frDate(from)} au {frDate(to)}{scopeFor(user) ? " · périmètre de votre unité" : ""}.</p>
      <h2>Par unité</h2>
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Unité</th><th>Type</th><th className="num">Effectif</th><th className="num">Surcharge</th><th className="num">Sous-charge</th><th>Avis</th></tr></thead>
          <tbody>
            {data.unites.map((unit) => (
              <tr key={unit.id}>
                <td>{unit.code} — {unit.nom}</td>
                <td>{orgTypeLabel(unit.type)}</td>
                <td className="num">{unit.effectif}</td>
                <td className="num">{unit.surcharge} · {pct(unit.effectif ? unit.surcharge / unit.effectif : 0)}</td>
                <td className="num">{unit.sousCharge} · {pct(unit.effectif ? unit.sousCharge / unit.effectif : 0)}</td>
                <td><Badge kind={kind(unit.avis)}>{AVIS_UNITE[unit.avis]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ marginTop: "1.2rem" }}>Par agent</h2>
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Agent</th><th>Unité</th><th>Fiche</th><th className="num">Jours</th><th className="num">Présence</th><th className="num">Imputé</th><th className="num">Prévu</th><th>Avis</th></tr></thead>
          <tbody>
            {data.agents.map((agent) => (
              <tr key={agent.id}>
                <td>{agent.matricule} {agent.nom}</td>
                <td>{agent.orgNom}</td>
                <td>{agent.ficheTitre}</td>
                <td className="num">{agent.jours}</td>
                <td className="num">{formatHeureCourte(agent.secondesPresence)} / {formatHeureCourte(agent.secondesTheoriques)}</td>
                <td className="num">{formatHeureCourte(agent.minutesImputees * 60)}</td>
                <td className="num">{formatHeureCourte(agent.minutesPrevues * 60)}</td>
                <td><Badge kind={kind(agent.avis)}>{AVIS_FICHE[agent.avis]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
