# Galerie d'art en ligne

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-test%20mode-635BFF?logo=stripe&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-planned-7B42BC?logo=terraform&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-Learner%20Lab-FF9900?logo=amazonaws&logoColor=white)

Plateforme web où les artistes publient leurs œuvres (peintures, décoration murale, art numérique, croquis) et où les acheteurs les découvrent, contactent l'artiste et les achètent avec un vrai parcours de paiement. L'application est conçue pour être déployée sur une infrastructure AWS 3 tiers haute disponibilité.

<img src="docs/screenshots/home.jpg" alt="Page d'accueil de la galerie" width="100%">

> **Ce README donne la vue d'ensemble.** Le détail de chaque partie se trouve dans le README de son dossier :
>
> | Partie | Contenu | Documentation |
> |---|---|---|
> | Frontend | Interface Next.js, pages par rôle, export statique | [`frontend/README.md`](frontend/README.md) |
> | Backend | API NestJS, modèle de données, paiement, seed | [`backend/README.md`](backend/README.md) |
> | Infrastructure | Terraform, réseau, sécurité, AWS Learner Lab | [`infra/README.md`](infra/README.md) |

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Aperçu](#aperçu)
- [Rôles et permissions](#rôles-et-permissions)
- [Stack technique](#stack-technique)
- [Architecture cible](#architecture-cible)
- [Structure du dépôt](#structure-du-dépôt)
- [Démarrage rapide](#démarrage-rapide)
- [Scripts](#scripts)
- [Workflow Git](#workflow-git)
- [Feuille de route](#feuille-de-route)

## Fonctionnalités

**Pour tous les visiteurs**
- Catalogue classé par catégorie, avec carrousels, œuvre à la une, recherche, filtre de prix et tri.
- Fiche détaillée de chaque œuvre dans une fenêtre accessible au clavier.

**Acheteur**
- Demande d'achat avec message à l'artiste, suivi de ses demandes.
- Paiement en ligne par carte et reçu imprimable.
- Messagerie pour contacter les artistes.

**Artiste**
- Publication, modification et suppression de ses œuvres, avec envoi d'image.
- Gestion des demandes d'achat : accepter, refuser ou annuler une réservation.
- Contact direct des acheteurs et tableau de bord (œuvres, demandes, ventes, revenus).

**Administrateur**
- Statistiques, gestion des utilisateurs, des œuvres, des commandes et des catégories.
- Contact de n'importe quel utilisateur.

**Tous les comptes** : profil modifiable et changement de mot de passe.

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

Les règles de la messagerie sont détaillées dans le [README du backend](backend/README.md#messagerie).

## Stack technique

| Couche | Technologie | Détail |
|---|---|---|
| Frontend | Next.js 15 (App Router, export statique), React 19, TypeScript, CSS natif | [frontend/](frontend/README.md) |
| Backend | NestJS 10, TypeORM, Passport JWT, class-validator, Multer, Stripe SDK | [backend/](backend/README.md) |
| Base de données | PostgreSQL 16 (Docker en local, Amazon RDS en production) | [backend/](backend/README.md#modèle-de-données) |
| Infrastructure | Terraform, scripts boto3, AWS Academy Learner Lab | [infra/](infra/README.md) |
| Outillage | npm, concurrently, Docker Compose, Adminer, Python 3 (seed) | |

## Architecture cible

Le frontend est exporté en fichiers statiques servis par S3 et CloudFront. L'API tourne sur des instances EC2 privées derrière un Application Load Balancer, sur deux zones de disponibilité. La base est une instance RDS PostgreSQL Multi-AZ, isolée dans des sous-réseaux privés.

Le schéma, le réseau et l'état d'avancement du Terraform sont décrits dans [`infra/README.md`](infra/README.md).

> **État d'avancement** : l'application (frontend, API, base, paiement) est fonctionnelle en local. L'infrastructure AWS est en cours de construction (réseau, sécurité, bastion et premier backend de test déjà déployables avec Terraform).

## Structure du dépôt

```
art-gallery-aws/
├── frontend/        # Next.js            → frontend/README.md
├── backend/         # NestJS + seed DB   → backend/README.md
├── infra/           # Terraform (AWS)    → infra/README.md
├── scripts/         # seed de données, générateur d'images, scripts boto3
├── docs/            # schéma d'architecture, livrables, captures d'écran
├── docker-compose.yml            # PostgreSQL
├── docker-compose.override.yml   # Adminer (visualisation de la base)
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

Ouvrez le site via `localhost` : une autre adresse est refusée par la politique CORS du backend.

**Comptes de démonstration** (créés par le seed, mot de passe `Password123!`) : `artiste01@gallery.test`, `acheteur01@gallery.test`. L'administrateur est `admin@gallery.test` avec le mot de passe `ADMIN_PASSWORD` de votre `backend/.env` (`Admin1234!` par défaut).

> **Windows PowerShell 5** : l'opérateur `&&` n'est pas reconnu. Utilisez `;` ou lancez les commandes une par une. Remplacez `cp` par `Copy-Item` si besoin.

Pour la configuration détaillée, voir [frontend](frontend/README.md#configuration) et [backend](backend/README.md#configuration). Pour mettre à jour une installation existante, voir [backend](backend/README.md#mise-à-jour-dune-installation-existante).

## Scripts

| Commande (racine) | Action |
|---|---|
| `npm run install:all` | Installe les dépendances de la racine, du backend et du frontend |
| `npm start` | Démarre PostgreSQL et Adminer (Docker), puis le backend et le frontend |
| `npm run dev` | Démarre uniquement le backend et le frontend |
| `npm run db` | Démarre uniquement PostgreSQL et Adminer |
| `npm run seed` | Injecte des données de test (options : [backend](backend/README.md#données-de-test)) |

Par application : `npm run build` produit le backend (`backend/dist`) ou l'export statique du frontend (`frontend/out`).

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

Vue globale. Le détail de chaque partie est dans son README.

**Application** (voir [backend](backend/README.md#feuille-de-route) et [frontend](frontend/README.md#feuille-de-route))
- [x] Authentification JWT, trois rôles, CRUD des œuvres, commandes, paiement, messagerie, administration
- [x] Interface responsive, seed de données
- [ ] Migrations TypeORM, pagination, tests automatisés, CI
- [ ] Notifications par e-mail, webhooks Stripe, messagerie temps réel

**Infrastructure** (voir [infra](infra/README.md#roadmap-future-work))
- [x] VPC, sous-réseaux multi-AZ, groupes de sécurité, NAT, bastion, premier backend, script de destruction
- [ ] ALB, Auto Scaling Group, RDS Multi-AZ, S3 + CloudFront
- [ ] Scripts boto3, CloudWatch, test de charge