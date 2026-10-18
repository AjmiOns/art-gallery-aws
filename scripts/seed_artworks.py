#!/usr/bin/env python3
"""
Remplit la galerie d'œuvres de test, réparties à parts égales entre les 4 catégories,
en utilisant les images de frontend/public/artworks/<categorie>/ (aucune dépendance à installer).

Usage (backend lancé) :
    python scripts/seed_artworks.py                 # ajoute 200 œuvres
    python scripts/seed_artworks.py --reset         # vide d'abord les œuvres et commandes existantes
    python scripts/seed_artworks.py --count 120 --seed 42
    python scripts/seed_artworks.py --dry-run

Pour utiliser vos propres images, déposez-les (.jpg/.png/.webp) dans les dossiers
frontend/public/artworks/painting, wall-art, digital et sketch, puis relancez avec --reset.

Comptes créés : artiste01@gallery.test ... artiste12@gallery.test (mot de passe : Password123!)
"""
import argparse
import json
import os
import random
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES_DIR = os.path.join(ROOT, "frontend", "public", "artworks")

ARTISTS = [
    "Lina Marzouki", "Karim Belhadj", "Sarra Gharbi", "Yassine Mejri",
    "Amel Triki", "Mehdi Chaabane", "Nour Ben Salah", "Rami Jlassi",
    "Ines Dridi", "Walid Haddad", "Mariem Zouari", "Oussama Kefi",
]

# tag API, dossier d'images, fourchette de prix, vocabulaire des titres
CATEGORIES = [
    {
        "tag": "painting", "folder": "painting", "price": (80, 900),
        "nouns": ["Lumière", "Horizon", "Marée", "Silence", "Mirage", "Fragment", "Écho", "Dune",
                  "Brume", "Rivage", "Orage", "Aurore", "Reflet", "Tempête", "Souvenir", "Passage"],
        "adjs": ["d'automne", "d'été", "d'hiver", "du matin", "du soir", "sur la mer", "en mouvement",
                 "rouge", "orange", "rose", "ocre", "sans fin", "en équilibre", "à contre-jour"],
    },
    {
        "tag": "wall art", "folder": "wall-art", "price": (30, 250),
        "nouns": ["Arche", "Soleil", "Vague", "Colline", "Oasis", "Mosaïque", "Jardin", "Croissant",
                  "Rivière", "Sable", "Équilibre", "Cabane", "Palmier", "Lagune"],
        "adjs": ["douce", "dorée", "terracotta", "sauge", "du désert", "minimaliste", "bohème",
                 "pastel", "méditerranéenne", "solaire", "paisible"],
    },
    {
        "tag": "digital", "folder": "digital", "price": (10, 160),
        "nouns": ["Néon", "Pulsation", "Aurore", "Signal", "Onde", "Spectre", "Hologramme", "Cosmos",
                  "Flux", "Prisme", "Orbite", "Synthèse", "Nébuleuse"],
        "adjs": ["électrique", "violet", "numérique", "fluide", "cosmique", "rétro", "quantique",
                 "irisé", "nocturne", "infini", "synthétique"],
    },
    {
        "tag": "sketch", "folder": "sketch", "price": (20, 200),
        "nouns": ["Étude", "Croquis", "Esquisse", "Feuillage", "Nature morte", "Branche", "Vase",
                  "Paysage", "Contour", "Ombre", "Herbier"],
        "adjs": ["au graphite", "à la mine", "du matin", "de studio", "en noir et blanc", "délicat",
                 "d'atelier", "sur papier", "à main levée"],
    },
]
EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def list_images(folder):
    path = os.path.join(IMAGES_DIR, folder)
    if not os.path.isdir(path):
        sys.exit(f"Dossier d'images introuvable : {path}")
    files = sorted(f for f in os.listdir(path) if f.lower().endswith(EXTENSIONS))
    if not files:
        sys.exit(f"Aucune image dans {path}")
    return [f"/artworks/{folder}/{f}" for f in files]


