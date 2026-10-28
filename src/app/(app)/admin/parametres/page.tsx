import { enregistrerParametres } from "@/app/actions";
import { Flash, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { readQuery } from "@/lib/query";
import { settings } from "@/lib/settings";

export const metadata = { title: "Paramètres" };

export default async function Parametres({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("admin");
  const query = await readQuery(searchParams);
  const data = settings();
  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Paramètres"
        lede="La plage standard reste bornée : début entre 6 h et 8 h, fin entre 15 h et 18 h. Les shifts et les exceptions sortent de ce cadre sans modifier ces bornes."
      />
      <Flash ok={query.ok} erreur={query.erreur} />
      <form action={enregistrerParametres} className="panel">
        <div className="form-grid">
          <label>Organisation<input name="organisation" defaultValue={data.organisation ?? ""} required /></label>
          <label>Ville<input name="ville" defaultValue={data.ville ?? ""} /></label>
          <label className="span-2">Adresse<input name="adresse" defaultValue={data.adresse ?? ""} /></label>
          <label>NIF<input name="nif" defaultValue={data.nif ?? ""} /></label>
          <label>Référentiel
            <select name="referentiel" defaultValue={data.referentiel ?? "SYSCOHADA"}>
              <option value="SYSCOHADA">SYSCOHADA</option>
              <option value="SYCEBNL">SYCEBNL</option>
            </select>
          </label>
          <label>Début de comptage<input type="time" name="debut_comptage" defaultValue={data.debut_comptage ?? "06:00"} required /></label>
          <label>Limite d'arrivée<input type="time" name="limite_arrivee" defaultValue={data.limite_arrivee ?? "08:00"} required /></label>
          <label>Fin de comptage<input type="time" name="fin_comptage" defaultValue={data.fin_comptage ?? "17:00"} required /></label>
          <label>Durée théorique (heures)<input name="duree_theorique_heures" defaultValue={data.duree_theorique_heures ?? "8"} required /></label>
          <label>TVA (%)<input name="tva_taux" defaultValue={String(Number(data.tva_taux ?? "0.18") * 100)} required /></label>
          <label>Compte banque<input name="compte_banque" defaultValue={data.compte_banque ?? "5211"} required /></label>
          <label>Début d'exercice<input type="date" name="exercice_debut" defaultValue={data.exercice_debut ?? ""} required /></label>
          <label>Fin d'exercice<input type="date" name="exercice_fin" defaultValue={data.exercice_fin ?? ""} required /></label>
          <label className="check span-2"><input type="checkbox" name="afficher_comptes_demo" defaultChecked={data.afficher_comptes_demo !== "0"} /> Afficher les comptes de démonstration sur l'écran de connexion</label>
        </div>
        <button type="submit">Enregistrer</button>
      </form>
    </>
  );
}
