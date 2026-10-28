import { enregistrerAgent } from "@/app/actions";
import { STATUTS_AGENT } from "@/lib/labels";

type Option = { id: number; label: string };

export function AgentForm({
  agent,
  unites,
  fiches,
  conventions,
}: {
  agent?: {
    id: number;
    prenom: string;
    nom: string;
    email: string | null;
    date_embauche: string | null;
    statut: string;
    org_unit_id: number | null;
    fiche_id: number | null;
    convention_id: number | null;
    poste: string;
    salaire_base: number;
    taux_journalier: number;
    parts_fiscales: number;
    trimf_double: number;
    iban: string;
    actif: number;
  };
  unites: Option[];
  fiches: Option[];
  conventions: Option[];
}) {
  return (
    <form action={enregistrerAgent} className="panel">
      {agent ? <input type="hidden" name="id" value={agent.id} /> : null}
      <div className="form-grid">
        <label>Prénom<input name="prenom" defaultValue={agent?.prenom ?? ""} required /></label>
        <label>Nom<input name="nom" defaultValue={agent?.nom ?? ""} required /></label>
        <label>Courriel<input type="email" name="email" defaultValue={agent?.email ?? ""} /></label>
        <label>Date d'embauche<input type="date" name="date_embauche" defaultValue={agent?.date_embauche ?? ""} /></label>
        <label>Statut
          <select name="statut" defaultValue={agent?.statut ?? "titulaire"}>
            {STATUTS_AGENT.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Poste<input name="poste" defaultValue={agent?.poste ?? ""} /></label>
        <label>Unité
          <select name="org_unit_id" defaultValue={agent?.org_unit_id ?? ""}>
            <option value="">—</option>
            {unites.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>Fiche de poste
          <select name="fiche_id" defaultValue={agent?.fiche_id ?? ""}>
            <option value="">—</option>
            {fiches.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>Convention
          <select name="convention_id" defaultValue={agent?.convention_id ?? ""}>
            <option value="">—</option>
            {conventions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>Salaire de base (FCFA)<input name="salaire_base" inputMode="numeric" defaultValue={agent?.salaire_base ?? 0} /></label>
        <label>Taux journalier vacataire (FCFA)<input name="taux_journalier" inputMode="numeric" defaultValue={agent?.taux_journalier ?? 0} /></label>
        <label>Parts fiscales<input name="parts_fiscales" inputMode="decimal" defaultValue={agent?.parts_fiscales ?? 1} /></label>
        <label>IBAN ou RIB<input name="iban" defaultValue={agent?.iban ?? ""} /></label>
        <label className="check"><input type="checkbox" name="trimf_double" defaultChecked={agent?.trimf_double === 1} /> TRIMF au double (conjoint)</label>
        <label className="check"><input type="checkbox" name="actif" defaultChecked={agent ? agent.actif === 1 : true} /> Agent actif</label>
      </div>
      <div className="actions" style={{ marginTop: "0.9rem" }}>
        <button type="submit">Enregistrer l'agent</button>
      </div>
    </form>
  );
}
