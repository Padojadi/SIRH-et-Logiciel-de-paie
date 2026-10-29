import { LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { exercice } from "@/lib/settings";

export const metadata = { title: "Exports" };

export default async function Exports() {
  const user = await requireUser("compta.read");
  const { from, to } = exercice();
  const q = `from=${from}&to=${to}`;
  return (
    <>
      <PageHeader
        kicker="Comptabilité"
        title="Exports"
        lede={`Période de l'exercice en cours, du ${from.split("-").reverse().join("/")} au ${to.split("-").reverse().join("/")}. Le FEC suit les 18 colonnes usuelles, séparées par des tabulations, montants avec virgule, devise XOF. Le fichier DGI est une aide au calcul de TVA, pas une liasse.`}
      />
      <div className="actions">
        <LinkButton href={`/api/fichier?type=balance-xlsx&${q}`} secondary>Balance Excel</LinkButton>
        <LinkButton href={`/api/fichier?type=balance-docx&${q}`} secondary>Balance Word</LinkButton>
        <LinkButton href={`/api/fichier?type=grand-livre&${q}`} secondary>Grand livre Excel</LinkButton>
        <LinkButton href={`/api/fichier?type=dgi&${q}`} secondary>Aide TVA (CSV)</LinkButton>
        {can(user.role, "compta.export") ? <LinkButton href={`/api/fichier?type=fec&${q}`}>Fichier des écritures (FEC)</LinkButton> : <p>Le FEC est réservé au comptable et à l'administrateur.</p>}
      </div>
    </>
  );
}
