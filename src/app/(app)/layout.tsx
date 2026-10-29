import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSessionUser } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { finalisationRequise } from "@/lib/presence-store";
import { ROLE_LABEL, isRole } from "@/lib/permissions";
import { setting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  const chemin = (await headers()).get("x-chemin") ?? "";
  if (chemin && chemin !== "/compte" && finalisationRequise(user)) redirect("/compte");
  const role = isRole(user.role) ? ROLE_LABEL[user.role] : user.role;
  return (
    <Shell org={setting("organisation", "SIGRHCP")} userName={user.name} roleLabel={role} items={navFor(user.role)}>
      {children}
    </Shell>
  );
}
