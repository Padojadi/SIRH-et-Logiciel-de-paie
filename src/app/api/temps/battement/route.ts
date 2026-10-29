import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { descripteurValide } from "@/lib/presence";
import { etatJournee, enregistrerBattement } from "@/lib/time-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Connexion requise." }, { status: 401 });
  const body = await request.json() as {
    agentId?: number;
    tacheId?: number | null;
    active?: boolean;
    descripteur?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    precision?: unknown;
  };
  const requested = Number(body.agentId);
  if (requested && requested !== user.agent_id) {
    if (!can(user.role, "temps.manage")) return Response.json({ error: "Aucun agent n'est lié à cette session." }, { status: 400 });
    return Response.json(etatJournee(requested));
  }
  const agentId = user.agent_id ?? 0;
  if (!agentId) return Response.json({ error: "Aucun agent n'est lié à cette session." }, { status: 400 });
  const nombre = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
  try {
    const etat = enregistrerBattement(agentId, {
      active: Boolean(body.active),
      tacheId: body.tacheId ?? null,
      preuve: {
        descripteur: descripteurValide(body.descripteur) ? body.descripteur : null,
        latitude: nombre(body.latitude),
        longitude: nombre(body.longitude),
        precision: nombre(body.precision),
      },
    }, user.id);
    return Response.json(etat);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Comptage impossible." }, { status: 400 });
  }
}
