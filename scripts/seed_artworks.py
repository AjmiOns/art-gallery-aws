#!/usr/bin/env python3
"""
Remplit la galerie de données de test réalistes (aucune dépendance à installer) :
artistes, acheteurs, œuvres par catégorie, demandes d'achat à tous les stades,
paiements réussis (pour les statistiques) et conversations.

Usage (backend lancé) :
    python scripts/seed_artworks.py                 # ajoute 200 œuvres et des commandes
    python scripts/seed_artworks.py --reset         # repart de zéro (comptes de démo, œuvres, commandes, messages)
    python scripts/seed_artworks.py --count 120 --seed 42
    python scripts/seed_artworks.py --dry-run

Comptes créés (mot de passe de démo : Password123!) :
    artistes  : artiste01@gallery.test ... artiste12@gallery.test
    acheteurs : acheteur01@gallery.test ... acheteur08@gallery.test
    admin     : admin@gallery.test / Admin1234! (créé par le backend, voir ADMIN_EMAIL dans backend/.env)

Pour utiliser vos propres images, déposez-les dans frontend/public/artworks/<categorie>/ puis relancez avec --reset.
"""
import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES_DIR = os.path.join(ROOT, "frontend", "public", "artworks")

ARTISTS = [
    "Lina Marzouki", "Karim Belhadj", "Sarra Gharbi", "Yassine Mejri", "Amel Triki", "Mehdi Chaabane",
    "Nour Ben Salah", "Rami Jlassi", "Ines Dridi", "Walid Haddad", "Mariem Zouari", "Oussama Kefi",
]
BUYERS = [
    "Salma Ferchichi", "Anis Bouzid", "Rim Trabelsi", "Hatem Sassi", "Yosra Ayari", "Fares Lahmar",
    "Dorra Hamdi", "Slim Chebbi",
]

# slug de catégorie = nom du dossier d'images, fourchette de prix, vocabulaire des titres
CATEGORIES = [
    {"slug": "painting", "price": (80, 900),
     "nouns": ["Lumière", "Horizon", "Marée", "Silence", "Mirage", "Fragment", "Écho", "Dune", "Brume", "Rivage", "Orage", "Aurore", "Reflet", "Tempête", "Souvenir", "Passage"],
     "adjs": ["d'automne", "d'été", "d'hiver", "du matin", "du soir", "sur la mer", "en mouvement", "rouge", "orange", "rose", "ocre", "sans fin", "en équilibre", "à contre-jour"]},
    {"slug": "wall-art", "price": (30, 250),
     "nouns": ["Arche", "Soleil", "Vague", "Colline", "Oasis", "Mosaïque", "Jardin", "Croissant", "Rivière", "Sable", "Équilibre", "Cabane", "Palmier", "Lagune"],
     "adjs": ["douce", "dorée", "terracotta", "sauge", "du désert", "minimaliste", "bohème", "pastel", "méditerranéenne", "solaire", "paisible"]},
    {"slug": "digital", "price": (10, 160),
     "nouns": ["Néon", "Pulsation", "Aurore", "Signal", "Onde", "Spectre", "Hologramme", "Cosmos", "Flux", "Prisme", "Orbite", "Synthèse", "Nébuleuse"],
     "adjs": ["électrique", "violet", "numérique", "fluide", "cosmique", "rétro", "quantique", "irisé", "nocturne", "infini", "synthétique"]},
    {"slug": "sketch", "price": (20, 200),
     "nouns": ["Étude", "Croquis", "Esquisse", "Feuillage", "Nature morte", "Branche", "Vase", "Paysage", "Contour", "Ombre", "Herbier"],
     "adjs": ["au graphite", "à la mine", "du matin", "de studio", "en noir et blanc", "délicat", "d'atelier", "sur papier", "à main levée"]},
]
EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
BUYER_QUESTIONS = [
    "Bonjour, cette œuvre est-elle encadrée ?", "Quelles sont les dimensions exactes ?", "Est-il possible de la voir en vrai avant l'achat ?",
    "Proposez-vous la livraison à Tunis ?", "Bonjour, je suis très intéressé(e). Le prix est-il négociable ?",
]
ARTIST_REPLIES = [
    "Bonjour, merci de votre intérêt ! Elle est livrée prête à accrocher.", "Les dimensions sont indiquées sur la fiche, je peux vous envoyer plus de photos.",
    "Bien sûr, nous pouvons organiser un rendez-vous à l'atelier.", "Oui, livraison possible dans toute la Tunisie.", "Le prix est ferme, mais je vous offre le cadre.",
]


