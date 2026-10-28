import { ConventionForm } from "@/components/convention-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { defaultConvention } from "@/lib/payroll-store";

export const metadata = { title: "Nouvelle convention" };

export default async function NouvelleConvention() {
  await requireUser("paie.write");
  return (
    <>
      <PageHeader kicker="Paie" title="Nouvelle convention" lede="Le formulaire part des paramètres indicatifs. La réduction d'impôt pour parts familiales reste celle de la convention d'origine." />
      <ConventionForm config={defaultConvention()} />
    </>
  );
}
