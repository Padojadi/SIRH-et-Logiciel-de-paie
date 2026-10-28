import { AgentForm } from "@/components/agent-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listFiches, listOrg } from "@/lib/hr-store";
import { listConventions } from "@/lib/payroll-store";

export const metadata = { title: "Nouvel agent" };

export default async function NouvelAgent() {
  await requireUser("rh.write");
  return (
    <>
      <PageHeader kicker="Ressources humaines" title="Nouvel agent" lede="Le matricule est attribué à l'enregistrement." />
      <AgentForm
        unites={listOrg().map((unit) => ({ id: unit.id, label: `${unit.code} — ${unit.name}` }))}
        fiches={listFiches().map((fiche) => ({ id: fiche.id, label: `${fiche.code} — ${fiche.title}` }))}
        conventions={listConventions().map((item) => ({ id: item.id, label: item.name }))}
      />
    </>
  );
}
