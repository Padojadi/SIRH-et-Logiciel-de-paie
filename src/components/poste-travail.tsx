"use client";

import { useEffect, useRef, useState } from "react";
import { formatHeure } from "@/lib/dates";
import { lirePosition, lireVisage, useFluxCamera } from "@/lib/visage-navigateur";

type Tache = { id: number; title: string; minutes_par_jour: number; secondes: number };
type Lieu = { nom: string; rayon_metres: number };
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
  lieux: Lieu[];
  visageEnregistre: boolean;
  autorise: boolean;
  controle: string | null;
};

export function PosteTravail({ initial, agentId, personnel }: { initial: Etat; agentId: number; personnel: boolean }) {
  const [etat, setEtat] = useState(initial);
  const [tacheId, setTacheId] = useState<number | "">(initial.taches[0]?.id ?? "");
  const [active, setActive] = useState(true);
  const [local, setLocal] = useState(initial.secondes);
  const [message, setMessage] = useState(personnel ? "En attente du visage et de la localisation." : "Consultation seule.");
  const { videoRef, erreur: cameraErreur, prete } = useFluxCamera(personnel);
  const tacheRef = useRef(tacheId);
  const plageRef = useRef(initial.dansLaPlage);
  const autoriseRef = useRef(false);
  tacheRef.current = tacheId;
  plageRef.current = etat.dansLaPlage;

  useEffect(() => {
    if (!personnel) return undefined;
    let last = Date.now();
    const mark = () => { last = Date.now(); };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((event) => window.addEventListener(event, mark, { passive: true }));
    const tick = window.setInterval(() => {
      const present = document.visibilityState === "visible" && Date.now() - last < 120000;
      setActive(present);
      if (present && plageRef.current && autoriseRef.current) setLocal((value) => value + 1);
    }, 1000);
    const envoyer = async () => {
      const present = document.visibilityState === "visible" && Date.now() - last < 120000;
      const video = videoRef.current;
      const visage = video && prete ? await lireVisage(video) : { erreur: cameraErreur ?? "La caméra n'est pas prête." };
      const position = await lirePosition();
      const response = await fetch("/api/temps/battement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          tacheId: tacheRef.current || null,
          active: present,
          descripteur: "descripteur" in visage ? visage.descripteur : null,
          latitude: "latitude" in position ? position.latitude : null,
          longitude: "longitude" in position ? position.longitude : null,
          precision: "precision" in position ? position.precision : null,
        }),
      });
      if (!response.ok) {
        setMessage("Connexion au compteur interrompue");
        return;
      }
      const data = await response.json() as Etat;
      autoriseRef.current = data.autorise;
      setEtat(data);
      setLocal(data.secondes);
      if (!data.autorise) setMessage(data.controle ?? ("erreur" in visage ? visage.erreur : "erreur" in position ? position.erreur : "Contrôle refusé"));
      else setMessage(data.exception ? `Exception : ${data.exception}` : data.dansLaPlage ? (present ? data.controle ?? "En comptage" : "Pause d'inactivité") : "Hors plage de comptage");
    };
    void envoyer();
    const beat = window.setInterval(() => void envoyer(), 15000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, mark));
      window.clearInterval(tick);
      window.clearInterval(beat);
    };
  }, [agentId, personnel, prete, cameraErreur, videoRef]);

  return (
    <div className="grid cards-2">
      <section className="panel">
        <p className="kicker">{etat.poste || "Poste de travail"}</p>
        <p className="timer">{formatHeure(local)}</p>
        <p>{message} · {etat.date.split("-").reverse().join("/")}</p>
        <p className="muted">{etat.fiche || "Aucune fiche de poste n'est attachée à cet agent."}</p>
        {etat.statutArrivee ? <p>Arrivée : {etat.statutArrivee === "a_l_heure" ? "à l'heure" : etat.statutArrivee === "retard" ? "en retard" : "avant la plage"}</p> : <p>La journée s'ouvrira au premier contrôle réussi.</p>}
        {personnel ? <video ref={videoRef} className="camera" autoPlay muted playsInline /> : null}
        {personnel && cameraErreur ? <p className="flash err">{cameraErreur}</p> : null}
        <label>Tâche en cours
          <select value={tacheId} onChange={(event) => setTacheId(event.target.value ? Number(event.target.value) : "")}>
            <option value="">Temps non imputé à la fiche</option>
            {etat.taches.map((tache) => <option key={tache.id} value={tache.id}>{tache.title}</option>)}
          </select>
        </label>
        <p className="muted">Le compteur démarre si la session est ouverte, si le visage correspond à l'identité enregistrée et si le poste est dans une localisation autorisée. Il s'arrête aussi après deux minutes sans utilisation.</p>
        <p>{active ? "Présence au clavier détectée" : "Inactivité détectée"}</p>
      </section>
      <section className="panel">
        <h2>Localisations autorisées</h2>
        {etat.lieux.length === 0 ? <p>Aucune localisation n'est encore définie. Le compteur reste fermé.</p> : (
          <ul>
            {etat.lieux.map((lieu) => <li key={lieu.nom}>{lieu.nom} · rayon {lieu.rayon_metres} m</li>)}
          </ul>
        )}
        <p className="muted">{etat.visageEnregistre ? "Identité faciale enregistrée." : "Identité faciale manquante : elle s'enregistre dans Mon accès, après le mot de passe."}</p>
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
