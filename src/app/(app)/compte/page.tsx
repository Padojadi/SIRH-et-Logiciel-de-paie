import { changerMotDePasse, deconnecter } from "@/app/actions";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL, isRole } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Mon accès" };

export default async function Compte({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const { ok, erreur } = await readQuery(searchParams);
  return (
    <>
      <PageHeader kicker="Compte" title={user.name} lede={`${user.email} · ${isRole(user.role) ? ROLE_LABEL[user.role] : user.role}`} />
      <Flash ok={ok} erreur={erreur} />
      <form action={changerMotDePasse} className="panel">
        <h2>Mot de passe</h2>
        <div className="form-grid">
          <label>Mot de passe actuel<input type="password" name="actuel" required /></label>
          <label>Nouveau mot de passe<input type="password" name="nouveau" required minLength={10} /></label>
        </div>
        <button type="submit">Modifier</button>
      </form>
      <form action={deconnecter} style={{ marginTop: "1rem" }}>
        <button className="secondary" type="submit">Se déconnecter</button>
      </form>
    </>
  );
}
