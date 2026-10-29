"use client";

import { useEffect, useRef, useState } from "react";
import { TAILLE_DESCRIPTEUR } from "./presence";

let chargement: Promise<typeof import("@vladmandic/face-api")> | null = null;

function modeles() {
  if (!chargement) {
    chargement = import("@vladmandic/face-api").then(async (faceapi) => {
      await faceapi.nets.tinyFaceDetector.loadFromUri("/modeles-visage");
      await faceapi.nets.faceLandmark68Net.loadFromUri("/modeles-visage");
      await faceapi.nets.faceRecognitionNet.loadFromUri("/modeles-visage");
      return faceapi;
    });
  }
  return chargement;
}

export function useFluxCamera(actif = true) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [prete, setPrete] = useState(false);

  useEffect(() => {
    if (!actif) return undefined;
    let flux: MediaStream | null = null;
    let abandon = false;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 } }, audio: false })
      .then(async (stream) => {
        flux = stream;
        if (abandon) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setPrete(true);
      })
      .catch(() => setErreur("La caméra du poste est indisponible ou l'autorisation a été refusée."));
    return () => {
      abandon = true;
      flux?.getTracks().forEach((track) => track.stop());
    };
  }, [actif]);

  return { videoRef, erreur, prete };
}

export async function lireVisage(video: HTMLVideoElement): Promise<{ descripteur: number[] } | { erreur: string }> {
  if (video.readyState < 2) return { erreur: "La caméra n'est pas encore prête." };
  try {
    const faceapi = await modeles();
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
    const detections = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
    if (detections.length === 0) return { erreur: "Aucun visage n'est visible devant la caméra." };
    if (detections.length > 1) return { erreur: "Une seule personne doit être devant la caméra." };
    const descripteur = Array.from(detections[0].descriptor);
    if (descripteur.length !== TAILLE_DESCRIPTEUR) return { erreur: "La lecture du visage a échoué." };
    return { descripteur };
  } catch {
    return { erreur: "La vérification faciale n'a pas pu démarrer." };
  }
}

export function lirePosition(): Promise<{ latitude: number; longitude: number; precision: number } | { erreur: string }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ erreur: "Ce poste ne fournit pas de localisation." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        precision: position.coords.accuracy,
      }),
      () => resolve({ erreur: "La localisation du poste a été refusée ou est indisponible." }),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
    );
  });
}
