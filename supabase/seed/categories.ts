/**
 * Reference data for Lectio: the 8 theme categories and their subcategories,
 * the traditions, and the liturgical seasons.
 *
 * Applied by `npm run seed:categories` and by `npm run setup`. Upserts by slug
 * (or code), so it is safe to run again.
 */

export type SubcategorySeed = { slug: string; name_fr: string; name_en: string };

export type CategorySeed = {
  slug: string;
  name_fr: string;
  name_en: string;
  icon: string;
  description: string;
  description_en: string;
  subcategories: SubcategorySeed[];
};

const sub = (slug: string, name_fr: string, name_en: string): SubcategorySeed => ({ slug, name_fr, name_en });

export const CATEGORY_SEED: CategorySeed[] = [
  {
    slug: "jesus",
    name_fr: "Jésus : vie et enseignement",
    name_en: "Jesus: life and teaching",
    icon: "✝",
    description: "Ce que Jésus a fait et dit, de sa naissance à sa résurrection.",
    description_en: "What Jesus did and said, from his birth to his resurrection.",
    subcategories: [
      sub("naissance-enfance", "Naissance et enfance", "Birth and childhood"),
      sub("bapteme-tentations", "Baptême et tentations", "Baptism and temptations"),
      sub("paraboles", "Paraboles", "Parables"),
      sub("miracles", "Miracles", "Miracles"),
      sub("sermon-sur-la-montagne", "Sermon sur la montagne", "Sermon on the Mount"),
      sub("discours-adieu", "Discours d'adieu", "Farewell discourse"),
      sub("passion", "Passion", "Passion"),
      sub("resurrection-du-christ", "Résurrection", "Resurrection"),
    ],
  },
  {
    slug: "priere",
    name_fr: "Prière et vie spirituelle",
    name_en: "Prayer and spiritual life",
    icon: "🕯",
    description: "Prier, louer, demander pardon, faire confiance.",
    description_en: "Praying, praising, asking forgiveness, trusting.",
    subcategories: [
      sub("priere-du-seigneur", "Prière du Seigneur", "The Lord's Prayer"),
      sub("louange-action-de-grace", "Louange et action de grâce", "Praise and thanksgiving"),
      sub("supplication-lamentation", "Supplication et lamentation", "Supplication and lament"),
      sub("repentir-pardon", "Repentir et pardon", "Repentance and forgiveness"),
      sub("silence-confiance", "Silence et confiance", "Silence and trust"),
      sub("combat-spirituel", "Combat spirituel", "Spiritual struggle"),
    ],
  },
  {
    slug: "foi-esperance-charite",
    name_fr: "Foi, espérance, charité",
    name_en: "Faith, hope, love",
    icon: "♡",
    description: "Croire, espérer, aimer au quotidien.",
    description_en: "Believing, hoping and loving day to day.",
    subcategories: [
      sub("foi-doute", "Foi et doute", "Faith and doubt"),
      sub("esperance", "Espérance", "Hope"),
      sub("amour-du-prochain", "Amour du prochain", "Love of neighbour"),
      sub("humilite", "Humilité", "Humility"),
      sub("joie-paix", "Joie et paix", "Joy and peace"),
      sub("patience-epreuve", "Patience dans l'épreuve", "Patience in trials"),
    ],
  },
  {
    slug: "eglise-sacrements",
    name_fr: "L'Église et les sacrements",
    name_en: "The Church and the sacraments",
    icon: "⛪",
    description: "La communauté des croyants et ses signes : baptême, eucharistie, ministères.",
    description_en: "The community of believers and its signs: baptism, eucharist, ministries.",
    subcategories: [
      sub("bapteme", "Baptême", "Baptism"),
      sub("eucharistie", "Eucharistie et repas du Seigneur", "Eucharist and the Lord's Supper"),
      sub("ministeres-autorite", "Ministères et autorité", "Ministries and authority"),
      sub("unite-eglise", "Unité de l'Église", "Unity of the Church"),
      sub("communion-des-saints", "Communion des saints", "Communion of saints"),
      sub("mariage", "Mariage", "Marriage"),
      sub("onction-guerison", "Onction et guérison", "Anointing and healing"),
    ],
  },
  {
    slug: "vie-morale-justice",
    name_fr: "Vie morale et justice",
    name_en: "Moral life and justice",
    icon: "⚖",
    description: "Vivre selon l'Évangile : partage, vérité, pardon, service.",
    description_en: "Living by the Gospel: sharing, truth, forgiveness, service.",
    subcategories: [
      sub("beatitudes", "Béatitudes", "Beatitudes"),
      sub("richesse-pauvrete", "Richesse et pauvreté", "Wealth and poverty"),
      sub("pardon-reconciliation", "Pardon et réconciliation", "Forgiveness and reconciliation"),
      sub("verite-parole", "Vérité et parole", "Truth and speech"),
      sub("justice-misericorde", "Justice et miséricorde", "Justice and mercy"),
      sub("pouvoir-service", "Pouvoir et service", "Power and service"),
    ],
  },
  {
    slug: "marie-saints",
    name_fr: "Marie et les saints",
    name_en: "Mary and the saints",
    icon: "✦",
    description: "La Mère de Jésus, les apôtres et les témoins.",
    description_en: "The Mother of Jesus, the apostles and the witnesses.",
    subcategories: [
      sub("annonciation-visitation", "Annonciation et Visitation", "Annunciation and Visitation"),
      sub("magnificat", "Magnificat", "Magnificat"),
      sub("marie-vie-de-jesus", "Marie dans la vie de Jésus", "Mary in the life of Jesus"),
      sub("apotres", "Les apôtres", "The apostles"),
      sub("martyrs-temoins", "Martyrs et témoins", "Martyrs and witnesses"),
    ],
  },
  {
    slug: "mystere-de-dieu",
    name_fr: "Mystère de Dieu",
    name_en: "The mystery of God",
    icon: "☼",
    description: "Trinité, Incarnation, Croix, Résurrection, Esprit Saint, Royaume.",
    description_en: "Trinity, Incarnation, Cross, Resurrection, Holy Spirit, Kingdom.",
    subcategories: [
      sub("trinite", "Trinité", "Trinity"),
      sub("incarnation", "Incarnation", "Incarnation"),
      sub("croix-salut", "Croix et salut", "Cross and salvation"),
      sub("resurrection-vie-eternelle", "Résurrection et vie éternelle", "Resurrection and eternal life"),
      sub("esprit-saint", "Esprit Saint", "Holy Spirit"),
      sub("royaume-de-dieu", "Royaume de Dieu", "Kingdom of God"),
      sub("fin-des-temps", "Fin des temps", "End times"),
    ],
  },
  {
    slug: "psaumes-par-genre",
    name_fr: "Psaumes par genre",
    name_en: "Psalms by genre",
    icon: "♪",
    description: "Les psaumes rangés par grande famille : louange, supplication, sagesse…",
    description_en: "The psalms by family: praise, supplication, wisdom...",
    subcategories: [
      sub("psaumes-louange", "Louange", "Praise"),
      sub("psaumes-supplication", "Supplication", "Supplication"),
      sub("psaumes-action-de-grace", "Action de grâce", "Thanksgiving"),
      sub("psaumes-royaux-messianiques", "Royaux et messianiques", "Royal and messianic"),
      sub("psaumes-sagesse", "Psaumes de sagesse", "Wisdom psalms"),
      sub("psaumes-pelerinage", "Pèlerinage", "Pilgrimage"),
      sub("psaumes-penitentiels", "Pénitentiels", "Penitential"),
      sub("psaumes-historiques", "Historiques", "Historical"),
    ],
  },
];

