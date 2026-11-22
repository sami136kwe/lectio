# Sources et licences de Lectio

Tout ce que Lectio affiche comme texte biblique, citation d'un Père ou usage liturgique vient d'un fichier listé ici, téléchargé à un commit figé et vérifié par son empreinte SHA-256 (`lib/bible/versions.ts`, `scripts/import-sources.ts`). Date des imports de référence : **21 novembre 2026**.

## 1. Texte biblique (`npm run import:bible`)

| Code | Texte | Langue | Tradition textuelle | Fichier source | Licence |
|---|---|---|---|---|---|
| `LSG1910` | Louis Segond 1910 | fr | hébraïque (Psaumes numérotés comme le texte massorétique, titres comptés comme versets) | eBible.org `fraLSG`, via [BibleNLP/ebible](https://github.com/BibleNLP/ebible) `corpus/fra-fraLSG.txt` @ `2bde52b` | Domaine public (page de copyright eBible : « Cette Bible est dans le domaine public ») |
| `WEB` | World English Bible | en | hébraïque (titres des psaumes non numérotés) | eBible.org `engwebp` @ `2bde52b` | Domaine public ; « World English Bible » est une marque d'eBible.org : le texte n'est jamais modifié |
| `KJV` | King James Version, Cambridge Paragraph Bible | en | hébraïque | eBible.org `engkjvcpb` @ `2bde52b` | Domaine public (hors Royaume-Uni, où la KJV relève d'une prérogative royale) |
| `DRC` | Douay-Rheims, révision Challoner | en | Vulgate (numérotation grecque des psaumes) | [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases) `formats/csv/DRC.csv` @ `59b18c5` | Domaine public |
| `BRENTON_LXX` | Septante anglaise de Brenton (1851), Psaumes | en | Septante | [ctatum20/brenton-septuagint-data](https://github.com/ctatum20/brenton-septuagint-data) `_complete_brenton.json` @ `01fd3f6` | Texte du domaine public (1851). Le dépôt n'a pas de fichier de licence : l'import vérifie que les versets se retrouvent mot pour mot dans la copie sous licence d'eBible.org (`eng_Brenton`) ; 68,7 % sont confirmés (la copie eBible perd le dernier verset de nombreux psaumes), seuil d'import 65 %. |
| `GIGUET_LXX` | La Septante, traduction Pierre Giguet (1872), Psaumes | fr | Septante | scrollmapper `formats/csv/FreLXXGiguet.csv` @ `59b18c5` | Domaine public |
| `BYZANTINE_GREEK` | Nouveau Testament grec, édition patriarcale de 1904 (texte byzantin) | grc | byzantine | eBible.org `grcbyz` @ `2bde52b` | Domaine public |

Contrôles à chaque import : empreinte du fichier, encodage (aucun caractère de remplacement ni séquence UTF-8 mal décodée), doublons, couverture complète des 7 957 versets du Nouveau Testament (seules les variantes textuelles documentées peuvent manquer, par exemple Ac 8, 37 ou Rm 16, 25-27 placés ailleurs dans les textes byzantins), présence des 150 psaumes, versets connus, alignement de la numérotation chapitre par chapitre. Un chapitre dont la division des versets diffère (9 psaumes et 12 chapitres du NT dans la Douay-Rheims, 30 psaumes chez Giguet, le Ps 115 grec chez Brenton) est marqué « non aligné » : l'application n'y fait jamais correspondre les numéros de versets et affiche une autre version, avec une mention.

Nettoyage déterministe, et rien d'autre : normalisation Unicode NFC, espaces insécables remplacées par des espaces, espaces multiples réduites. Chez Brenton, le pied de page HTML collé au dernier verset de chaque psaume (« Psalms < 1 > *1:1 Gr. … Public Domain ») est coupé.

**Écarts avec le cahier des charges**

- Le grec byzantin importé est l'**édition patriarcale de 1904** (texte officiel du Patriarcat œcuménique, domaine public, licence explicite sur eBible.org) et non le texte de Robinson-Pierpont. Les deux sont des textes byzantins ; celui-ci a une licence vérifiée dans le même corpus que les autres versions.
- Aucune traduction **française** libre de droits de la Vulgate n'était disponible : pour la lecture catholique des Psaumes, l'application montre la Douay-Rheims anglaise avec une mention. Pour la lecture orthodoxe en français, la Septante de Giguet est utilisée quand sa numérotation est alignée, sinon Brenton (anglais) avec une mention.
- Darby et Ostervald n'ont pas été ajoutés (Darby français existe chez scrollmapper, non importé pour garder une seule traduction française de référence).

## 2. Sources patristiques (`npm run import:sources`)

- Extraits : [HistoricalChristianFaith/Commentaries-Database](https://github.com/HistoricalChristianFaith/Commentaries-Database) @ `a88dc03`, dédicace au domaine public de la compilation.
- Textes complets servant de preuve : [HistoricalChristianFaith/Writings-Database](https://github.com/HistoricalChristianFaith/Writings-Database) @ `922f4b3`, « All works in this repo are in the public domain ».

Ce dépôt contient aussi des extraits de traductions modernes sous droits (au titre du fair use) et des traductions automatiques du Migne. Trois filtres successifs :

1. **Liste blanche d'œuvres** traduites au XIXe siècle (`PD_WORKS` dans `lib/sources/patristic.ts`) : Ante-Nicene et Nicene and Post-Nicene Fathers de Schaff (Jean Chrysostome, Augustin *Harmony of the Gospels*, Léon le Grand, Irénée, Hilaire, Basile *Sur le Saint-Esprit*, Athanase, Cyprien, Ignace, Polycarpe, Justin, Clément d'Alexandrie, Origène *Commentaire sur Jean*, Victorin de Pettau *Commentaire sur l'Apocalypse*), la *Catena Aurea* de Thomas d'Aquin dans l'édition de Newman (1841-1845), Cyrille d'Alexandrie sur Jean (Library of the Fathers, 1874-1885) et sur Luc (Payne Smith, 1859).
2. **Preuve mot pour mot** : chaque paragraphe de l'extrait doit se retrouver dans le texte complet du domaine public de l'œuvre citée. Cela écarte les extraits de traductions modernes rangés sous la même adresse (8 406 extraits rejetés).
3. Toute page d'œuvre qui mentionne une traduction automatique (ChatGPT, etc.) est refusée.

Résultat : **10 734 extraits vérifiés** de 55 auteurs, en anglais, rattachés aux versets du Nouveau Testament qu'ils commentent. Les auteurs comme Bède, Jérôme ou Théophylacte n'apparaissent que par la *Catena Aurea* (traduction de 1841-1845) ; leurs commentaires en traduction moderne sont exclus. Les extraits sur les Psaumes ne sont pas importés : la numérotation des psaumes de ces fichiers n'est pas documentée.

Points connus à surveiller : la *Catena Aurea* contient quelques citations aujourd'hui reconnues comme apocryphes (par exemple le « Cyrille » sur Mt 16, 18, tiré d'un faux utilisé par Thomas d'Aquin). La relecture humaine doit les écarter ; les cartes d'exemple ne les utilisent pas.

**Documents de l'Église catholique** (Catéchisme, conciles) : aucune source vérifiable par script n'a pu être importée ici ; ils ne sont donc jamais nommés dans les cartes pour l'instant (le contrôle d'attribution les rejette).

**Lexiques** : aucun lexique libre n'a encore été importé ; le bloc « Mots du texte » reste vide.

## 3. Liturgie

| Rite | Données | Fichier | Licence | Calendrier |
|---|---|---|---|---|
| Romain | Lectionnaire des dimanches et solennités, cycle A | [LiturgicalCalendarAPI](https://github.com/Liturgical-Calendar/LiturgicalCalendarAPI) `jsondata/sourcedata/rite/roman/lectionary/dominicale_et_festivum_A/en.json` @ `0eb0504` | Apache-2.0 (références de lectures) | grégorien |
| Byzantin | Épître, Évangile et Évangile des Matines de chaque jour, Archidiocèse grec orthodoxe d'Amérique, 2026-2027 | [orthocal-python](https://github.com/brianglass/orthocal-python) `data/goarch_readings_2018_2027.json` @ `63f5aa7` | MIT | julien révisé (fêtes fixes), Pâques julienne |

Chaque description est produite à partir des données (clé de la célébration ou date de la lecture) : rien n'est écrit à la main passage par passage. Les cycles **B et C** du lectionnaire romain sont vides dans le dépôt source (dans toutes les langues) : ils ne sont pas importés, et donc absents de l'application. Aucune donnée vérifiable n'a été trouvée pour la Liturgie des Heures, les kathismes, les prokimena ou les tons : ces blocs n'existent pas encore.

## 4. Calendrier

Pâques grégorienne : algorithme de Meeus/Jones/Butcher. Pâques orthodoxe : algorithme julien de Meeus, puis conversion en date grégorienne par le jour julien. Testés sur des dates publiées de 2000 à 2027 et sur les cas limites (1818, 2285, réforme de 1582) : `tests/unit/calendar.test.ts`.

## 5. Ce qui n'est jamais utilisé

Bible de Jérusalem, TOB, Segond 21, traduction liturgique AELF, Bible Crampon, Nestle-Aland, notes de l'Orthodox Study Bible, textes du Catéchisme et des documents récents du Magistère, traductions modernes des Pères.
