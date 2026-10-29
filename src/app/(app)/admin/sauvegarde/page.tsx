import { LinkButton, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { dbPath } from "@/lib/db";

export const metadata = { title: "Sauvegarde" };

export default async function Sauvegarde() {
  await requireUser("admin");
  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Sauvegarde"
        lede="La sauvegarde est manuelle. Le fichier téléchargé est une copie cohérente de la base après un point de contrôle. Conservez-le hors du serveur, et notez le secret de session si vous restaurez sur une autre machine."
      />
      <section className="panel">
        <p>Emplacement sur le serveur : {dbPath()}</p>
        <LinkButton href="/api/fichier?type=sauvegarde">Télécharger la base</LinkButton>
      </section>
    </>
  );
}
