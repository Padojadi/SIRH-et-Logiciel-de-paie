import { redirect } from "next/navigation";
import { connecter } from "@/app/actions";
import { getSessionUser } from "@/lib/auth";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { ROLE_LABEL, isRole } from "@/lib/permissions";
import { readQuery } from "@/lib/query";
import { setting } from "@/lib/settings";

export const metadata = { title: "Connexion" };

export default async function Connexion({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const user = await getSessionUser();
  if (user) redirect("/tableau-de-bord");
  const { erreur } = await readQuery(searchParams);
  const demo = setting("afficher_comptes_demo", "1") === "1";
  return (
    <main className="login">
      <section className="login-side">
        <div>
          <p className="kicker">{setting("organisation", "SIGRHCP")}</p>
          <h1>Le travail, le temps et les comptes au même endroit.</h1>
        </div>
        <p>Ressources humaines, horaires, comptabilité SYSCOHADA / SYCEBNL et paie. Une base, plusieurs rôles, un serveur.</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <h2>Connexion à 2TIC</h2>
          {erreur ? <p className="flash err">{erreur}</p> : null}
          <form action={connecter} className="grid">
            <label>Identifiant<input name="email" type="email" autoComplete="username" required /></label>
            <label>Mot de passe<input name="mot_de_passe" type="password" autoComplete="current-password" required /></label>
            <button type="submit">Entrer</button>
          </form>
          {demo ? (
            <details className="demo">
              <summary>Comptes de démonstration</summary>
              <ul>
                {DEMO_ACCOUNTS.map((account) => (
                  <li key={account.email}>
                    <strong>{account.name}</strong> — {isRole(account.role) ? ROLE_LABEL[account.role] : account.role}
                    <br />
                    {account.email} · {account.password}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      </section>
    </main>
  );
}
