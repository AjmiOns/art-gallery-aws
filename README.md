# Galerie d'art en ligne (art-gallery-aws)

Plateforme web pour publier, rechercher et acheter des œuvres d'art, déployée sur une infrastructure AWS 3 tiers haute disponibilité.

## Stack

| Couche | Technologie |
|---|---|
| Frontend | Next.js (App Router, export statique) + TypeScript |
| Backend | NestJS + TypeORM + JWT |
| Base de données | PostgreSQL (Docker en local, Amazon RDS en production) |
| Infrastructure | Terraform + scripts boto3 (AWS Academy Learner Lab) |

## Structure

```
art-gallery-aws/
├── frontend/        # Next.js
├── backend/         # NestJS + PostgreSQL
├── infra/           # Terraform (modules: network, compute, rds, s3)
├── scripts/         # boto3 (snapshot/restore, test de résilience, coûts)
├── docs/            # schéma d'architecture, livrables
└── README.md
```

## Lancer en local

Prérequis : Node.js 20+, Docker.

```bash
# 1. Base de données
docker compose up -d

# 2. Backend (http://localhost:3001/api)
cd backend
cp .env.example .env        # puis changer JWT_SECRET
npm install
npm run start:dev

# 3. Frontend (http://localhost:3000)
cd ../frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Les tables sont créées automatiquement en développement (`synchronize`).

## API

| Méthode | Route | Accès |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | public |
| GET | `/api/auth/me` | connecté |
| GET | `/api/artworks?tag=painting&maxPrice=50&q=lune` | public |
| GET | `/api/artworks/:id` | public |
| POST | `/api/artworks` | connecté |
| PATCH / DELETE | `/api/artworks/:id` | propriétaire uniquement |
| POST | `/api/orders` (`{ "artworkId": "..." }`) | connecté (achat direct) |
| GET | `/api/orders/me` | connecté |
| GET | `/api/health` | public (health check de l'ALB) |

Il n'y a pas de route `logout` : le JWT est sans état, le client supprime son token.

## Déploiement (cible AWS)

- **Frontend** : `npm run build` produit `frontend/out/` (export statique), à déposer dans S3 derrière CloudFront.
- **Backend** : `npm run build` puis `npm run start:prod` sur les instances EC2 de l'Auto Scaling Group, derrière l'ALB (health check : `/api/health`).
- **Secrets** (`JWT_SECRET`, mot de passe RDS) : AWS Secrets Manager, jamais dans Git. En production, `NODE_ENV=production` désactive `synchronize`.

## Problèmes connus / à faire

- Notifications (e-mail acheteur/vendeur) : non implémentées, `TODO` dans `orders.service.ts`. Service à choisir selon les limites du Learner Lab.
- Pas encore de migrations TypeORM (nécessaires avant la production).
- L'image d'une œuvre est un simple lien ; l'upload vers S3 (URL présignées) reste à faire.
- Pas de tests automatisés.
- Enchères en temps réel : reportées à une version ultérieure.
