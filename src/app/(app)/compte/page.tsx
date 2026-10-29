import { changerMotDePasse, deconnecter } from "@/app/actions";
import { EnregistrementVisage } from "@/components/enregistrement-visage";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ROLE_LABEL, isRole } from "@/lib/permissions";
import { etatAcces } from "@/lib/presence-store";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Mon accès" };

function quand(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Dakar" }).format(new Date(iso));
}

export default async function Compte({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  const { ok, erreur } = await readQuery(searchParams);
  const acces = etatAcces(user);
  const agent = Boolean(user.agent_id);
  return (
    <>
      <PageHeader kicker="Compte" title={user.name} lede={`${user.email} · ${isRole(user.role) ? ROLE_LABEL[user.role] : user.role}`} />
      <Flash ok={ok} erreur={erreur} />
      {agent ? (
        <p className="steps">
          <span className={acces.motDePasse ? "on" : ""}>1. Mot de passe personnel</span>
          <span className={acces.visageLe ? "on" : ""}>2. Identité faciale</span>
        </p>
      ) : null}
      {agent && !acces.motDePasse ? <p>À la première utilisation, le mot de passe reçu doit être remplacé. L'enregistrement du visage termine cette étape.</p> : null}
      <form action={changerMotDePasse} className="panel">
        <h2>Mot de passe</h2>
        <div className="form-grid">
          <label>Mot de passe actuel<input type="password" name="actuel" required /></label>
          <label>Nouveau mot de passe<input type="password" name="nouveau" required minLength={10} /></label>
        </div>
        <button type="submit">{acces.motDePasse ? "Modifier" : "Enregistrer mon mot de passe"}</button>
      </form>
      {agent && acces.motDePasse ? <EnregistrementVisage dejaEnregistre={Boolean(acces.visageLe)} /> : null}
      {acces.visageLe ? <p className="muted">Visage enregistré le {quand(acces.visageLe)}, heure de Dakar.</p> : null}
      <form action={deconnecter} style={{ marginTop: "1rem" }}>
        <button className="secondary" type="submit">Se déconnecter</button>
      </form>
    </>
  );
}
