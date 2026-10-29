import { FicheForm } from "@/components/fiche-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listOrg } from "@/lib/hr-store";

export const metadata = { title: "Nouvelle fiche" };

export default async function NouvelleFiche() {
  await requireUser("rh.write");
  return (
    <>
      <PageHeader kicker="Ressources humaines" title="Nouvelle fiche de poste" lede="Indiquez la mission et le temps prévu de chaque tâche. La somme sert de charge théorique." />
      <FicheForm units={listOrg().map((unit) => ({ id: unit.id, name: `${unit.code} — ${unit.name}` }))} />
    </>
  );
}
