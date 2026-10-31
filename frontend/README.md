# Frontend : interface de la galerie d'art

![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

Interface web de la [galerie d'art en ligne](../README.md). Elle consomme l'API du [backend](../backend/README.md) et est exportée en fichiers statiques pour être servie par S3 et CloudFront (voir [`infra/`](../infra/README.md)).

<img src="../docs/screenshots/home.jpg" alt="Page d'accueil de la galerie" width="100%">

## Sommaire

- [Stack](#stack)
- [Démarrage](#démarrage)
- [Configuration](#configuration)
- [Structure](#structure)
- [Pages par rôle](#pages-par-rôle)
- [Images des œuvres](#images-des-œuvres)
- [Aperçu](#aperçu)
- [Build et déploiement](#build-et-déploiement)
- [Feuille de route](#feuille-de-route)

## Stack

| Élément | Technologie |
|---|---|
| Framework | Next.js 15, App Router, **export statique** |
| UI | React 19, TypeScript |
| Style | CSS natif (pas de framework CSS) |
| Données | Appels HTTP à l'API NestJS via un client API dédié |

L'export statique signifie qu'il n'y a pas de serveur Next.js en production : toutes les données viennent de l'API, appelée depuis le navigateur.

## Démarrage

Prérequis : Node.js 20+ et le [backend](../backend/README.md) démarré.

```bash
# depuis la racine du dépôt
cp frontend/.env.local.example frontend/.env.local
npm run install:all
npm run dev          # backend + frontend
```

Le site est disponible sur <http://localhost:3000>. **Ouvrez-le via `localhost`** : le backend refuse les autres origines (CORS).

Pour lancer uniquement le frontend : `npm run dev --prefix frontend`.

## Configuration

| Variable | Fichier | Rôle |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `frontend/.env.local` | URL de l'API (en local : `http://localhost:3001/api`) |

Comme l'export est statique, cette valeur est **intégrée au moment du build**. En production, elle doit pointer vers l'URL publique de l'API avant `npm run build`.

## Structure

```
frontend/
├── app/ (ou src/app/)   # pages et layouts, organisés par rôle
├── components/          # composants réutilisables (carrousels, fiche d'œuvre, formulaires…)
├── lib/ (client API)    # fonctions d'appel à l'API et gestion du jeton
├── public/
│   └── artworks/        # bibliothèque d'images par catégorie
├── .env.local.example
└── package.json
```

> Les noms exacts des dossiers (`app/` ou `src/app/`, `lib/` ou `services/`) sont à ajuster selon le code actuel.

## Pages par rôle

| Espace | Contenu |
|---|---|
| **Public** | Catalogue par catégorie avec carrousels, œuvre à la une, recherche, filtre de prix, tri. Fiche d'une œuvre dans une fenêtre accessible au clavier. Inscription (choix du rôle) et connexion. |
| **Acheteur** | Demande d'achat avec message, suivi des demandes (en attente, à payer, historique), paiement par carte, reçu imprimable. |
| **Artiste** | Publication, modification et suppression d'œuvres avec envoi d'image, gestion des demandes d'achat (accepter, refuser, annuler), tableau de bord (œuvres, demandes, ventes, revenus). |
| **Administrateur** | Statistiques (chiffre d'affaires, ventes sur 30 jours, répartition des commandes, catégories, meilleurs artistes), gestion des utilisateurs, œuvres, commandes et catégories. |
| **Tous les comptes** | Messagerie, profil modifiable (nom, téléphone, ville, présentation), changement de mot de passe. |

L'interface est responsive (voir la capture mobile ci-dessous). Les droits sont appliqués par l'API : masquer un bouton côté interface ne remplace jamais le contrôle côté backend.

## Images des œuvres

Les images de la bibliothèque intégrée sont dans `public/artworks/<catégorie>/` et servies par le frontend (`/artworks/painting/painting-01.jpg`). Les 72 images sont générées par `scripts/generate_artworks.py`. Les images envoyées par les artistes sont servies par le backend (`/uploads/<uuid>.jpg`) et seront sur S3 en production.

Pour utiliser vos propres images, déposez-les dans ces dossiers et relancez le seed avec `--reset` (voir [backend](../backend/README.md#données-de-test)).

## Aperçu

| Fiche d'une œuvre | Paiement par carte |
|---|---|
| <img src="../docs/screenshots/detail.jpg" alt="Fiche d'une œuvre et demande d'achat"> | <img src="../docs/screenshots/checkout.jpg" alt="Page de paiement"> |

| Espace artiste | Administration |
|---|---|
| <img src="../docs/screenshots/artist.jpg" alt="Demandes d'achat de l'artiste"> | <img src="../docs/screenshots/admin.jpg" alt="Statistiques de l'administrateur"> |

| Messagerie | Mobile |
|---|---|
| <img src="../docs/screenshots/messages.jpg" alt="Messagerie"> | <img src="../docs/screenshots/mobile.jpg" alt="Version mobile" width="260"> |

## Build et déploiement

```bash
npm run build --prefix frontend      # produit frontend/out/
```

1. Définir `NEXT_PUBLIC_API_URL` sur l'URL publique de l'API.
2. Lancer le build : le résultat est dans `frontend/out/`.
3. Déposer le contenu de `out/` dans le bucket S3 derrière CloudFront.
4. Côté backend, régler `FRONTEND_URL` sur le domaine CloudFront (CORS).

Le bucket S3 et CloudFront ne sont pas encore créés : voir la feuille de route de [`infra/`](../infra/README.md#roadmap-future-work).

## Feuille de route

- [x] Catalogue, recherche, filtres, carrousels par catégorie
- [x] Espaces acheteur, artiste et administrateur
- [x] Paiement par carte, messagerie, profil
- [x] Interface responsive
- [x] Messagerie en temps réel (Socket.io)
- [ ] Pagination du catalogue (dépend de la pagination de l'API)
- [ ] Tests automatisés et intégration continue
- [ ] Déploiement sur S3 et CloudFront