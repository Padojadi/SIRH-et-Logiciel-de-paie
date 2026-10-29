"use client";

import { useState } from "react";
import { enregistrerFiche } from "@/app/actions";

type Task = { title: string; description: string; minutes_par_jour: number };
type Unit = { id: number; name: string };

export function FicheForm({
  fiche,
  units,
}: {
  fiche?: { id: number; code: string; title: string; org_unit_id: number | null; mission: string; profil: string; status: string; taches: Task[] };
  units: Unit[];
}) {
  const [tasks, setTasks] = useState<Task[]>(fiche?.taches?.length ? fiche.taches : [{ title: "", description: "", minutes_par_jour: 60 }]);
  const total = tasks.reduce((sum, task) => sum + (Number(task.minutes_par_jour) || 0), 0);
  return (
    <form action={enregistrerFiche} className="panel">
      {fiche ? <input type="hidden" name="id" value={fiche.id} /> : null}
      <div className="form-grid">
        <label>Code<input name="code" defaultValue={fiche?.code ?? ""} required /></label>
        <label>Intitulé<input name="title" defaultValue={fiche?.title ?? ""} required /></label>
        <label>Unité
          <select name="org_unit_id" defaultValue={fiche?.org_unit_id ?? ""}>
            <option value="">—</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </select>
        </label>
        <label>Statut
          <select name="status" defaultValue={fiche?.status ?? "brouillon"}>
            <option value="brouillon">Brouillon</option>
            <option value="active">Active</option>
            <option value="archivee">Archivée</option>
          </select>
        </label>
        <label className="span-2">Mission<textarea name="mission" defaultValue={fiche?.mission ?? ""} required /></label>
        <label className="span-2">Profil attendu<textarea name="profil" defaultValue={fiche?.profil ?? ""} /></label>
      </div>
      <h2 style={{ marginTop: "1.2rem" }}>Tâches et temps prévu</h2>
      <p className="muted">Charge journalière prévue : {Math.floor(total / 60)} h {String(total % 60).padStart(2, "0")}.</p>
      {tasks.map((task, index) => (
        <div className="form-grid" key={index} style={{ marginBottom: "0.6rem" }}>
          <label>Tâche<input name="tache_titre" value={task.title} onChange={(event) => update(index, { title: event.target.value })} /></label>
          <label>Minutes / jour<input name="tache_minutes" type="number" min="1" value={task.minutes_par_jour} onChange={(event) => update(index, { minutes_par_jour: Number(event.target.value) })} /></label>
          <label className="span-2">Description<input name="tache_description" value={task.description} onChange={(event) => update(index, { description: event.target.value })} /></label>
        </div>
      ))}
      <div className="actions">
        <button type="button" className="secondary" onClick={() => setTasks([...tasks, { title: "", description: "", minutes_par_jour: 30 }])}>Ajouter une tâche</button>
        <button type="submit">Enregistrer la fiche</button>
      </div>
    </form>
  );

  function update(index: number, patch: Partial<Task>) {
    setTasks(tasks.map((task, i) => (i === index ? { ...task, ...patch } : task)));
  }
}
