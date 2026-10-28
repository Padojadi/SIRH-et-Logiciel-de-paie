"use client";

import { useState } from "react";
import { enregistrerKilometre, enregistrerPiece } from "@/app/actions";

type Compte = { code: string; libelle: string };
type Journal = { code: string; libelle: string };
type Ligne = { compte: string; libelle: string; debit: string; credit: string; analytique: string };

const empty = (): Ligne => ({ compte: "", libelle: "", debit: "", credit: "", analytique: "" });

export function SaisieForms({ comptes, journaux, mode }: { comptes: Compte[]; journaux: Journal[]; mode: string }) {
  const [lignes, setLignes] = useState<Ligne[]>([empty(), empty()]);
  const [kilo, setKilo] = useState(() => Array.from({ length: 8 }, () => ({ journal: "OD", date: "", piece: "", ...empty() })));
  const liste = (
    <datalist id="comptes-saisie">
      {comptes.map((compte) => <option key={compte.code} value={compte.code}>{compte.libelle}</option>)}
    </datalist>
  );
  if (mode === "kilometre") {
    return (
      <form action={enregistrerKilometre} className="panel">
        {liste}
        <p className="muted">Chaque ligne porte son journal, sa date et sa pièce. Les lignes d'une même pièce sont regroupées et doivent s'équilibrer. L'analytique vide est déduit du compte ou de l'unité.</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Journal</th><th>Date</th><th>Pièce</th><th>Compte</th><th>Libellé</th><th>Débit</th><th>Crédit</th><th>Analytique</th></tr></thead>
            <tbody>
              {kilo.map((ligne, index) => (
                <tr key={index}>
                  <td><select value={ligne.journal} onChange={(event) => edit(index, { journal: event.target.value })}>{journaux.map((journal) => <option key={journal.code}>{journal.code}</option>)}</select></td>
                  <td><input type="date" value={ligne.date} onChange={(event) => edit(index, { date: event.target.value })} /></td>
                  <td><input value={ligne.piece} onChange={(event) => edit(index, { piece: event.target.value })} /></td>
                  <td><input list="comptes-saisie" value={ligne.compte} onChange={(event) => edit(index, { compte: event.target.value })} /></td>
                  <td><input value={ligne.libelle} onChange={(event) => edit(index, { libelle: event.target.value })} /></td>
                  <td><input value={ligne.debit} onChange={(event) => edit(index, { debit: event.target.value })} /></td>
                  <td><input value={ligne.credit} onChange={(event) => edit(index, { credit: event.target.value })} /></td>
                  <td><input value={ligne.analytique} onChange={(event) => edit(index, { analytique: event.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <input type="hidden" name="payload" value={JSON.stringify(kilo.map((ligne) => ({ ...ligne, debit: Number(String(ligne.debit).replace(",", ".")) || 0, credit: Number(String(ligne.credit).replace(",", ".")) || 0 })))} />
        <div className="actions" style={{ marginTop: "0.8rem" }}>
          <button type="button" className="secondary" onClick={() => setKilo([...kilo, { journal: "OD", date: "", piece: "", ...empty() }])}>Ajouter une ligne</button>
          <button type="submit">Enregistrer la saisie au kilomètre</button>
        </div>
      </form>
    );
  }
  const debit = lignes.reduce((sum, ligne) => sum + (Number(String(ligne.debit).replace(",", ".")) || 0), 0);
  const credit = lignes.reduce((sum, ligne) => sum + (Number(String(ligne.credit).replace(",", ".")) || 0), 0);
  return (
    <form action={enregistrerPiece} className="panel">
      {liste}
      <div className="form-grid">
        <label>Journal
          <select name="journal" defaultValue="OD">{journaux.map((journal) => <option key={journal.code} value={journal.code}>{journal.code} — {journal.libelle}</option>)}</select>
        </label>
        <label>Date<input type="date" name="date" required /></label>
        <label>Pièce<input name="piece" required /></label>
        <label>Libellé<input name="libelle" required /></label>
      </div>
      {lignes.map((ligne, index) => (
        <div className="form-grid" key={index} style={{ marginTop: "0.7rem" }}>
          <label>Compte<input name="compte" list="comptes-saisie" value={ligne.compte} onChange={(event) => setLignes(lignes.map((item, i) => i === index ? { ...item, compte: event.target.value } : item))} /></label>
          <label>Libellé de ligne<input name="ligne_libelle" value={ligne.libelle} onChange={(event) => setLignes(lignes.map((item, i) => i === index ? { ...item, libelle: event.target.value } : item))} /></label>
          <label>Débit<input name="debit" value={ligne.debit} onChange={(event) => setLignes(lignes.map((item, i) => i === index ? { ...item, debit: event.target.value } : item))} /></label>
          <label>Crédit<input name="credit" value={ligne.credit} onChange={(event) => setLignes(lignes.map((item, i) => i === index ? { ...item, credit: event.target.value } : item))} /></label>
          <label>Analytique<input name="analytique" value={ligne.analytique} onChange={(event) => setLignes(lignes.map((item, i) => i === index ? { ...item, analytique: event.target.value } : item))} /></label>
        </div>
      ))}
      <p>Débit {Math.round(debit).toLocaleString("fr-FR")} · Crédit {Math.round(credit).toLocaleString("fr-FR")} · Écart {Math.round(debit - credit).toLocaleString("fr-FR")}</p>
      <div className="actions">
        <button type="button" className="secondary" onClick={() => setLignes([...lignes, empty()])}>Ajouter une ligne</button>
        <button type="submit">Enregistrer la pièce</button>
      </div>
    </form>
  );

  function edit(index: number, patch: Partial<(typeof kilo)[number]>) {
    setKilo(kilo.map((ligne, i) => (i === index ? { ...ligne, ...patch } : ligne)));
  }
}