def call(api, method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(api + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.status, json.loads(res.read() or b"null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"null")
        except ValueError:
            return e.code, None
    except urllib.error.URLError as e:
        sys.exit(f"API injoignable ({api}) : {e.reason}\nLe backend est-il lancé ? (npm run dev)")


def get_session(api, email, username, password):
    status, data = call(api, "POST", "/auth/register", {"email": email, "username": username, "password": password})
    if status == 409:  # compte déjà créé lors d'un lancement précédent
        status, data = call(api, "POST", "/auth/login", {"email": email, "password": password})
    if status not in (200, 201):
        sys.exit(f"Connexion impossible pour {email} : {status} {data}")
    return data["accessToken"], data["user"]["id"]


def reset_database():
    """Vide les tables orders et artworks (les comptes sont conservés) via le conteneur Docker."""
    user = os.environ.get("DB_USER", "gallery")
    name = os.environ.get("DB_NAME", "art_gallery")
    cmd = ["docker", "compose", "exec", "-T", "db", "psql", "-U", user, "-d", name,
           "-c", "TRUNCATE TABLE orders, artworks;"]
    try:
        out = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=60)
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        sys.exit(f"--reset impossible (Docker indisponible) : {e}")
    if out.returncode != 0:
        sys.exit(f"--reset a échoué :\n{out.stderr.strip()}\n"
                 "Vérifiez que le conteneur art-gallery-db tourne (docker compose up -d).")
    print("Œuvres et commandes existantes supprimées.")


def make_title(cat, used):
    for _ in range(30):
        title = f"{random.choice(cat['nouns'])} {random.choice(cat['adjs'])}"
        if random.random() < 0.25:
            title += f" No. {random.randint(1, 30)}"
        if title not in used:
            used.add(title)
            return title
    return f"{title} {len(used)}"


def make_artwork(cat, images, used):
    tags = [cat["tag"]]
    if cat["tag"] in ("painting", "sketch") and random.random() < 0.15:
        tags.append("wall art")  # la catégorie principale reste toujours le premier tag
    lo, hi = cat["price"]
    price = round(random.choice([random.uniform(lo, (lo + hi) / 3), random.uniform(lo, (lo + hi) / 2), random.uniform(lo, hi)]), 2)
    return {"title": make_title(cat, used), "imageUrl": random.choice(images), "tags": tags, "price": price}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default="http://127.0.0.1:3001/api")
    p.add_argument("--count", type=int, default=200)
    p.add_argument("--password", default="Password123!")
    p.add_argument("--buy-ratio", type=float, default=0.08, help="part des œuvres achetées (0 pour désactiver)")
    p.add_argument("--seed", type=int, default=None, help="graine aléatoire (résultats reproductibles)")
    p.add_argument("--reset", action="store_true", help="vide d'abord les œuvres et commandes existantes")
    p.add_argument("--dry-run", action="store_true", help="affiche quelques œuvres sans rien envoyer")
    args = p.parse_args()
    random.seed(args.seed)

    images = {c["tag"]: list_images(c["folder"]) for c in CATEGORIES}
    used = set()

    if args.dry_run:
        for i in range(8):
            cat = CATEGORIES[i % 4]
            print(make_artwork(cat, images[cat["tag"]], used))
        return

    if args.reset:
        reset_database()

    users = []
    for n, name in enumerate(ARTISTS, start=1):
        token, uid = get_session(args.api, f"artiste{n:02d}@gallery.test", name, args.password)
        users.append({"token": token, "id": uid})
    print(f"{len(users)} comptes prêts.")

    created = []
    for i in range(args.count):
        cat = CATEGORIES[i % len(CATEGORIES)]  # répartition égale entre catégories
        owner = random.choice(users)
        status, data = call(args.api, "POST", "/artworks", make_artwork(cat, images[cat["tag"]], used), owner["token"])
        if status not in (200, 201):
            sys.exit(f"Échec à l'œuvre {i + 1} : {status} {data}")
        created.append((data["id"], owner["id"]))
        if (i + 1) % 25 == 0:
            print(f"{i + 1}/{args.count} œuvres créées")

    bought = 0
    for artwork_id, owner_id in random.sample(created, int(len(created) * args.buy_ratio)):
        buyer = random.choice([u for u in users if u["id"] != owner_id])
        status, _ = call(args.api, "POST", "/orders", {"artworkId": artwork_id}, buyer["token"])
        bought += status in (200, 201)
    print(f"Terminé : {len(created)} œuvres, dont {bought} vendues.")


if __name__ == "__main__":
    main()
