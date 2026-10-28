import { enregistrerConvention } from "@/app/actions";
import type { ConventionConfig } from "@/lib/payroll-engine";
import { tranchesMontantTexte, tranchesTauxTexte } from "@/lib/payroll-engine";

function pct(rate: number): string {
  return String(Math.round(rate * 1000) / 10);
}

export function ConventionForm({
  id,
  name,
  description,
  config,
}: {
  id?: number;
  name?: string;
  description?: string;
  config: ConventionConfig;
}) {
  return (
    <form action={enregistrerConvention} className="panel">
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <div className="form-grid">
        <label>Nom<input name="name" defaultValue={name ?? ""} required /></label>
        <label className="check"><input type="checkbox" name="modeVacataire" value="1" defaultChecked={config.modeVacataire} /> Convention destinée aux vacataires</label>
        <label className="span-2">Description<textarea name="description" defaultValue={description ?? ""} /></label>
        <label>IPRES salarié (%)<input name="tauxIpresSalarie" defaultValue={pct(config.tauxIpresSalarie)} required /></label>
        <label>IPRES employeur (%)<input name="tauxIpresEmployeur" defaultValue={pct(config.tauxIpresEmployeur)} required /></label>
        <label>Plafond IPRES<input name="plafondIpres" defaultValue={config.plafondIpres} required /></label>
        <label>IPRES cadre salarié (%)<input name="tauxIpresCadreSalarie" defaultValue={pct(config.tauxIpresCadreSalarie)} required /></label>
        <label>IPRES cadre employeur (%)<input name="tauxIpresCadreEmployeur" defaultValue={pct(config.tauxIpresCadreEmployeur)} required /></label>
        <label>Plafond IPRES cadre<input name="plafondIpresCadre" defaultValue={config.plafondIpresCadre} required /></label>
        <label>IPM salarié (%)<input name="tauxIpmSalarie" defaultValue={pct(config.tauxIpmSalarie)} required /></label>
        <label>IPM employeur (%)<input name="tauxIpmEmployeur" defaultValue={pct(config.tauxIpmEmployeur)} required /></label>
        <label>Plafond IPM<input name="plafondIpm" defaultValue={config.plafondIpm} required /></label>
        <label>CSS allocations familiales (%)<input name="tauxCssAf" defaultValue={pct(config.tauxCssAf)} required /></label>
        <label>CSS accidents du travail (%)<input name="tauxCssAt" defaultValue={pct(config.tauxCssAt)} required /></label>
        <label>Plafond CSS<input name="plafondCss" defaultValue={config.plafondCss} required /></label>
        <label>CFCE (%)<input name="tauxCfce" defaultValue={pct(config.tauxCfce)} required /></label>
        <label>Abattement IR (%)<input name="abattement" defaultValue={pct(config.abattement)} required /></label>
        <label>Plafond annuel d'abattement<input name="plafondAbattement" defaultValue={config.plafondAbattement} required /></label>
        <label className="span-2">Barème IR annuel, une tranche par ligne (plafond:taux décimal, * pour la dernière)
          <textarea name="ir" defaultValue={tranchesTauxTexte(config.ir)} required />
        </label>
        <label className="span-2">TRIMF annuelle, une tranche par ligne (plafond du brut annuel:montant annuel, * pour la dernière). Le bulletin retient un douzième.
          <textarea name="trimf" defaultValue={tranchesMontantTexte(config.trimf)} required />
        </label>
      </div>
      <p className="muted">{config.source}</p>
      <button type="submit">Enregistrer la convention</button>
    </form>
  );
}
