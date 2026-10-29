"use client";

import { useState } from "react";
import { creerImmobilisation } from "@/app/actions";

export function ImmoAssistant() {
  const [step, setStep] = useState(0);
  return (
    <form action={creerImmobilisation} className="panel">
      <div className="steps">
        <span className={step === 0 ? "on" : ""}>1. Bien</span>
        <span className={step === 1 ? "on" : ""}>2. Amortissement</span>
        <span className={step === 2 ? "on" : ""}>3. Règlement</span>
      </div>
      <div className="form-grid" hidden={step !== 0}>
        <label className="span-2">Désignation<input name="designation" required={step === 0} /></label>
        <label>Date d'acquisition<input type="date" name="date" required={step === 0} /></label>
        <label>Fournisseur<input name="fournisseur" /></label>
        <label>Valeur d'origine (FCFA)<input name="valeur" inputMode="numeric" required={step === 0} /></label>
        <label>Valeur résiduelle<input name="residuelle" inputMode="numeric" defaultValue="0" /></label>
      </div>
      <div className="form-grid" hidden={step !== 1}>
        <label>Durée (mois)<input name="duree" inputMode="numeric" defaultValue="60" required={step === 1} /></label>
        <label>Compte d'immobilisation<input name="compte_immo" defaultValue="2442" required={step === 1} /></label>
        <label>Compte d'amortissement<input name="compte_amort" defaultValue="2844" required={step === 1} /></label>
        <label>Compte de dotation<input name="compte_dotation" defaultValue="6813" required={step === 1} /></label>
      </div>
      <div hidden={step !== 2}>
        <p>Le bien est comptabilisé à la date d'acquisition. L'amortissement est linéaire, au prorata d'un mois commercial de 30 jours. La dernière mensualité absorbe le reliquat.</p>
        <label>Règlement
          <select name="reglement" defaultValue="dette">
            <option value="dette">Dette sur immobilisations (4042)</option>
            <option value="banque">Banque</option>
          </select>
        </label>
      </div>
      <div className="actions" style={{ marginTop: "0.9rem" }}>
        {step > 0 ? <button type="button" className="secondary" onClick={() => setStep(step - 1)}>Retour</button> : null}
        {step < 2 ? (
          <button type="button" onClick={(event) => { if (event.currentTarget.form?.reportValidity()) setStep(step + 1); }}>Continuer</button>
        ) : <button type="submit">Créer l'immobilisation</button>}
      </div>
    </form>
  );
}