export const TRADITION_SEED = [
  { code: "common", name_fr: "Lecture commune", name_en: "Shared reading", sort_order: 0 },
  { code: "catholic", name_fr: "Tradition catholique", name_en: "Catholic tradition", sort_order: 1 },
  { code: "orthodox", name_fr: "Tradition orthodoxe", name_en: "Orthodox tradition", sort_order: 2 },
];

export const SEASON_SEED = [
  {
    slug: "avent-nativite",
    name_fr: "Avent / Nativité",
    name_en: "Advent / Nativity",
    description_fr: "Catholiques : Avent et temps de Noël. Orthodoxes : jeûne de la Nativité et fête de la Nativité.",
    description_en: "Catholics: Advent and Christmas time. Orthodox: Nativity fast and the feast of the Nativity.",
  },
  {
    slug: "theophanie",
    name_fr: "Théophanie / Baptême du Seigneur",
    name_en: "Theophany / Baptism of the Lord",
    description_fr: "Catholiques : Épiphanie et Baptême du Seigneur. Orthodoxes : Théophanie (6 janvier).",
    description_en: "Catholics: Epiphany and the Baptism of the Lord. Orthodox: Theophany (6 January).",
  },
  {
    slug: "careme-triode",
    name_fr: "Carême et Triode",
    name_en: "Lent and Triodion",
    description_fr: "Catholiques : Carême. Orthodoxes : Triode et Grand Carême.",
    description_en: "Catholics: Lent. Orthodox: the Triodion and Great Lent.",
  },
  { slug: "semaine-sainte", name_fr: "Semaine sainte", name_en: "Holy Week", description_fr: null, description_en: null },
  {
    slug: "paques-pascha",
    name_fr: "Pâques / Pascha",
    name_en: "Easter / Pascha",
    description_fr: "La date diffère souvent : calendrier grégorien (catholiques) et pascalie julienne (orthodoxes).",
    description_en: "The date often differs: Gregorian calendar (Catholics) and Julian paschalion (Orthodox).",
  },
  { slug: "ascension", name_fr: "Ascension", name_en: "Ascension", description_fr: null, description_en: null },
  { slug: "pentecote", name_fr: "Pentecôte", name_en: "Pentecost", description_fr: null, description_en: null },
  {
    slug: "temps-ordinaire",
    name_fr: "Temps ordinaire",
    name_en: "Ordinary Time",
    description_fr: "Catholiques : temps ordinaire. Orthodoxes : dimanches après la Pentecôte.",
    description_en: "Catholics: Ordinary Time. Orthodox: Sundays after Pentecost.",
  },
];
