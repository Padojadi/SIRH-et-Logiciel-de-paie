import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSessionUser } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { ROLE_LABEL, isRole } from "@/lib/permissions";
import { finalisationRequise } from "@/lib/presence-store";
import { setting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  const requise = finalisationRequise(user);
  const chemin = (await headers()).get("x-chemin") ?? "";
  if (requise && chemin && chemin !== "/compte") redirect("/compte");
  const role = isRole(user.role) ? ROLE_LABEL[user.role] : user.role;
  const items = requise ? [{ href: "/compte", label: "Mon accès" }] : navFor(user.role);
  return (
    <Shell org={setting("organisation", "SIGRHCP")} userName={user.name} roleLabel={role} items={items}>
      {children}
    </Shell>
  );
}
