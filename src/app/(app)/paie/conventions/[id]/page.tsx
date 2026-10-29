import { notFound } from "next/navigation";
import { ConventionForm } from "@/components/convention-form";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getConvention } from "@/lib/payroll-store";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Convention" };

export default async function ConventionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("paie.read");
  const { id } = await params;
  const { ok, erreur } = await readQuery(searchParams);
  const convention = getConvention(Number(id));
  if (!convention) notFound();
  return (
    <>
      <PageHeader kicker="Paie" title={convention.name} lede={convention.description || "Paramètres de calcul des bulletins rattachés à cette convention."} />
      <Flash ok={ok} erreur={erreur} />
      {can(user.role, "paie.write") ? (
        <ConventionForm id={convention.id} name={convention.name} description={convention.description} config={convention.config} />
      ) : (
        <section className="panel">
          <p>IPRES salarié {convention.config.tauxIpresSalarie * 100} %, plafond {convention.config.plafondIpres}.</p>
          <p>IPM {convention.config.tauxIpmSalarie * 100} %, CSS AF {convention.config.tauxCssAf * 100} %, AT {convention.config.tauxCssAt * 100} %, CFCE {convention.config.tauxCfce * 100} %.</p>
          <p className="muted">{convention.config.source}</p>
        </section>
      )}
    </>
  );
}
