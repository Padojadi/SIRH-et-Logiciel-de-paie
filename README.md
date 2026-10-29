# 2TIC

Logiciel de ressources humaines, de temps de travail, de comptabilité SYSCOHADA / SYCEBNL et de paie. Application web en français, à installer sur un serveur, utilisée par plusieurs personnes selon leur rôle.

## Démarrage

Prérequis : Node.js 22.

```bash
npm install
npm test
npm run build
npm start
```

Le serveur écoute le port 3000. Placez un reverse proxy HTTPS devant lui. La base est créée au premier lancement dans `data/cauris.sqlite`, avec une organisation de démonstration.

Variables d'environnement :

- `SESSION_SECRET` : secret des sessions. À fixer en production.
- `CAURIS_DB_PATH` : chemin de la base, si elle ne doit pas rester dans `data/`.
- `PORT` : port d'écoute.

Un processus Node sert tous les utilisateurs. SQLite en mode WAL convient à une équipe sur ce serveur. Ce n'est pas un déploiement réparti sur plusieurs machines.

## Rôles

| Rôle | Accès |
| --- | --- |
| Administrateur | Ensemble du logiciel, utilisateurs, paramètres, sauvegarde |
| Direction des ressources humaines | Organisation, fiches, évaluations, temps, lecture de la paie |
| Responsable d'unité | Évaluations de son périmètre et gestion du temps |
| Agent | Sa fiche, son poste de travail, ses bulletins |
| Comptable | Saisie, états, rapprochement, fichier des écritures |
| Aide-comptable | Saisie et consultation, sans le fichier des écritures |
| Gestionnaire de paie | Conventions, bulletins, remontée, dossiers agents |

## Comptes de démonstration

Ils apparaissent sur l'écran de connexion tant que le paramètre reste actif. À désactiver après le changement des mots de passe.

| Identifiant | Mot de passe | Rôle |
| --- | --- | --- |
| admin@savanes.demo | Savanes-Admin-2026 | Administrateur |
| drh@savanes.demo | Savanes-Drh-2026 | DRH |
| paie@savanes.demo | Savanes-Paie-2026 | Gestionnaire de paie |
| comptable@savanes.demo | Savanes-Compta-2026 | Comptable |
| aide@savanes.demo | Savanes-Aide-2026 | Aide-comptable |
| responsable@savanes.demo | Savanes-Resp-2026 | Responsable |
| agent@savanes.demo | Savanes-Agent-2026 | Agent |

## Ce que fait le logiciel

- Fiches de poste, création et téléchargement PDF / Word.
- Évaluation du temps passé et du contenu du travail par rapport à la fiche : alléger, alourdir, ou traiter l'assiduité.
- Évaluation par unité, cellule, bureau, service et direction : recruter, réaffecter, ou constater un effectif suffisant.
- Compteur quotidien. La journée s'ouvre à la première connexion, entre 6 h et 8 h, et se termine entre 15 h et 18 h. Il se bloque après deux minutes sans utilisation. Des exceptions, des shifts et des travaux planifiés prolongent ou déplacent ce cadre.
- Plan SYSCOHADA intégré et personnalisable. Plan SYCEBNL de départ, à compléter.
- Saisie par pièce ou au kilomètre, analytique automatique, balance à six colonnes, grand livre, bilan et compte de résultat simplifiés.
- Budgets mensuels, rapprochement bancaire (OFX, CFONB 120, CSV), immobilisations et dotations, règlements fournisseurs, tableur.
- Exports Excel, Word, FEC et aide TVA.
- Paie multi-conventions, vacataires, bulletins PDF, export Excel et remontée par unité.
- Sauvegarde manuelle de la base par l'administrateur.
- Documentation dans l'application, menu Documentation.

Les paramètres de paie d'origine sont indicatifs pour le Sénégal au 1er janvier 2026. Ils se modifient dans chaque convention et doivent être vérifiés avant une paie réelle.

## Sauvegarde

Menu Administration, Sauvegarde, ou `GET /api/fichier?type=sauvegarde` avec une session d'administrateur. Le téléchargement force un point de contrôle WAL. Pour restaurer, arrêtez le serveur et remplacez le fichier de base. Conservez `SESSION_SECRET` : un secret différent invalide les sessions, pas les comptes.

## Déploiement sur SIGRHPC.2ticglobal.com

L'application Next.js sert l'interface et le serveur. Sur le VPS `195.110.35.45`, elle tourne sous PM2, nom `sigrhpc`, et n'écoute que `127.0.0.1:3020`. Nginx publie `SIGRHPC.2ticglobal.com` et reverse-proxy vers ce port. Le certificat Let's Encrypt ne couvre que `sigrhpc.2ticglobal.com`.

La base est le fichier `/opt/sigrhpc/data/cauris.sqlite`. Le secret de session et le chemin de la base sont dans `/opt/sigrhpc/.env`, réservé à root. Le démarrage est `start.sh` :

```bash
cd /opt/sigrhpc
pm2 start /opt/sigrhpc/start.sh --name sigrhpc --cwd /opt/sigrhpc
pm2 save
```

`deploy/install-vps.sh` installe Docker et Caddy et exige les ports 80 et 443 libres. Ne pas l'exécuter sur ce VPS : nginx et les autres applications y occupent déjà ces ports.

Copie sur le Mac, depuis le Mac :

```bash
git clone --branch cursor/logiciel-grh-compta-paie-bc90 https://github.com/Padojadi/SIRH-et-Logiciel-de-paie.git "/Users/Paul Do Mac Folders/Protosen_Hostinger/SIGRHPC"
```

## Modèle

Coût d'acquisition, puis redevance annuelle à partir de la deuxième année, selon le contrat. La redevance couvre la mise à jour annuelle et le support. Le montant n'est pas paramétré dans le logiciel.
