import type { AvisFiche, AvisUnite, Arrival } from "./time-engine";

export const AVIS_FICHE: Record<AvisFiche, string> = {
  alleger: "Alléger la fiche de poste",
  alourdir: "Alourdir la fiche de poste",
  equilibree: "Fiche équilibrée",
  assiduite: "Traiter d'abord l'assiduité",
};

export const AVIS_UNITE: Record<AvisUnite, string> = {
  recruter: "Recruter",
  reaffecter: "Réaffecter",
  effectif_suffisant: "Effectif suffisant",
};

export const ARRIVEE: Record<Arrival, string> = {
  avant_plage: "Avant la plage",
  a_l_heure: "À l'heure",
  retard: "En retard",
};

export const ORG_TYPES = [
  ["direction", "Direction"],
  ["service", "Service"],
  ["bureau", "Bureau"],
  ["cellule", "Cellule"],
  ["unite", "Unité"],
] as const;

export const STATUTS_AGENT = [
  ["titulaire", "Titulaire"],
  ["vacataire", "Vacataire"],
  ["stagiaire", "Stagiaire"],
] as const;

export function orgTypeLabel(type: string): string {
  return ORG_TYPES.find((item) => item[0] === type)?.[1] ?? type;
}
