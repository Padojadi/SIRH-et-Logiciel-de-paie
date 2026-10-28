import Link from "next/link";
import { LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listConventions } from "@/lib/payroll-store";
import { can } from "@/lib/permissions";

export const metadata = { title: "Conventions" };

export default async function Conventions() {
  const user = await requireUser("paie.read");
  return (
    <>
      <PageHeader
        kicker="Paie"
        title="Conventions"
        lede="Plusieurs conventions peuvent coexister. Les taux livrés sont indicatifs pour le Sénégal au 1er janvier 2026 : ils se modifient ici avant une paie réelle et ne constituent pas un conseil juridique."
        actions={can(user.role, "paie.write") ? <LinkButton href="/paie/conventions/nouvelle">Nouvelle convention</LinkButton> : null}
      />
      <div className="table-wrap panel">
        <table>
          <thead><tr><th>Nom</th><th>Description</th></tr></thead>
          <tbody>
            {listConventions().map((item) => (
              <tr key={item.id}>
                <td><Link href={`/paie/conventions/${item.id}`}>{item.name}</Link></td>
                <td>{item.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
