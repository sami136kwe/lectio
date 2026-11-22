# Logion : documentation complète

Logion est une application de microlecture biblique : un passage du Nouveau Testament ou des Psaumes, une explication simple, la lecture catholique et la lecture orthodoxe, l'usage liturgique vérifié, et une piste à méditer. Elle reprend le socle technique de Stash et remplace tout ce qui touche au contenu.

## Sommaire

1. L'idée et les règles de fond
2. Architecture
3. Les données
4. Le texte biblique
5. Les sources et la liturgie
6. Fabriquer les cartes : le pipeline
7. L'application
8. Relecture humaine
9. Tests
10. Mettre en ligne
11. Écarts avec le cahier des charges, limites et risques

---

## 1. L'idée et les règles de fond

Une personne curieuse ou croyante lit un court passage, comprend ce qu'il dit, voit comment chaque Église le lit, repère où il est proclamé, et repart avec une piste à vivre. Cinq règles structurent tout le projet :

| Règle | Comment elle est tenue |
|---|---|
| Le texte biblique ne vient jamais de la mémoire d'un modèle | Il est importé par script depuis des fichiers figés (commit + SHA-256), lu en base à l'affichage. Le modèle reçoit le texte exact et n'écrit que le commentaire. Toute citation de 4 mots ou plus entre guillemets doit se retrouver dans le texte fourni, sinon la carte est rejetée. Chaque carte garde l'empreinte du texte lu au moment de l'écriture ; `check:db` la recalcule. |
| Aucune citation de Père ou de document inventée | Un nom de Père, de concile ou de document dans une lecture doit correspondre à une source **vérifiée** liée à cette lecture (`perspective_sources`). Les citations font moins de 25 mots et sont retrouvées mot pour mot dans la source ; aucune suite de 8 mots copiés hors citation. |
| Fidélité à chaque tradition, sans polémique | Règles dans le prompt, vocabulaire polémique filtré, étiquette de divergence cohérente (lectures de longueur équivalente à 30 % près quand elles divergent), second appel du modèle pour noter la fidélité théologique (publication à 8/10), relecture humaine. |
| Aucune invention liturgique | Le bloc liturgique de chaque carte vient uniquement des données importées, avec leur source. Les lectures n'ont pas le droit de mentionner un dimanche, une fête ou un office. |
| Relecture humaine | Chaque lecture est publiée « non encore relue » et le dit ; file de relecture, export et réimport CSV. |

## 2. Architecture

```
Navigateur ── Next.js (App Router, React 19, Tailwind) ── Supabase (Postgres + RLS + pgvector, Auth, Edge Function « embed »)
                    │
Scripts (tsx) ──────┤  import:bible · import:sources · seed:demo · seed:cards · check:db · export:cards
                    │
                    └─ API Claude (Message Batches, sorties structurées) : génération uniquement, jamais dans l'app
```

| Dossier | Contenu |
|---|---|
| `lib/bible/` | Livres, numérotation des Psaumes, parseurs, validation, références, chargement des passages |
| `lib/sources/` | Sources patristiques : liste blanche, lecteur TOML, preuve mot pour mot |
| `lib/liturgy/` | Calendrier (Pâques, conversion julien/grégorien, temps liturgiques), citations de lectionnaire |
| `lib/content/` | Contrôles de contenu (style, attributions, citations, divergence) |
| `lib/pipeline/` | Découpage en passages, prompts, schémas, modèle (batches), évaluation, exécution |
| `lib/admin/` | File de relecture, CSV |
| `components/LogionCard.tsx` | La carte |
| `supabase/migrations/` | Schéma, RLS, fonctions |
| `supabase/seed/` | Thèmes, traditions, temps liturgiques, cartes d'exemple |

Réutilisé de Stash sans changement de fond : authentification, profil, fil et mélange des thèmes, stash et notes, révision SM-2, défi du jour, série, historique et relecture, export et suppression du compte, mode sombre, audio Edge TTS / Kokoro, i18n.

## 3. Les données

Migrations : `20261201000001_schema.sql`, `…002_rls_and_functions.sql`, `…003_sources_region.sql`.

