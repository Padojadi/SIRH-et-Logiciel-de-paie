export const TAILLE_DESCRIPTEUR = 128;
export const SEUIL_VISAGE = 0.5;
export const RAYON_MIN = 30;
export const RAYON_MAX = 20_000;
const PRECISION_MAX = 1_000;
const MARGE_PRECISION_MAX = 100;

export type Lieu = { nom: string; latitude: number; longitude: number; rayon_metres: number };

export type DecisionPresence =
  | { ok: true; lieu: string }
  | { ok: false; message: string };

export function descripteurValide(values: unknown): values is number[] {
  if (!Array.isArray(values) || values.length !== TAILLE_DESCRIPTEUR) return false;
  return values.every((value) => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 2);
}

export function distanceDescripteurs(enregistre: number[], recu: number[]): number {
  let somme = 0;
  for (let index = 0; index < enregistre.length; index += 1) {
    const ecart = enregistre[index] - recu[index];
    somme += ecart * ecart;
  }
  return Math.sqrt(somme);
}

export function distanceMetres(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number): number {
  const rayonTerre = 6_371_000;
  const phiA = (latitudeA * Math.PI) / 180;
  const phiB = (latitudeB * Math.PI) / 180;
  const deltaPhi = ((latitudeB - latitudeA) * Math.PI) / 180;
  const deltaLambda = ((longitudeB - longitudeA) * Math.PI) / 180;
  const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phiA) * Math.cos(phiB) * Math.sin(deltaLambda / 2) ** 2;
  return 2 * rayonTerre * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function deciderPresence(input: {
  descripteurEnregistre: number[] | null;
  descripteurRecu: number[] | null;
  lieux: Lieu[];
  latitude: number | null;
  longitude: number | null;
  precision: number | null;
}): DecisionPresence {
  if (!input.descripteurEnregistre || !descripteurValide(input.descripteurEnregistre)) {
    return { ok: false, message: "L'identité faciale n'est pas encore enregistrée." };
  }
  if (!input.descripteurRecu || !descripteurValide(input.descripteurRecu)) {
    return { ok: false, message: "Le visage devant la caméra n'est pas lisible." };
  }
  if (distanceDescripteurs(input.descripteurEnregistre, input.descripteurRecu) > SEUIL_VISAGE) {
    return { ok: false, message: "Le visage ne correspond pas à l'identité enregistrée." };
  }
  if (input.lieux.length === 0) {
    return { ok: false, message: "Aucune localisation autorisée n'est enregistrée pour cet agent." };
  }
  const { latitude, longitude, precision } = input;
  if (latitude === null || longitude === null || precision === null) {
    return { ok: false, message: "La localisation du poste de travail est requise." };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || precision < 0 || precision > PRECISION_MAX) {
    return { ok: false, message: "La localisation du poste est trop imprécise." };
  }
  let retenu: string | null = null;
  let meilleure = Infinity;
  for (const lieu of input.lieux) {
    const distance = distanceMetres(latitude, longitude, lieu.latitude, lieu.longitude);
    const admis = lieu.rayon_metres + Math.min(precision, MARGE_PRECISION_MAX);
    if (distance <= admis && distance < meilleure) {
      meilleure = distance;
      retenu = lieu.nom;
    }
  }
  if (!retenu) return { ok: false, message: "Le poste est en dehors des localisations autorisées." };
  return { ok: true, lieu: retenu };
}
