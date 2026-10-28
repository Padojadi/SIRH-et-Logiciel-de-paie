import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Documentation" };

export default async function Documentation() {
  await requireUser();
  return (
    <article className="docs">
      <PageHeader
        kicker="Aide"
        title="Documentation"
        lede="Cauris regroupe les ressources humaines, le temps de travail, la comptabilité et la paie pour une organisation installée sur son propre serveur."
      />

      <h2>Installer sur un serveur</h2>
      <p>Le logiciel est une application web multi-utilisateurs. Un seul processus Node sert tous les comptes. La base SQLite, en mode WAL, convient à une équipe sur un serveur. Ce n'est pas un cluster réparti.</p>
      <ol>
        <li>Installer Node.js 22.</li>
        <li>Depuis le dossier du projet : <code>npm install</code>, puis <code>npm run build</code>.</li>
        <li>Lancer <code>npm start</code>. Le port par défaut est 3000. Placez un reverse proxy HTTPS devant.</li>
        <li>Définir <code>SESSION_SECRET</code> (une longue chaîne aléatoire) et, si besoin, <code>CAURIS_DB_PATH</code> pour l'emplacement de la base.</li>
      </ol>
      <p>Au premier démarrage, une organisation de démonstration est créée si la base est vide. Les identifiants s'affichent sur l'écran de connexion tant que le paramètre correspondant reste actif. Changez les mots de passe avant une utilisation réelle, puis masquez ces comptes.</p>

      <h2>Rôles</h2>
      <ul>
        <li>Administrateur : tout, y compris les utilisateurs, les paramètres et la sauvegarde.</li>
        <li>Direction des ressources humaines : organisation, fiches, évaluations, temps et lecture de la paie.</li>
        <li>Responsable d'unité : mêmes lectures, évaluations limitées à son unité, gestion du temps.</li>
        <li>Agent : sa fiche, son poste de travail et ses bulletins.</li>
        <li>Comptable : saisie, états, rapprochement et fichier des écritures.</li>
        <li>Aide-comptable : saisie et consultation, sans le fichier des écritures ni la sauvegarde.</li>
        <li>Gestionnaire de paie : conventions, bulletins, remontée, et lecture des dossiers agents.</li>
      </ul>

      <h2>Fiches de poste</h2>
      <p>Une fiche porte une mission, un profil et des tâches minutées. Elle se télécharge en PDF ou en Word. L'évaluation compare le temps imputé sur ces tâches au temps prévu, et le temps de présence à la durée théorique.</p>
      <ul>
        <li>Présence inférieure à 70 % : traiter d'abord l'assiduité.</li>
        <li>Charge supérieure à 115 % : alléger la fiche.</li>
        <li>Charge inférieure à 80 % avec une présence d'au moins 85 % : alourdir la fiche.</li>
        <li>Sinon, la fiche est équilibrée.</li>
      </ul>
      <p>Pour une unité, une direction, un service, un bureau ou une cellule : recruter si au moins un quart des agents est en surcharge et moins d'un cinquième en sous-charge ; réaffecter si les deux parts atteignent 20 % ; sinon l'effectif est suffisant. Le responsable ne voit que son périmètre.</p>

      <h2>Temps de travail</h2>
      <p>Le compteur s'ouvre à la première utilisation du poste dans la journée. La plage standard commence entre 6 h et 8 h et se termine entre 15 h et 18 h. Ces bornes sont verrouillées dans les paramètres. La durée théorique par défaut est de 8 heures : la fenêtre 6 h–18 h dit quand le temps compte, elle n'est pas la durée due.</p>
      <p>Le compteur se bloque après deux minutes sans souris, clavier, défilement ou toucher, ou si l'onglet est masqué. Une exception activée peut ignorer cette pause et compter en dehors de la plage, avec un plafond de quatre heures entre deux signaux. Le module d'exceptions précise l'agent, l'unité ou tout le monde, les dates, les heures et les jours.</p>
      <p>Un shift remplace la plage : l'arrivée est à l'heure pendant les deux premières heures, y compris sur un horaire de nuit. Un travail planifié ajoute une fenêtre, samedi compris. Le temps passé hors écran, en mission par exemple, se régularise avec un motif. L'exception suppose que la page du poste reste ouverte.</p>

      <h2>Comptabilité</h2>
      <p>Le plan SYSCOHADA est intégré et se personnalise : intitulé, nature, activation, analytique par défaut. Le plan SYCEBNL livré est un plan de départ, à compléter. Changer de référentiel masque l'historique de l'autre jusqu'au retour. Les journaux sont les achats, les ventes, la banque, les opérations diverses et la paie.</p>
      <p>La saisie se fait par pièce ou au kilomètre. L'analytique vide est repris du compte, sinon de l'unité de la personne connectée. Les montants sont des francs CFA entiers.</p>
      <p>La balance comporte six colonnes : ouverture, mouvements et soldes, au débit et au crédit. Le grand livre reprend le report et permet le lettrage. Le compte de résultat et le bilan simplifié intègrent le résultat non clos pour que l'actif égale le passif. Les classes 9 et les comptes indicateurs sont hors de ces états.</p>
      <p>Les relevés s'importent en OFX, en CFONB 120 ou en CSV <code>date;libellé;montant</code>. Un montant positif du relevé se pointe sur un débit du compte banque. Les factures fournisseurs passent de brouillon à validées, puis en remise bancaire. L'assistant d'immobilisation crée le bien et l'écriture d'acquisition. Les dotations sont linéaires, au mois commercial de 30 jours, le reliquat sur la dernière échéance. Les budgets sont mensuels. Le tableur accepte des formules <code>=A1+B1</code> et <code>=SUM(A1:A8)</code>.</p>
      <p>Exports : balance Excel et Word, grand livre Excel, aide TVA en CSV, fichier des écritures comptables (18 colonnes, tabulations, virgule décimale, XOF). Le CSV de TVA n'est pas une liasse DGI.</p>

      <h2>Paie</h2>
      <p>Les salariés et les vacataires sont rattachés à une convention. Le bulletin PDF et l'export Excel reprennent le brut, les retenues, le net et la part employeur. La remontée regroupe ces montants par unité. La comptabilisation écrit le journal de paie : salaires, charges, net, organismes et impôts.</p>
      <p>Les taux d'origine décrivent un barème indicatif sénégalais au 1er janvier 2026 (IPRES, IPM, CSS, CFCE, TRIMF, impôt sur le revenu et réduction pour parts). Ils se modifient dans chaque convention. Vérifiez-les avant toute paie réelle : ce logiciel ne remplace ni le texte officiel ni un conseil.</p>

      <h2>Sauvegarde et mises à jour</h2>
      <p>L'administrateur télécharge la base depuis le menu Sauvegarde. Copiez aussi <code>SESSION_SECRET</code> si vous restaurez ailleurs : sans le même secret, les sessions en cours sont invalidées, les comptes restent intacts. Arrêtez le serveur avant de remplacer le fichier, ou restaurez sous un nouveau <code>CAURIS_DB_PATH</code>.</p>
      <p>Les mises à jour sont annuelles : remplacez le programme, conservez la base et le secret, puis relancez. Le schéma se complète au démarrage.</p>

      <h2>Modèle et support</h2>
      <p>L'usage prévu est un coût d'acquisition, puis une redevance annuelle à compter de la deuxième année. Le montant relève du contrat, il n'est pas codé dans le logiciel. La redevance couvre la mise à jour annuelle et le support. Cette page est la documentation en ligne, accessible à chaque personne connectée.</p>
    </article>
  );
}