| Table | Rôle |
|---|---|
| `bible_versions` | Une version : code, langue, tradition textuelle, numérotation (`mt`, `eng`, `lxx`), licence, URL et SHA-256 du fichier |
| `bible_verses` | Un verset par ligne, dans la numérotation propre à la version ; index plein texte |
| `bible_chapter_stats` | Versets trouvés / attendus par chapitre et version ; `aligned = false` interdit la correspondance verset par verset |
| `psalm_numbering` | Correspondance hébreu → grec au niveau du verset (9-10, 114-115, 116, 147) |
| `passages` | Plage de versets dans la numérotation de référence (hébraïque, titres comptés), double numéro des psaumes |
| `cards` | Passage, thème, difficulté, statut, scores, empreinte du texte biblique |
| `card_translations` | Explication et piste « à vivre », par langue |
| `card_perspectives` | Lecture par langue et par tradition (la tradition est une donnée : table `traditions`), divergence, statut de relecture |
| `sources`, `perspective_sources` | Sources vérifiées et liens lecture → source (citation, paraphrase, référence) |
| `liturgical_uses`, `liturgical_seasons`, `card_seasons` | Usages liturgiques vérifiés et temps liturgiques |
| `daily_deck`, `daily_deck_state` | Paquet du jour et position |
| `reading_progress` | Lecture dans l'ordre : dernière carte lue par livre |
| `verse_memory` | « Apprendre ce verset » : SM-2 et niveau de masquage |
| `profiles` | Champs de Stash + `tradition_view`, `bible_version_fr/en`, `show_greek`, `reviewed_only` |

**RLS** : lecture publique des cartes publiées, des lectures non rejetées, des sources et usages liturgiques **vérifiés** ; écriture réservée au rôle service ; données personnelles visibles par leur seul propriétaire. Les tests `tests/integration/database.test.ts` le vérifient.

## 4. Le texte biblique

`npm run import:bible` télécharge chaque fichier depuis un commit figé, vérifie son SHA-256, le lit, puis contrôle : encodage, doublons, couverture complète des 7 957 versets du NT (seules les variantes textuelles listées dans `lib/bible/versions.ts` peuvent manquer), présence des 150 psaumes, versets connus, alignement chapitre par chapitre. Rien n'est écrit si un seul contrôle échoue. Détail des versions et licences : [SOURCES.md](SOURCES.md).

**Numérotation des Psaumes.** La référence est la numérotation hébraïque avec les titres comptés comme versets (LSG). `lib/bible/psalms.ts` convertit vers :
- `eng` (WEB, KJV) : même psaume, verset moins le nombre de versets de titre (0, 1 ou 2 ; 2 pour les Ps 51, 52, 54, 60). La table est prouvée par l'import : LSG − WEB = titres, pour les 150 psaumes.
- `lxx` (Brenton, Giguet, Douay-Rheims) : numérotation grecque. Testée sur tous les versets des 150 psaumes (aller-retour).

Un chapitre dont la division des versets diffère dans une version (`aligned = false`) n'est jamais converti : l'application prend la version suivante et l'indique.

## 5. Les sources et la liturgie

**Pères de l'Église.** 10 734 extraits, en anglais, des traductions du XIXe siècle (Schaff, Newman, Pusey, Payne Smith). Chaque extrait n'est marqué `verified` que si (1) son œuvre est sur la liste blanche du domaine public, (2) chaque paragraphe se retrouve mot pour mot dans le texte complet de l'œuvre, (3) cette œuvre n'est pas une traduction automatique. Les extraits sont rattachés aux versets commentés (`bible_refs`) et à une région (Orient grec et syriaque, Occident latin) : la lecture orthodoxe reçoit d'abord des Pères orientaux.

**Liturgie.** Lectionnaire romain des dimanches et solennités (cycle A) et lectures quotidiennes de l'Archidiocèse grec orthodoxe d'Amérique pour 2026-2027. Les descriptions sont produites à partir des données ; le jour de Pascha est nommé, aucune autre position dans le cycle pascal n'est déduite.

**Calendrier.** Meeus/Jones/Butcher (grégorien), Meeus julien converti par le jour julien (orthodoxe), temps liturgiques romain et byzantin (`lib/liturgy/calendar.ts`).

## 6. Fabriquer les cartes : le pipeline

```
découpage déterministe ─▶ contexte (textes exacts + sources vérifiées) ─▶ lot d'écriture (Batch API)
  ─▶ contrôles par règles ─▶ déduplication (embeddings) ─▶ lot de fidélité théologique ─▶ enregistrement
```

