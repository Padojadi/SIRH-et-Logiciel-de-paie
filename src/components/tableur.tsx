"use client";

import { useMemo, useState } from "react";
import { enregistrerTableur } from "@/app/actions";
import { evaluateGrid } from "@/lib/spreadsheet";

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export function Tableur({ nom, initial }: { nom: string; initial: Record<string, string> }) {
  const [name, setName] = useState(nom);
  const [grid, setGrid] = useState<Record<string, string>>(initial);
  const values = useMemo(() => evaluateGrid(grid), [grid]);
  return (
    <form action={enregistrerTableur} className="panel">
      <label>Nom de la feuille<input name="nom" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <p className="muted">Saisissez un nombre ou une formule : =A1+B1, =SUM(A1:A8). Le résultat s'affiche sous la saisie.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th></th>{COLS.map((col) => <th key={col}>{col}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: 12 }, (_, row) => row + 1).map((row) => (
              <tr key={row}>
                <th>{row}</th>
                {COLS.map((col) => {
                  const id = `${col}${row}`;
                  const raw = grid[id] ?? "";
                  const value = values[id];
                  return (
                    <td key={id}>
                      <input aria-label={id} value={raw} onChange={(event) => setGrid({ ...grid, [id]: event.target.value })} />
                      {raw.startsWith("=") ? <small className="muted">{String(value ?? "")}</small> : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <input type="hidden" name="grid" value={JSON.stringify(grid)} />
      <button type="submit" style={{ marginTop: "0.8rem" }}>Enregistrer la feuille</button>
    </form>
  );
}
