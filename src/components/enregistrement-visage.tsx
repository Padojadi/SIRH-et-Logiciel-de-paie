"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { lireVisage, useFluxCamera } from "@/lib/visage-navigateur";

export function EnregistrementVisage({ dejaEnregistre }: { dejaEnregistre: boolean }) {
  const router = useRouter();
  const { videoRef, erreur, prete } = useFluxCamera();
  const [message, setMessage] = useState(dejaEnregistre ? "Un visage est déjà enregistré. Une nouvelle capture le remplace." : "Placez-vous seul face à la caméra, dans une lumière stable.");
  const [enCours, setEnCours] = useState(false);

  async function capturer() {
    const video = videoRef.current;
    if (!video) return;
    setEnCours(true);
    const lecture = await lireVisage(video);
    if ("erreur" in lecture) {
      setMessage(lecture.erreur);
      setEnCours(false);
      return;
    }
    const response = await fetch("/api/identite/visage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripteur: lecture.descripteur }),
    });
    const data = await response.json() as { error?: string; ok?: boolean };
    setEnCours(false);
    if (!response.ok) {
      setMessage(data.error ?? "L'enregistrement a échoué.");
      return;
    }
    setMessage("Visage enregistré. L'accès est finalisé.");
    router.refresh();
  }

  return (
    <section className="panel">
      <h2>Identité faciale</h2>
      <p>Cette capture termine le changement de mot de passe. Elle sera comparée à la personne devant la caméra du poste pour démarrer le compteur.</p>
      <video ref={videoRef} className="camera" autoPlay muted playsInline />
      {erreur ? <p className="flash err">{erreur}</p> : null}
      <p>{message}</p>
      <button type="button" onClick={() => void capturer()} disabled={!prete || Boolean(erreur) || enCours}>
        {enCours ? "Lecture…" : dejaEnregistre ? "Remplacer le visage" : "Enregistrer le visage"}
      </button>
    </section>
  );
}