1. **Découpage** (`lib/pipeline/segment.ts`) : 3 à 8 versets, coupure en fin de phrase, strophes des psaumes à « Pause », titres rattachés à la première strophe. Couverture vérifiée (aucun verset sauté ni dupliqué). 2 551 passages pour le NT et les Psaumes.
2. **Contexte** : texte LSG, WEB, et pour les psaumes Douay-Rheims, Brenton, Giguet ; jusqu'à 4 sources orientales et 4 occidentales qui commentent ces versets.
3. **Écriture** : `claude-sonnet-5-5` par défaut (`LOGION_WRITER_MODEL`), via Message Batches (moitié prix), sortie JSON validée par Zod, les deux langues dans le même appel. Prompt : `lib/pipeline/prompt.ts` (règles, structure, un bon et un mauvais exemple).
4. **Contrôles** (`lib/pipeline/evaluate.ts`, `lib/content/checks.ts`) : style, vocabulaire polémique, longueurs, étiquette de divergence et équilibre à 30 %, attributions, citations exactes et courtes, 8 mots copiés au plus, aucune citation biblique hors du texte fourni, thème valide, sources connues.
5. **Déduplication** : similarité d'embedding inférieure à 0,90 avec les explications et les lectures existantes (par langue et tradition).
6. **Fidélité théologique** : second lot ; notes catholique, orthodoxe et globale, caricature, faits douteux. Publication si la plus basse des notes est d'au moins 8 et qu'aucun fait douteux n'est signalé ; sinon brouillon pour la relecture.
7. **Enregistrement** : cartes, traductions, lectures (`unreviewed`), liens vers les sources, temps liturgiques ; chaque exécution est tracée dans `ingestion_runs` (coût, appels, erreurs).

**Coût.** Estimation affichée avant tout lancement, confirmation demandée, plafond `MAX_BUDGET_USD` vérifié avant chaque lot. Estimations actuelles : premier lot ≈ 1 $, tout le corpus ≈ 83 $ (Sonnet 5.5, prix batch).

**Premier lot d'abord.** `npm run seed:cards` sans option ne traite que Marc 1-2, Psaumes 1-5, Jean 1, 1-18 et Matthieu 16, 13-20, puis affiche 15 cartes au hasard avec leurs sources.

## 7. L'application

