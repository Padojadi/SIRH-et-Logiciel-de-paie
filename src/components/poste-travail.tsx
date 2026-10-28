"use client";

import { useEffect, useState } from "react";
import { formatHeure } from "@/lib/dates";

type Tache = { id: number; title: string; minutes_par_jour: number; secondes: number };
type Etat = {
  date: string;
  secondes: number;
  statutArrivee: string | null;
  commencee: boolean;
  dansLaPlage: boolean;
  exception: string | null;
  fiche: string;
  poste: string;
  taches: Tache[];
};

export function PosteTravail({ initial, agentId }: { initial: Etat; agentId: number }) {
  const [etat, setEtat] = useState(initial);
  const [tacheId, setTacheId] = useState<number | "">(initial.taches[0]?.id ?? "");
  const [active, setActive] = useState(true);
  const [local, setLocal] = useState(initial.secondes);
  const [message, setMessage] = useState("En comptage");

  useEffect(() => {
    let last = Date.now();
    const mark = () => { last = Date.now(); };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, mark, { passive: true }));
    const tick = window.setInterval(() => {
      const idle = Date.now() - last;
      const present = document.visibilityState === "visible" && idle < 120000;
      setActive(present);
      if (present && etat.dansLaPlage) setLocal((value) => value + 1);
    }, 1000);
    const beat = window.setInterval(() => {
      const present = document.visibilityState === "visible" && Date.now() - last < 120000;
      void fetch("/api/temps/battement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, tacheId: tacheId || null, active: present }),
      }).then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as Etat & { motif?: string };
        setEtat(data);
        setLocal(data.secondes);
        setMessage(data.exception ? `Exception : ${data.exception}` : data.dansLaPlage ? (present ? "En comptage" : "Pause d'inactivité") : "Hors plage de comptage");
      }).catch(() => setMessage("Connexion au compteur interrompue"));
    }, 15000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, mark));
      window.clearInterval(tick);
      window.clearInterval(beat);
    };
  }, [agentId, tacheId, etat.dansLaPlage]);

  return (
    <div className="grid cards-2">
      <section className="panel">
        <p className="kicker">{etat.poste || "Poste de travail"}</p>
        <p className="timer">{formatHeure(local)}</p>
        <p>{message} · {etat.date.split("-").reverse().join("/")}</p>
        <p className="muted">{etat.fiche || "Aucune fiche de poste n'est attachée à cet agent."}</p>
        {etat.statutArrivee ? <p>Arrivée : {etat.statutArrivee === "a_l_heure" ? "à l'heure" : etat.statutArrivee === "retard" ? "en retard" : "avant la plage"}</p> : <p>La journée s'ouvrira au premier signal.</p>}
        <label>Tâche en cours
          <select value={tacheId} onChange={(event) => setTacheId(event.target.value ? Number(event.target.value) : "")}>
            <option value="">Temps non imputé à la fiche</option>
            {etat.taches.map((tache) => <option key={tache.id} value={tache.id}>{tache.title}</option>)}
          </select>
        </label>
        <p className="muted">Le compteur s'arrête après deux minutes sans utilisation du poste. Une exception active peut le prolonger.</p>
        <p>{active ? "Présence détectée" : "Inactivité détectée"}</p>
      </section>
      <section className="panel">
        <h2>Contenu de la journée</h2>
        <table>
          <thead><tr><th>Tâche de la fiche</th><th className="num">Prévu</th><th className="num">Fait</th></tr></thead>
          <tbody>
            {etat.taches.map((tache) => (
              <tr key={tache.id}>
                <td>{tache.title}</td>
                <td className="num">{tache.minutes_par_jour} min</td>
                <td className="num">{formatHeure(tache.secondes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
