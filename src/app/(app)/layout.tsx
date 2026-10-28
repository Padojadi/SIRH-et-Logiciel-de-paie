import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSessionUser } from "@/lib/auth";
import { navFor } from "@/lib/nav";
import { ROLE_LABEL, isRole } from "@/lib/permissions";
import { setting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  const role = isRole(user.role) ? ROLE_LABEL[user.role] : user.role;
  return (
    <Shell org={setting("organisation", "Cauris")} userName={user.name} roleLabel={role} items={navFor(user.role)}>
      {children}
    </Shell>
  );
}