| Page | Contenu |
|---|---|
| `/feed` | Fil (thèmes + 20 % de découvertes, relectures optionnelles), bouton FR/EN par carte |
| `/deck`, `/deck/history` | Paquet du jour (50 ou illimité, illimité par défaut), avant/arrière, position gardée ; jours précédents |
| `/books`, `/books/[code]`, `/books/[code]/read` | Livres par groupe et progression ; page livre (résumé, chapitres, cartes dans l'ordre) ; lecture dans l'ordre avec reprise |
| `/cards/[id]` | Une carte, audio à deux voix, garder, apprendre le verset |
| `/search` | Références FR/EN, double numérotation des psaumes, plein texte |
| `/psalm`, `/seasons`, `/compare` | Psaume du jour, temps liturgiques, divergences par sujet |
| `/learn` | Apprendre un verset (SM-2, 6 niveaux de masquage) |
| `/stash`, `/review`, `/challenge`, `/progress`, `/history`, `/reread` | Repris de Stash |
| `/profile` | Lecture affichée, traductions, grec, lectures relues seulement, taille du paquet, thèmes, données |
| `/about` | Avertissement, méthode, sources |
| `/admin` | Relecture théologique, échantillon, brouillons, exécutions, export/import |

**La carte** (`components/LogionCard.tsx`) : référence et double numéro des psaumes, versets numérotés, version affichée (et mention si une autre a été prise), grec optionnel, explication, sélecteur Catholique / Orthodoxe / Les deux / Neutre (côte à côte sur grand écran, l'une sous l'autre sur téléphone), lectures avec mention « non encore relue » et références, texte de la Vulgate ou de la Septante sous chaque lecture pour les psaumes, étiquette de divergence, liturgie, piste à vivre.

**Audio** : la carte est découpée en segments ; le texte biblique et le commentaire ne sont jamais dans le même segment et sont lus par deux voix du même moteur.

## 8. Relecture humaine

- Chaque lecture a un `review_status` (`unreviewed`, `reviewed`, `corrected`, `rejected`). Une lecture rejetée n'est plus visible.
- `/admin` : file filtrable par tradition, livre, divergence et statut, avec le texte des sources à côté ; boutons « Relue, correcte », « Enregistrer la correction », « Rejeter ».
- Export CSV de la file (formules de tableur neutralisées) et réimport : un texte modifié devient `corrected`.
- Échantillon de 20 cartes de la dernière exécution, avec leurs sources.
- Réglage « N'afficher que les lectures relues ».

## 9. Tests

| Suite | Commande | Contenu |
|---|---|---|
| Unitaires (166) | `npm test` | Références, numérotation des psaumes (table entière), parseurs et validation, Pâques et conversion de calendrier, citations de lectionnaire, sources (liste blanche, preuve mot pour mot), découpage, contrôles de contenu sur les 17 cartes d'exemple, règles d'attribution, équilibre, CSV, paquet du jour, masquage, coûts, audio |
| Base de données (33) | `npm run test:db` | RLS, comptes de versets par livre, versets connus, table des titres prouvée par les données, correspondance et repli des psaumes, cartes d'exemple (texte inchangé, aucune citation de mémoire, citations exactes), fil, historique, relecture, dédoublonnage, pipeline complet avec des modèles factices |
| Bout en bout (24) | `npm run test:e2e` | Mobile et ordinateur : inscription, fil, garder, révision, défi ; lecture catholique/orthodoxe/les deux/neutre ; recherche par référence ; lecture dans l'ordre ; paquet du jour avant/arrière, 50 ou illimité ; FR/EN sans perte de position ; apprendre un verset ; audio ; historique et relecture |

Les tests de base de données et de bout en bout supposent `npm run setup`. En environnement isolé, Playwright peut utiliser un Chromium déjà installé : `PLAYWRIGHT_CHROMIUM_PATH=/chemin/vers/chromium npm run test:e2e`.

## 10. Mettre en ligne

> Non testé de bout en bout pendant le développement.

1. **Supabase** (formule gratuite) : `npx supabase link --project-ref VOTRE_REF`, `npx supabase db push`, `npx supabase functions deploy embed --no-verify-jwt`, `npx supabase secrets set EMBEDDING_FUNCTION_SECRET=…`. Authentification : URL du site et `https://VOTRE-APP.vercel.app/auth/callback`.
2. **Contenu**, depuis votre ordinateur, avec les variables de production dans `.env.local` : `npm run seed:categories`, `npm run import:bible`, `npm run import:sources -- --embed`, `npm run seed:demo`, puis `npm run seed:cards` (premier lot), relecture, et `npm run seed:cards -- --all`.
3. **Vercel** (Hobby) : importer le dépôt, variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `ADMIN_EMAILS` (et `KOKORO_URL` si besoin). La clé Anthropic n'est **pas** nécessaire sur Vercel : la génération tourne en script.

Volume : environ 55 000 versets, 10 700 sources et quelques milliers de cartes tiennent dans la base gratuite de Supabase (500 Mo).

## 11. Écarts avec le cahier des charges, limites et risques

- **Grec byzantin** : édition patriarcale de 1904 (domaine public, licence explicite) au lieu de Robinson-Pierpont.
- **Pas de traduction française libre de la Vulgate** : la lecture catholique des psaumes montre la Douay-Rheims anglaise, avec une mention. La Septante française (Giguet) n'est utilisée que pour les psaumes où sa numérotation est alignée.
- **Liturgie** : cycle A seulement pour le lectionnaire romain (B et C sont vides dans la source) ; lectures byzantines de 2026-2027 de l'archidiocèse grec d'Amérique ; pas encore de Liturgie des Heures, de kathismes, de prokimena ni de tons, faute de source vérifiable.
- **Documents catholiques** (Catéchisme, conciles) : aucune source vérifiable par script n'est importée ; ils ne sont pas nommés.
- **Lexiques** : aucun lexique libre importé ; le panneau « Mots du texte » reste vide.
- **Sources patristiques des Psaumes** : non importées (numérotation non documentée dans la source) ; les lectures des psaumes sont écrites sans nom d'auteur.
- **Catena Aurea** : quelques citations y sont aujourd'hui reconnues comme apocryphes ; la relecture humaine doit y veiller.
- **Le corpus de cartes n'est pas encore généré** : seules les 17 cartes d'exemple existent tant que `seed:cards` n'a pas tourné. `check:db` signale la couverture manquante.
- **Embeddings** : la fonction `embed` télécharge le modèle gte-small au premier appel ; dans un environnement sans accès à huggingface.co, utiliser `--skip-dedup` (déduplication par plage seulement).
- **Risque théologique** : un modèle peut se tromper. Les contrôles automatiques réduisent ce risque, la relecture humaine reste nécessaire, et l'application l'affiche.