def list_images(slug):
    path = os.path.join(IMAGES_DIR, slug)
    if not os.path.isdir(path):
        sys.exit(f"Dossier d'images introuvable : {path}")
    files = sorted(f for f in os.listdir(path) if f.lower().endswith(EXTENSIONS))
    if not files:
        sys.exit(f"Aucune image dans {path}")
    return [f"/artworks/{slug}/{f}" for f in files]


def call(api, method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(api + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, json.loads(res.read() or b"null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"null")
        except ValueError:
            return e.code, None
    except urllib.error.URLError as e:
        sys.exit(f"API injoignable ({api}) : {e.reason}\nLe backend est-il lancé ? (npm run dev)")


def get_session(api, email, username, password, role):
    status, data = call(api, "POST", "/auth/register", {"email": email, "username": username, "password": password, "role": role})
    if status == 409:  # compte déjà créé lors d'un lancement précédent
        status, data = call(api, "POST", "/auth/login", {"email": email, "password": password})
    if status not in (200, 201):
        sys.exit(f"Connexion impossible pour {email} : {status} {data}")
    return {"token": data["accessToken"], "id": data["user"]["id"], "role": data["user"]["role"], "name": username}


def run_sql(sql):
    """Exécute du SQL via le conteneur Docker (db), ou via psql si Docker est absent.
    Renvoie (réussi, message d'erreur)."""
    user, name = os.environ.get("DB_USER", "gallery"), os.environ.get("DB_NAME", "art_gallery")
    attempts = []
    if shutil.which("docker"):
        attempts.append((["docker", "compose", "exec", "-T", "db", "psql", "-U", user, "-d", name, "-c", sql], ROOT, None))
    if shutil.which("psql"):
        env = {**os.environ, "PGPASSWORD": os.environ.get("DB_PASSWORD", "gallery")}
        attempts.append((["psql", "-h", os.environ.get("DB_HOST", "localhost"), "-p", os.environ.get("DB_PORT", "5432"),
                          "-U", user, "-d", name, "-c", sql], None, env))
    last = "Ni Docker ni psql ne sont installés."
    for cmd, cwd, env in attempts:
        try:
            res = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True, timeout=60)
            if res.returncode == 0:
                return True, ""
            last = (res.stderr or res.stdout).strip() or f"code de sortie {res.returncode}"
        except (OSError, subprocess.TimeoutExpired) as e:
            last = str(e)
    return False, last


def reset_database():
    ok, err = run_sql("TRUNCATE TABLE payments, messages, orders, artworks RESTART IDENTITY CASCADE; "
                      "DELETE FROM users WHERE email LIKE '%@gallery.test' AND role <> 'admin';")
    if not ok:
        sys.exit(f"--reset a échoué :\n{err}\n\n"
                 "Vérifications : la base tourne (docker compose up -d) et le backend a démarré au moins une fois "
                 "(c'est lui qui crée les tables).")
    print("Données de démonstration supprimées (comptes administrateurs conservés).")


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
    lo, hi = cat["price"]
    price = round(random.choice([random.uniform(lo, (lo + hi) / 3), random.uniform(lo, (lo + hi) / 2), random.uniform(lo, hi)]), 2)
    tags = [cat["slug"]] + (["wall-art"] if cat["slug"] in ("painting", "sketch") and random.random() < 0.15 else [])
    return {"title": make_title(cat, used), "imageUrl": random.choice(images), "tags": tags, "price": price}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default="http://127.0.0.1:3001/api")
    p.add_argument("--count", type=int, default=200, help="nombre d'œuvres")
    p.add_argument("--password", default="Password123!")
    p.add_argument("--paid-ratio", type=float, default=0.08, help="part des œuvres vendues (payées)")
    p.add_argument("--open-ratio", type=float, default=0.06, help="part des œuvres avec une demande en attente ou acceptée")
    p.add_argument("--seed", type=int, default=None, help="graine aléatoire (résultats reproductibles)")
    p.add_argument("--reset", action="store_true", help="repart de zéro (nécessite Docker ou psql)")
    p.add_argument("--dry-run", action="store_true", help="affiche quelques œuvres sans rien envoyer")
    args = p.parse_args()
    random.seed(args.seed)

    images = {c["slug"]: list_images(c["slug"]) for c in CATEGORIES}
    used = set()
    if args.dry_run:
        for i in range(8):
            cat = CATEGORIES[i % 4]
            print(make_artwork(cat, images[cat["slug"]], used))
        return

    if args.reset:
        reset_database()

    artists = [get_session(args.api, f"artiste{n:02d}@gallery.test", name, args.password, "artist") for n, name in enumerate(ARTISTS, 1)]
    buyers = [get_session(args.api, f"acheteur{n:02d}@gallery.test", name, args.password, "buyer") for n, name in enumerate(BUYERS, 1)]
    by_id = {a["id"]: a for a in artists}
    print(f"{len(artists)} artistes et {len(buyers)} acheteurs prêts.")

    created = []
    for i in range(args.count):
        cat = CATEGORIES[i % len(CATEGORIES)]  # répartition égale entre catégories
        owner = random.choice(artists)
        status, data = call(args.api, "POST", "/artworks", make_artwork(cat, images[cat["slug"]], used), owner["token"])
        if status not in (200, 201):
            sys.exit(f"Échec à l'œuvre {i + 1} : {status} {data}")
        created.append({"id": data["id"], "owner": owner})
        if (i + 1) % 50 == 0:
            print(f"{i + 1}/{args.count} œuvres créées")

    random.shuffle(created)
    n_paid, n_open = int(len(created) * args.paid_ratio), int(len(created) * args.open_ratio)
    paid, opened, others = created[:n_paid], created[n_paid:n_paid + n_open], created[n_paid + n_open:n_paid + n_open + 6]

    # Ventes payées : demande → acceptation par l'artiste → paiement par carte (passerelle de démonstration)
    card = {"cardNumber": "4242 4242 4242 4242", "expiry": "12/34", "cvc": "123"}
    n_sold, mock_ok = 0, True
    for a in paid:
        buyer = random.choice(buyers)
        st, order = call(args.api, "POST", "/orders", {"artworkId": a["id"], "message": random.choice(BUYER_QUESTIONS)}, buyer["token"])
        if st != 201:
            continue
        call(args.api, "PATCH", f"/orders/{order['id']}/accept", token=a["owner"]["token"])
        st, ck = call(args.api, "POST", "/payments/checkout", {"orderId": order["id"]}, buyer["token"])
        if st != 201 or ck.get("provider") != "mock":
            mock_ok = False
            continue
        st, _ = call(args.api, "POST", "/payments/mock/confirm", {"paymentId": ck["paymentId"], "holder": buyer["name"].upper(), **card}, buyer["token"])
        n_sold += st == 201
    if not mock_ok:
        print("Paiement Stripe actif : les ventes de démonstration ne sont pas simulées (utilisez PAYMENT_PROVIDER=mock).")

    # Demandes en cours : moitié en attente de l'artiste, moitié acceptées (à payer)
    for k, a in enumerate(opened):
        buyer = random.choice(buyers)
        st, order = call(args.api, "POST", "/orders", {"artworkId": a["id"], "message": random.choice(BUYER_QUESTIONS)}, buyer["token"])
        if st == 201 and k % 2 == 1:
            call(args.api, "PATCH", f"/orders/{order['id']}/accept", token=a["owner"]["token"])

    # Quelques demandes refusées ou annulées (historique)
    for k, a in enumerate(others):
        buyer = random.choice(buyers)
        st, order = call(args.api, "POST", "/orders", {"artworkId": a["id"]}, buyer["token"])
        if st == 201:
            call(args.api, "PATCH", f"/orders/{order['id']}/{'reject' if k % 2 == 0 else 'cancel'}", token=(a["owner"] if k % 2 == 0 else buyer)["token"])

    # Conversations acheteur ↔ artiste, avec réponses
    n_msg = 0
    for a in random.sample(created, min(14, len(created))):
        buyer = random.choice(buyers)
        st, _ = call(args.api, "POST", "/messages", {"recipientId": a["owner"]["id"], "artworkId": a["id"], "body": random.choice(BUYER_QUESTIONS)}, buyer["token"])
        if st == 201:
            n_msg += 1
            if random.random() < 0.7:
                call(args.api, "POST", "/messages", {"recipientId": buyer["id"], "body": random.choice(ARTIST_REPLIES)}, a["owner"]["token"])

    # Dates réparties sur les derniers jours : des courbes de ventes et des « nouveautés » plus réalistes
    ok, _ = run_sql("UPDATE artworks SET created_at = now() - (random() * interval '40 days'); "
               "UPDATE payments SET paid_at = now() - (random() * interval '29 days') WHERE status = 'succeeded'; "
               "UPDATE orders o SET paid_at = p.paid_at FROM payments p WHERE p.order_id = o.id AND p.status = 'succeeded'; "
               "UPDATE orders SET created_at = paid_at - interval '2 days' WHERE paid_at IS NOT NULL;")
    if ok:
        print("Dates réparties sur les 30 derniers jours.")
    print(f"Terminé : {len(created)} œuvres, {n_sold} vendues, {n_open} demandes en cours, {n_msg} conversations.")


if __name__ == "__main__":
    main()