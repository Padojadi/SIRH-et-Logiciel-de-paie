import { notFound } from "next/navigation";
import { FicheForm } from "@/components/fiche-form";
import { Flash, LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getFiche, listOrg } from "@/lib/hr-store";
import { can } from "@/lib/permissions";
import { readQuery } from "@/lib/query";

export const metadata = { title: "Fiche de poste" };

export default async function FichePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser("rh.read");
  const { id } = await params;
  const { ok, erreur } = await readQuery(searchParams);
  const fiche = getFiche(Number(id));
  if (!fiche) notFound();
  const total = (fiche.taches ?? []).reduce((sum, task) => sum + task.minutes_par_jour, 0);
  return (
    <>
      <PageHeader
        kicker={fiche.code}
        title={fiche.title}
        lede={`${fiche.org_nom ?? "Sans unité"} · version ${fiche.version} · ${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")} prévues par jour.`}
        actions={
          <>
            <LinkButton href={`/api/fichier?type=fiche-pdf&id=${fiche.id}`} secondary>Télécharger le PDF</LinkButton>
            <LinkButton href={`/api/fichier?type=fiche-docx&id=${fiche.id}`} secondary>Télécharger le Word</LinkButton>
          </>
        }
      />
      <Flash ok={ok} erreur={erreur} />
      {can(user.role, "rh.write") ? (
        <FicheForm fiche={{ ...fiche, taches: fiche.taches ?? [] }} units={listOrg().map((unit) => ({ id: unit.id, name: `${unit.code} — ${unit.name}` }))} />
      ) : (
        <section className="panel">
          <h2>Mission</h2>
          <p>{fiche.mission}</p>
          {fiche.profil ? <><h2>Profil</h2><p>{fiche.profil}</p></> : null}
          <h2>Tâches</h2>
          <table>
            <thead><tr><th>Tâche</th><th>Description</th><th className="num">Minutes</th></tr></thead>
            <tbody>
              {(fiche.taches ?? []).map((task) => (
                <tr key={task.id}><td>{task.title}</td><td>{task.description}</td><td className="num">{task.minutes_par_jour}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
