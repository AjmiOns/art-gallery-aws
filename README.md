# Galerie d'art en ligne

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-test%20mode-635BFF?logo=stripe&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-planned-7B42BC?logo=terraform&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-Learner%20Lab-FF9900?logo=amazonaws&logoColor=white)

Plateforme web où les artistes publient leurs œuvres (peintures, décoration murale, art numérique, croquis) et où les acheteurs les découvrent, contactent l'artiste et les achètent avec un vrai parcours de paiement. L'application est conçue pour être déployée sur une infrastructure AWS 3 tiers haute disponibilité, décrite dans la section [Architecture cible](#architecture-cible).

<img src="docs/screenshots/home.jpg" alt="Page d'accueil de la galerie" width="100%">

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Aperçu](#aperçu)
- [Rôles et permissions](#rôles-et-permissions)
- [Stack technique](#stack-technique)
- [Architecture cible](#architecture-cible)
- [Structure du dépôt](#structure-du-dépôt)
- [Démarrage rapide](#démarrage-rapide)
- [Scripts](#scripts)
- [Modèle de données](#modèle-de-données)
- [Visualiser la base de données](#visualiser-la-base-de-données)
- [Données de test](#données-de-test)
- [Déploiement](#déploiement)
- [Workflow Git](#workflow-git)
- [Feuille de route](#feuille-de-route)

## Fonctionnalités

**Pour tous les visiteurs**
- Catalogue classé par catégorie, avec carrousels, œuvre à la une, recherche, filtre de prix et tri.
- Fiche détaillée de chaque œuvre dans une fenêtre accessible au clavier.

**Acheteur**
- Demande d'achat avec message à l'artiste, suivi de ses demandes (en attente, à payer, historique).
- Paiement en ligne par carte et reçu imprimable.
- Messagerie pour contacter les artistes.

**Artiste**
- Publication, modification et suppression de ses œuvres, avec envoi d'image (JPG, PNG, WebP, 5 Mo).
- Gestion des demandes d'achat : accepter, refuser ou annuler une réservation.
- Contact direct des acheteurs et tableau de bord (œuvres, demandes à traiter, ventes, revenus).

**Administrateur**
- Statistiques : chiffre d'affaires, courbe des ventes sur 30 jours, répartition des commandes, catégories, meilleurs artistes.
- Gestion de tous les utilisateurs (artistes et acheteurs) : modification, changement de rôle, suspension, suppression.
- Gestion des œuvres et des commandes, gestion des catégories (nom, couleur, ordre, activation).
- Contact de n'importe quel utilisateur.

**Tous les comptes** : profil modifiable (nom, téléphone, ville, présentation) et changement de mot de passe.

## Aperçu

| Catalogue | Fiche d'une œuvre |
|---|---|
| <img src="docs/screenshots/home.jpg" alt="Catalogue par catégorie"> | <img src="docs/screenshots/detail.jpg" alt="Fiche d'une œuvre et demande d'achat"> |

| Paiement par carte | Espace artiste |
|---|---|
| <img src="docs/screenshots/checkout.jpg" alt="Page de paiement"> | <img src="docs/screenshots/artist.jpg" alt="Demandes d'achat de l'artiste"> |

| Administration | Messagerie |
|---|---|
| <img src="docs/screenshots/admin.jpg" alt="Statistiques de l'administrateur"> | <img src="docs/screenshots/messages.jpg" alt="Messagerie"> |

| Inscription | Mobile |
|---|---|
| <img src="docs/screenshots/register.jpg" alt="Inscription avec choix du rôle"> | <img src="docs/screenshots/mobile.jpg" alt="Version mobile" width="260"> |

## Rôles et permissions

Le rôle est choisi à l'inscription (acheteur ou artiste). Le compte administrateur est créé au premier démarrage du backend. L'API relit le rôle et l'état du compte en base à chaque requête : une suspension ou un changement de rôle prend effet immédiatement.

| Action | Visiteur | Acheteur | Artiste | Admin |
|---|:-:|:-:|:-:|:-:|
| Parcourir et rechercher les œuvres | oui | oui | oui | oui |
| Demander l'achat d'une œuvre | | oui | oui (pas la sienne) | |
| Payer une commande acceptée | | oui | oui | |
| Publier, modifier, supprimer ses œuvres | | | oui | toutes |
| Accepter ou refuser une demande | | | ses œuvres | toutes |
| Envoyer des messages | | oui (voir règles) | oui | à tous |
| Modifier son profil et son mot de passe | | oui | oui | oui |
| Statistiques, utilisateurs, catégories | | | | oui |

**Règles de la messagerie** : on écrit à l'artiste depuis la fiche d'une de ses œuvres, ou à une personne avec qui on a déjà échangé ou commandé. Les administrateurs peuvent écrire à tous et recevoir de tous. Ces règles limitent les messages non sollicités.

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Next.js 15 (App Router, export statique), React 19, TypeScript, CSS natif |
| Backend | NestJS 10, TypeORM, Passport JWT, class-validator, Multer, Stripe SDK |
| Base de données | PostgreSQL 16 (Docker en local, Amazon RDS en production) |
| Infrastructure | Terraform, scripts boto3, AWS Academy Learner Lab |
| Outillage | npm, concurrently, Docker Compose, Adminer, Python 3 (seed) |

## Architecture cible

Le frontend est exporté en fichiers statiques servis par S3 et CloudFront. L'API tourne sur des instances EC2 privées derrière un Application Load Balancer, sur deux zones de disponibilité. La base est une instance RDS PostgreSQL Multi-AZ, isolée dans des sous-réseaux privés.



> **État d'avancement** : l'application (frontend, API, base, paiement) est fonctionnelle en local. Les modules Terraform de `infra/` sont à écrire. Les images envoyées par les artistes sont stockées sur le disque du backend (`backend/uploads`) : en production, elles iront sur S3, car les instances de l'Auto Scaling Group ne partagent pas de disque.

## Structure du dépôt

```
art-gallery-aws/
├── frontend/        # Next.js (pages par rôle, composants, client API, images)
├── backend/         # NestJS (auth, users, categories, artworks, orders, payments, messages, uploads, admin)
├── infra/           # Terraform (modules : network, compute, rds, s3)
├── scripts/         # seed de données, générateur d'images, scripts boto3
├── docs/            # schéma d'architecture, livrables, captures d'écran
├── docker-compose.yml            # PostgreSQL
├── docker-compose.override.yml   # Adminer (visualisation de la base), fusionné automatiquement
├── package.json     # commandes racine (dev, seed, install:all)
└── README.md
```

## Démarrage rapide

**Prérequis** : Node.js 20+, Docker, Python 3.9+ (pour le seed uniquement).

```bash
git clone https://github.com/AjmiOns/art-gallery-aws.git
cd art-gallery-aws

# 1. Configuration
cp backend/.env.example backend/.env          # changer JWT_SECRET et ADMIN_PASSWORD
cp frontend/.env.local.example frontend/.env.local

# 2. Dépendances (racine, backend et frontend)
npm run install:all

# 3. Base de données + backend + frontend
npm start

# 4. Données de test (dans un second terminal, API démarrée)
npm run seed -- --reset
```

| Service | Adresse |
|---|---|
| Site | <http://localhost:3000> |
| API | <http://localhost:3001/api> |
| Visualisation de la base (Adminer) | <http://localhost:8080> |

Ouvrez le site via `localhost` : une autre adresse est refusée par la politique CORS du backend (voir [Configuration](#configuration)).

**Comptes de démonstration** (créés par le seed, mot de passe `Password123!`) : `artiste01@gallery.test`, `acheteur01@gallery.test`. L'administrateur est `admin@gallery.test` avec le mot de passe `ADMIN_PASSWORD` de votre `backend/.env` (`Admin1234!` par défaut).

> **Mise à jour d'une installation existante** : ajoutez à `backend/.env` les variables `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PUBLIC_API_URL`, `CURRENCY`, `PAYMENT_PROVIDER` et `STRIPE_*` de `backend/.env.example`, relancez `npm run install:all`, puis `npm run seed -- --reset`. Pour promouvoir un compte existant en administrateur, mettez son e-mail dans `ADMIN_EMAIL` : le backend lui donne le rôle admin au démarrage.

> **Windows PowerShell 5** : l'opérateur `&&` n'est pas reconnu. Utilisez `;` ou lancez les commandes une par une. Remplacez `cp` par `Copy-Item` si besoin.

## Scripts

| Commande (racine) | Action |
|---|---|
| `npm run install:all` | Installe les dépendances de la racine, du backend et du frontend |
| `npm start` | Démarre PostgreSQL et Adminer (Docker), puis le backend et le frontend |
| `npm run dev` | Démarre uniquement le backend et le frontend |
| `npm run db` | Démarre uniquement PostgreSQL et Adminer |
| `npm run seed` | Injecte des données de test (voir [Données de test](#données-de-test)) |

Par application : `npm run build` produit le backend (`backend/dist`) ou l'export statique du frontend (`frontend/out`).

## Modèle de données

```mermaid
erDiagram
    USERS ||--o{ ARTWORKS : "publie"
    USERS ||--o{ ORDERS : "achète"
    USERS ||--o{ ORDERS : "vend"
    USERS ||--o{ MESSAGES : "écrit"
    ARTWORKS ||--o{ ORDERS : "concerne"
    ORDERS ||--o{ PAYMENTS : "est réglée par"
    ARTWORKS }o..o| MESSAGES : "évoquée dans"
    CATEGORIES ||..o{ ARTWORKS : "slug = premier tag"

    USERS {
        uuid id PK
        string email UK
        string username
        string password_hash
        string role "admin, artist, buyer"
        string phone
        string city
        text bio
        boolean is_active
        timestamp created_at
    }
    CATEGORIES {
        uuid id PK
        string slug UK
        string label
        string tagline
        string tone
        int sort_order
        boolean is_active
    }
    ARTWORKS {
        uuid id PK
        string title
        string image_url
        text_array tags
        numeric price
        string status "available, reserved, sold"
        uuid owner_id FK
        timestamp created_at
    }
    ORDERS {
        uuid id PK
        uuid artwork_id FK
        uuid buyer_id FK
        uuid seller_id FK
        numeric amount
        text message
        string status "pending, accepted, rejected, cancelled, paid"
        timestamp paid_at
        timestamp created_at
    }
    PAYMENTS {
        uuid id PK
        uuid order_id FK
        string provider "mock, stripe"
        string provider_ref
        numeric amount
        string currency
        string status "pending, succeeded, failed"
        string card_brand
        string card_last4
        timestamp paid_at
    }
    MESSAGES {
        uuid id PK
        uuid sender_id FK
        uuid recipient_id FK
        uuid artwork_id FK
        text body
        timestamp read_at
        timestamp created_at
    }
```

Le prix d'une commande est figé à la demande. Le premier tag d'une œuvre est sa catégorie principale. En développement, le schéma est créé et mis à jour automatiquement (`synchronize`). Avant la production, il devra passer par des migrations.

## Visualiser la base de données

**1. Adminer, dans le navigateur (le plus simple).** `npm start` (ou `docker compose up -d`) démarre aussi Adminer. Ouvrez <http://localhost:8080/?pgsql=db&username=gallery&db=art_gallery> et saisissez le mot de passe `gallery`. Vous pouvez parcourir chaque table (`users`, `artworks`, `orders`, `payments`, `messages`, `categories`), modifier des lignes, lancer du SQL et exporter les données.

Si vous saisissez les champs à la main : système **PostgreSQL**, serveur `db`, utilisateur `gallery`, mot de passe `gallery`, base `art_gallery`.

**2. En ligne de commande.**

```bash
docker compose exec db psql -U gallery -d art_gallery
```

Commandes utiles : `\dt` liste les tables, `\d artworks` décrit une table, `\q` quitte.

**3. Avec un client graphique** (DBeaver, pgAdmin, extension SQLTools de VS Code) : hôte `localhost`, port `5432` (ou `5433` si vous l'avez remappé dans `docker-compose.yml`), utilisateur `gallery`, mot de passe `gallery`, base `art_gallery`.

**Les images ne sont pas stockées dans la base.** La colonne `artworks.image_url` contient seulement le chemin ou le lien du fichier :

| Origine | Valeur de `image_url` | Emplacement du fichier |
|---|---|---|
| Bibliothèque intégrée | `/artworks/painting/painting-01.jpg` | `frontend/public/artworks/` |
| Envoyée par un artiste | `http://localhost:3001/uploads/<uuid>.jpg` | `backend/uploads/` |
| Lien externe | `https://…` | site distant |

Pour voir une image, ouvrez son lien dans le navigateur. En production, les envois iront sur S3.

**Requêtes pratiques**

```sql
-- Tous les utilisateurs et leur rôle
SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC;

-- Les œuvres avec leur artiste, leur catégorie et leur image
SELECT a.title, a.tags[1] AS categorie, a.price, a.status, a.image_url, u.username AS artiste
FROM artworks a JOIN users u ON u.id = a.owner_id ORDER BY a.created_at DESC;

-- Les commandes avec acheteur et artiste
SELECT o.status, a.title, b.username AS acheteur, s.username AS artiste, o.amount, o.paid_at
FROM orders o JOIN artworks a ON a.id = o.artwork_id
JOIN users b ON b.id = o.buyer_id JOIN users s ON s.id = o.seller_id ORDER BY o.created_at DESC;

-- Les paiements (jamais le numéro de carte complet)
SELECT provider, status, amount, currency, card_brand, card_last4, paid_at FROM payments ORDER BY created_at DESC;

-- Les messages
SELECT s.username AS de, r.username AS a, left(m.body, 60) AS message, m.read_at IS NOT NULL AS lu
FROM messages m JOIN users s ON s.id = m.sender_id JOIN users r ON r.id = m.recipient_id ORDER BY m.created_at DESC;

-- Passer un compte en administrateur
UPDATE users SET role = 'admin' WHERE email = 'vous@exemple.com';
```

## Données de test

`npm run seed` crée 12 artistes, 8 acheteurs et 200 œuvres réparties à parts égales entre les quatre catégories, avec des demandes d'achat à tous les stades (en attente, acceptées, refusées, annulées), des ventes payées pour alimenter les statistiques et des conversations. Le backend doit être démarré.

| Option | Effet |
|---|---|
| `--count 300` | Nombre d'œuvres à créer |
| `--reset` | Repart de zéro : supprime œuvres, commandes, paiements, messages et comptes `@gallery.test` (les administrateurs sont conservés). Nécessite Docker. |
| `--seed 42` | Graine aléatoire, pour des résultats reproductibles |
| `--paid-ratio 0.1` | Part des œuvres vendues |
| `--open-ratio 0.1` | Part des œuvres avec une demande en cours |
| `--dry-run` | Affiche des exemples sans rien envoyer |
| `--api <url>` | URL de l'API (défaut : `http://127.0.0.1:3001/api`) |

Comptes : `artiste01@gallery.test` à `artiste12@gallery.test`, `acheteur01@gallery.test` à `acheteur08@gallery.test`, mot de passe `Password123!`.

Les 72 images viennent de `frontend/public/artworks/<catégorie>/`. Elles sont générées par `scripts/generate_artworks.py` (prérequis : `pip install numpy scipy pillow opencv-python`). Pour utiliser vos propres images, déposez-les dans ces dossiers et relancez le seed avec `--reset`.

## Déploiement

1. **Frontend** : `npm run build --prefix frontend` produit `frontend/out/`, à déposer dans le bucket S3 derrière CloudFront. `NEXT_PUBLIC_API_URL` doit pointer vers l'URL publique de l'API avant le build.
2. **Backend** : `npm run build --prefix backend`, puis `npm run start:prod --prefix backend` sur les instances EC2 de l'Auto Scaling Group. Le health check de l'ALB cible `GET /api/health`.
3. **Base de données** : Amazon RDS PostgreSQL, `DB_SSL=true`, accessible uniquement depuis les sous-réseaux applicatifs.
4. **Configuration** : `NODE_ENV=production` (désactive `synchronize`), `JWT_SECRET`, `ADMIN_PASSWORD`, mot de passe RDS et clé Stripe dans AWS Secrets Manager, `FRONTEND_URL` réglé sur le domaine CloudFront, `PUBLIC_API_URL` sur le domaine de l'API.
5. **Images** : remplacer le stockage disque par S3 (URL présignées) avant de passer à plusieurs instances.

Tous les services doivent rester compatibles avec les restrictions d'AWS Academy Learner Lab (rôle IAM imposé, budget limité). Pensez à détruire l'infrastructure (`terraform destroy`) après chaque session pour maîtriser le coût.

## Workflow Git

- `main` est la branche stable : pas de push direct, modifications par pull request avec au moins une review.
- Chaque membre travaille sur sa branche personnelle `prenom-nom-Branch` (par exemple `ons-ajmi-Branch`), créée depuis `main` et mise à jour régulièrement avec `git pull origin main`.
- Les commits suivent la convention [Conventional Commits](https://www.conventionalcommits.org/fr/) : `type(scope): description`, à l'impératif et en anglais.
- Une pull request regroupe des commits atomiques. Elle est fusionnée avec **Create a merge commit** ou **Rebase and merge**, jamais en squash, afin de conserver l'historique par commit.

| Type | Usage |
|---|---|
| `feat` | Nouvelle fonctionnalité |
| `fix` | Correction de bug |
| `docs` | Documentation uniquement |
| `refactor` | Réécriture sans changement de comportement |
| `test` | Ajout ou correction de tests |
| `chore` | Outillage, configuration, dépendances |
| `infra` | Terraform, scripts AWS |

Ne committez jamais de fichier `.env`, de `node_modules`, d'état Terraform (`*.tfstate`) ni le contenu de `backend/uploads/` : le `.gitignore` les exclut.

## Feuille de route

- [x] Authentification JWT et trois rôles (administrateur, artiste, acheteur)
- [x] CRUD des œuvres, envoi d'images, filtres et droits de propriété
- [x] Demande d'achat validée par l'artiste, puis paiement (passerelle de démonstration et Stripe en mode test)
- [x] Messagerie entre utilisateurs
- [x] Administration : statistiques, utilisateurs, œuvres, commandes, catégories
- [x] Profil et changement de mot de passe
- [x] Interface responsive avec carrousels par catégorie, seed de données
- [ ] Modules Terraform (réseau, calcul, RDS, S3, CloudFront)
- [ ] Scripts boto3 (snapshot et restauration RDS, test de résilience, rapport de coûts)
- [ ] Migrations TypeORM
- [ ] Stockage des images sur S3 par URL présignées
- [ ] Notifications par e-mail et réinitialisation du mot de passe par e-mail
- [ ] Webhooks Stripe, passage en mode réel
- [ ] Tests automatisés et intégration continue (GitHub Actions)
- [ ] Pagination de l'API
- [ ] Messagerie en temps réel (Socket.io)

