import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { enregistrerBattement } from "@/lib/time-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const body = await request.json() as { agentId?: number; tacheId?: number | null; active?: boolean };
  const requested = Number(body.agentId);
  const agentId = requested && requested !== user.agent_id ? (can(user.role, "temps.manage") ? requested : 0) : (user.agent_id ?? 0);
  if (!agentId) return Response.json({ error: "Aucun agent n'est lié à cette session." }, { status: 400 });
  try {
    const etat = enregistrerBattement(agentId, { active: Boolean(body.active), tacheId: body.tacheId ?? null }, user.id);
    return Response.json(etat);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Comptage impossible." }, { status: 400 });
  }
}
