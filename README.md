# Lectio

**Un passage, deux traditions, quelques minutes par jour.**

Lectio est une application web de lecture biblique en petites cartes. Chaque carte porte sur un court passage du **Nouveau Testament** ou des **Psaumes** et contient, dans cet ordre :

1. la référence et le **texte biblique exact** (Louis Segond 1910 en français, World English Bible, King James ou Douay-Rheims en anglais), importé tel quel depuis des traductions du domaine public ;
2. une **explication simple** du texte ;
3. la **lecture catholique** et la **lecture orthodoxe**, côte à côte, avec leurs sources ;
4. l'étiquette « Les deux traditions s'accordent » ou « Point de divergence » ;
5. l'**usage liturgique** vérifié (lectionnaire romain, lectures byzantines) ;
6. une piste **à vivre ou à méditer**.

Pour les Psaumes, les deux numérotations sont affichées (« Psaume 23 (22 dans la Septante) ») et le texte rattaché à chaque tradition (Vulgate, Septante) est disponible sous chaque lecture.

> Lectio est un outil de lecture et d'étude, pas un enseignement officiel d'une Église. Pour toute question de foi, référez-vous à l'autorité de votre Église.

📘 Documentation complète : [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md) · Sources et licences : [docs/SOURCES.md](docs/SOURCES.md)

Lectio reprend l'architecture de **Stash** (Next.js, Supabase, répétition espacée, audio, historique, i18n) et en remplace le contenu.

---

## Ce que vous pouvez faire

- Lire un **fil** de passages adapté à vos thèmes, ou le **paquet du jour** (50 cartes ou illimité) à parcourir en avant et en arrière, avec les **jours précédents**.
- Choisir la lecture affichée : **Catholique**, **Orthodoxe**, **Les deux** ou **Neutre**, sur chaque carte et dans les réglages.
- Lire un livre **dans l'ordre** (« Lire dans l'ordre »), avec reprise là où vous vous êtes arrêté.
- Chercher par **référence** : « Jn 3,16 », « Jean 3:16 », « Rm 8, 28-30 », « Ps 22 », « Psaume 21 (LXX) ». Entrée ouvre la carte. Recherche plein texte dans les versets, les explications et les lectures.
- Voir le **psaume du jour**, les passages d'un **temps liturgique** (avec les dates de Pâques grégorienne et orthodoxe), et la page **« Où les traditions divergent »**.
- Garder des passages, les **réviser** (SM-2), **apprendre un verset** par masquage progressif, relever le **défi du jour**, suivre sa **série**.
- **Écouter** une carte : le texte biblique et le commentaire sont lus par deux voix différentes.
- Passer toute l'interface en **anglais** (bouton FR/EN de l'en-tête) ou une seule carte (bouton sur la carte), sans perdre sa place.
- Afficher le **texte grec** byzantin (réglage).
- Exporter ses données, supprimer son compte, mode sombre.

Page **admin** : file de relecture théologique (filtres par tradition, livre, divergence), échantillon de 20 cartes avec les sources, brouillons, export et réimport CSV.

---

## Lancer le projet

Il faut **Node.js 20.9+**, **Docker Desktop** (ouvert) et **Git**.

```bash
git clone <adresse de votre dépôt> lectio
```

```bash
cd lectio
```

```bash
npm install
```

```bash
npm run setup
```

`setup` démarre Supabase en local, écrit `.env.local`, charge les thèmes, **importe le texte biblique** (7 versions vérifiées), **importe les sources vérifiées et la liturgie** (la première fois : deux téléchargements d'environ 450 Mo) et charge **17 cartes d'exemple** écrites à la main. Ensuite :

```bash
npm run dev
```

Ouvrez http://localhost:3000.

---

## Commandes

| Commande | Rôle |
|---|---|
| `npm run import:bible` | Import déterministe du texte biblique (`--dry-run`, `--version=WEB`) |
| `npm run import:sources` | Pères de l'Église (traductions du domaine public, vérifiés mot pour mot) et liturgie (`--only=patristic`, `--only=liturgy`, `--embed`) |
| `npm run seed:demo` | Les 17 cartes d'exemple |
| `npm run seed:content` | Les cartes rédigées dans `content/cards/*.json` (gratuit, hors ligne, mêmes contrôles que le pipeline ; `--book=MRK`) |
| `npm run seed:cards` | **Premier lot** de cartes générées (Marc 1-2, Psaumes 1-5, Jean 1, 1-18, Matthieu 16, 13-20), avec estimation du coût et confirmation |
| `npm run seed:cards -- --all` | Tout le Nouveau Testament et les Psaumes (2 551 passages) |
| `npm run seed:cards -- --dry-run` | Planifie et estime le coût, sans appel au modèle |
| `npm run check:db` | Couverture, complétude, attributions, citations, scores, relectures, texte biblique inchangé |
| `npm run export:cards` | Export JSON et CSV (`--review` : file de relecture en CSV) |
| `npm run review:import -- fichier.csv` | Réimport des corrections de relecture |
| `npm test` / `npm run test:db` / `npm run test:e2e` | Tests unitaires / base de données / bout en bout |

Options de `seed:cards` : `--book=JHN`, `--category=priere`, `--lang=en`, `--resume`, `--extend`, `--yes`, `--skip-dedup`, `--limit=N`. Plafond de dépense : `MAX_BUDGET_USD` (10 $ par défaut).

**Avant `--all`**, lancez le premier lot et relisez l'échantillon de 15 cartes affiché à la fin (et la page admin) : l'exactitude doctrinale compte plus que la vitesse.
