import { getSessionUser } from "@/lib/auth";
import { descripteurValide } from "@/lib/presence";
import { enregistrerVisage, etatAcces } from "@/lib/presence-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  if (!user.agent_id) return Response.json({ error: "Ce compte n'est lié à aucun agent." }, { status: 400 });
  const acces = etatAcces(user);
  if (!acces.motDePasse) return Response.json({ error: "Changez d'abord votre mot de passe." }, { status: 400 });
  const body = await request.json() as { descripteur?: unknown };
  if (!descripteurValide(body.descripteur)) {
    return Response.json({ error: "Le visage capturé n'est pas exploitable." }, { status: 400 });
  }
  try {
    enregistrerVisage(user.agent_id, body.descripteur, user.id);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Enregistrement impossible." }, { status: 400 });
  }
  return Response.json({ ok: true });
}
