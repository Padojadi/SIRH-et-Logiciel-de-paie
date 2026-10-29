import type { SessionUser } from "./auth";
import { all, get, run } from "./db";
import { getAgent } from "./hr-store";
import { RAYON_MAX, RAYON_MIN, deciderPresence, descripteurValide, type DecisionPresence, type Lieu } from "./presence";
import { audit } from "./settings";

export type LieuAgent = Lieu & { id: number; agent_id: number };

export type PreuvePresence = {
  descripteur: number[] | null;
  latitude: number | null;
  longitude: number | null;
  precision: number | null;
};

export function finalisationRequise(user: Pick<SessionUser, "id" | "agent_id">): boolean {
  if (!user.agent_id) return false;
  const compte = get<{ mot_de_passe_personnel: number }>("SELECT mot_de_passe_personnel FROM users WHERE id = ?", [user.id]);
  if (!compte?.mot_de_passe_personnel) return true;
  return !get<{ agent_id: number }>("SELECT agent_id FROM identites_faciales WHERE agent_id = ?", [user.agent_id]);
}

export function etatAcces(user: Pick<SessionUser, "id" | "agent_id">): { motDePasse: boolean; visageLe: string | null } {
  const compte = get<{ mot_de_passe_personnel: number }>("SELECT mot_de_passe_personnel FROM users WHERE id = ?", [user.id]);
  const visage = user.agent_id
    ? get<{ enregistre_le: string }>("SELECT enregistre_le FROM identites_faciales WHERE agent_id = ?", [user.agent_id])
    : undefined;
  return { motDePasse: compte?.mot_de_passe_personnel === 1, visageLe: visage?.enregistre_le ?? null };
}

export function lieuxAgent(agentId: number): LieuAgent[] {
  return all<LieuAgent>(
    "SELECT id, agent_id, nom, latitude, longitude, rayon_metres FROM localisations_autorisees WHERE agent_id = ? ORDER BY nom",
    [agentId],
  );
}

export function visageEnregistre(agentId: number): boolean {
  return Boolean(get("SELECT agent_id FROM identites_faciales WHERE agent_id = ?", [agentId]));
}

function descripteurEnregistre(agentId: number): number[] | null {
  const row = get<{ descripteur: string }>("SELECT descripteur FROM identites_faciales WHERE agent_id = ?", [agentId]);
  if (!row) return null;
  try {
    const values = JSON.parse(row.descripteur) as unknown;
    return descripteurValide(values) ? values : null;
  } catch {
    return null;
  }
}

export function controlerPresence(agentId: number, preuve: PreuvePresence): DecisionPresence {
  return deciderPresence({
    descripteurEnregistre: descripteurEnregistre(agentId),
    descripteurRecu: preuve.descripteur,
    lieux: lieuxAgent(agentId),
    latitude: preuve.latitude,
    longitude: preuve.longitude,
    precision: preuve.precision,
  });
}

export function enregistrerVisage(agentId: number, descripteur: number[], userId: number): void {
  if (!descripteurValide(descripteur)) throw new Error("Le visage capturé n'est pas exploitable. Placez-vous seul face à la caméra.");
  const agent = getAgent(agentId);
  if (!agent) throw new Error("Agent introuvable.");
  const maintenant = new Date().toISOString();
  run(
    `INSERT INTO identites_faciales (agent_id, descripteur, enregistre_le) VALUES (?, ?, ?)
     ON CONFLICT(agent_id) DO UPDATE SET descripteur = excluded.descripteur, enregistre_le = excluded.enregistre_le`,
    [agentId, JSON.stringify(descripteur), maintenant],
  );
  audit(userId, "visage", `Identité faciale enregistrée pour ${agent.matricule}`);
}

export function ajouterLieu(input: { agentId: number; nom: string; latitude: number; longitude: number; rayonMetres: number }, userId: number): void {
  const agent = getAgent(input.agentId);
  if (!agent) throw new Error("Agent introuvable.");
  const nom = input.nom.trim();
  if (nom.length < 2) throw new Error("Le nom du lieu est trop court.");
  if (input.latitude < -90 || input.latitude > 90 || input.longitude < -180 || input.longitude > 180) {
    throw new Error("Les coordonnées sont invalides.");
  }
  const rayon = Math.round(input.rayonMetres);
  if (rayon < RAYON_MIN || rayon > RAYON_MAX) throw new Error(`Le rayon doit être compris entre ${RAYON_MIN} et ${RAYON_MAX} mètres.`);
  run(
    "INSERT INTO localisations_autorisees (agent_id, nom, latitude, longitude, rayon_metres) VALUES (?, ?, ?, ?, ?)",
    [input.agentId, nom, input.latitude, input.longitude, rayon],
  );
  audit(userId, "localisation", `${agent.matricule} · ${nom}`);
}

export function retirerLieu(id: number, agentId: number, userId: number): void {
  const lieu = get<{ nom: string }>("SELECT nom FROM localisations_autorisees WHERE id = ? AND agent_id = ?", [id, agentId]);
  if (!lieu) throw new Error("Localisation introuvable.");
  run("DELETE FROM localisations_autorisees WHERE id = ? AND agent_id = ?", [id, agentId]);
  audit(userId, "localisation", `Retrait de ${lieu.nom}`);
}
