/**
 * Spot checks on well-known verses, run after every import and by the tests.
 * Each entry gives the start of the verse in that version's own numbering.
 */
export const KNOWN_VERSES: { version: string; ref: string; startsWith: string }[] = [
  { version: "LSG1910", ref: "JHN 3:16", startsWith: "Car Dieu a tant aimé le monde qu’il a donné son Fils unique" },
  { version: "LSG1910", ref: "MAT 6:9", startsWith: "Voici donc comment vous devez prier:Notre Père qui es aux cieux!" },
  { version: "LSG1910", ref: "PSA 23:1", startsWith: "Cantique de David. L’Éternel est mon berger" },
  { version: "LSG1910", ref: "PSA 51:3", startsWith: "O Dieu! Aie pitié de moi dans ta bonté" },
  { version: "LSG1910", ref: "PSA 22:17", startsWith: "Car des chiens m’environnent" },
  { version: "LSG1910", ref: "ROM 8:28", startsWith: "Nous savons, du reste, que toutes choses concourent au bien de ceux qui aiment Dieu" },
  { version: "WEB", ref: "JHN 3:16", startsWith: "For God so loved the world, that he gave his only born Son" },
  { version: "WEB", ref: "PSA 51:1", startsWith: "Have mercy on me, God, according to your loving kindness" },
  { version: "WEB", ref: "PSA 23:1", startsWith: "The LORD is my shepherd; I shall lack nothing." },
  { version: "KJV", ref: "JHN 1:1", startsWith: "In the beginning was the Word, and the Word was with God" },
  { version: "KJV", ref: "PSA 23:1", startsWith: "The Lord is my shepherd; I shall not want." },
  { version: "DRC", ref: "PSA 22:1", startsWith: "A psalm for David. The Lord ruleth me: and I shall want nothing." },
  { version: "DRC", ref: "PSA 50:3", startsWith: "Have mercy on me, O God, according to thy great mercy." },
  { version: "DRC", ref: "LUK 1:28", startsWith: "And the angel being come in, said unto her: Hail, full of grace" },
  { version: "BRENTON_LXX", ref: "PSA 22:1", startsWith: "A Psalm of David. The Lord tends me as a shepherd" },
  { version: "BRENTON_LXX", ref: "PSA 21:17", startsWith: "For many dogs have compassed me" },
  { version: "BRENTON_LXX", ref: "PSA 151:1", startsWith: "This Psalm is a genuine one of David" },
  { version: "GIGUET_LXX", ref: "PSA 22:1", startsWith: "Le Seigneur est mon pasteur" },
  { version: "BYZANTINE_GREEK", ref: "JHN 1:1", startsWith: "Ἐν ἀρχῇ ἦν ὁ Λόγος" },
  { version: "BYZANTINE_GREEK", ref: "MAT 6:9", startsWith: "Οὕτως οὖν προσεύχεσθε ὑμεῖς· Πάτερ ἡμῶν ὁ ἐν τοῖς οὐρανοῖς" },
];
