/**
 * Hand-written demonstration cards (source_type "manual"), used by
 * `npm run seed:demo` and by the tests. 17 cards: 4 psalms and 4 known
 * points of divergence (Marian dogmas, primacy of Peter, Filioque, theosis).
 *
 * Rules followed here, as for generated cards:
 * - the Bible text is never written here: it is read from the database;
 * - a Father is named only when a verified source of the database is linked
 *   (see `sources`), and quotes are copied word for word from that source;
 * - liturgical uses and liturgical seasons are not written here either: they
 *   come from the imported lectionaries.
 * Every reading is published with review_status "unreviewed".
 */

export type DemoSource = {
  tradition: "catholic" | "orthodox";
  author: string;
  /** Start of the work title in the sources table. */
  work: string;
  section: string;
  /** Verse key the source comments on. */
  ref: string;
  usage: "quote" | "paraphrase" | "reference";
  /** Exact words of the source (under 25 words), for usage "quote". */
  quote?: string;
};

type Bi = { fr: string; en: string };

export type DemoCard = {
  key: string;
  book: string;
  chapterStart: number;
  verseStart: number;
  chapterEnd: number;
  verseEnd: number;
  category: string;
  difficulty: 1 | 2 | 3;
  explanation: Bi;
  action: Bi;
  catholic: Bi;
  orthodox: Bi;
  divergence: { type: "agree" | "differ"; topic?: string; summary: Bi };
  sources: DemoSource[];
};

export const DEMO_CARDS: DemoCard[] = [
  {
    key: "jean-prologue",
    book: "JHN",
    chapterStart: 1,
    verseStart: 1,
    chapterEnd: 1,
    verseEnd: 5,
    category: "incarnation",
    difficulty: 2,
    explanation: {
      fr: "L'Évangile de Jean ne commence pas par une naissance mais par l'éternité. Le mot grec traduit par « Parole » est logos, qui veut dire à la fois parole et raison. L'auteur reprend volontairement le début de la Genèse, « Au commencement », pour dire que cette Parole existait avant toute chose et que tout a été fait par elle. La lumière et les ténèbres annoncent le conflit qui traverse tout l'Évangile.",
      en: "John's Gospel does not open with a birth but with eternity. The Greek word rendered \"Word\" is logos, which means both speech and reason. The author deliberately echoes the first words of Genesis, \"In the beginning\", to say that this Word existed before everything and that all things were made through it. Light and darkness announce the conflict that runs through the whole Gospel.",
    },
    action: {
      fr: "Relis lentement le premier verset, trois fois, en t'arrêtant sur un mot différent chaque fois.",
      en: "Read the first verse slowly three times, pausing on a different word each time.",
    },
    catholic: {
      fr: "La tradition catholique lit ici l'affirmation de la divinité du Fils, éternellement auprès du Père, qui s'est fait homme sans cesser d'être Dieu. Bède le Vénérable, cité dans la Catena Aurea de Thomas d'Aquin, remarque que les autres évangélistes racontent la naissance du Christ dans le temps, alors que Jean atteste qu'il était dès le commencement. Lue à Noël, cette page fait regarder la crèche à la lumière de l'éternité.",
      en: "The Catholic tradition reads here the divinity of the Son, eternally with the Father, who became man without ceasing to be God. The Venerable Bede, quoted in Thomas Aquinas's Catena Aurea, notes that the other evangelists tell of Christ's birth in time, whereas John bears witness that he was in the beginning. Read at Christmas, this page makes one look at the crib in the light of eternity.",
    },
    orthodox: {
      fr: "La tradition orthodoxe entend dans ce prologue la confession du Fils consubstantiel au Père, né de lui avant tous les siècles. Saint Cyril d'Alexandrie ouvre son commentaire en montrant que le Fils unique est éternel, sans commencement dans le temps. Proclamé à Pâques, ce texte fait entendre la Résurrection comme la victoire de la lumière que les ténèbres n'ont pas saisie.",
      en: "The Orthodox tradition hears in this prologue the confession of the Son, consubstantial with the Father and begotten of him before all ages. Saint Cyril of Alexandria opens his commentary by showing that the Only-Begotten is eternal, with no beginning in time. Proclaimed at Pascha, this text presents the Resurrection as the victory of the light that the darkness has not overcome.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Catholiques et orthodoxes confessent ensemble la divinité éternelle du Verbe.",
        en: "Catholics and Orthodox together confess the eternal divinity of the Word.",
      },
    },
    sources: [
      { tradition: "catholic", author: "Bede", work: "Catena Aurea (Thomas Aquinas), Commentary on John", section: "Chapter 1", ref: "JHN 1:1", usage: "quote", quote: "John witnesseth that He was in the beginning" },
      { tradition: "orthodox", author: "Cyril of Alexandria", work: "Commentary on the Gospel of John", section: "Book 1", ref: "JHN 1:1", usage: "quote", quote: "That Everlasting and before the ages is the Only-Begotten." },
    ],
  },
  {
    key: "jean-3-16",
    book: "JHN",
    chapterStart: 3,
    verseStart: 16,
    chapterEnd: 3,
    verseEnd: 17,
    category: "croix-salut",
    difficulty: 1,
    explanation: {
      fr: "Ces deux versets concluent l'entretien nocturne entre Jésus et Nicodème, un notable pharisien. Le mot « monde » désigne ici l'humanité entière, y compris ceux qui se détournent de Dieu. Le texte relie le don du Fils à la foi et à la vie éternelle, et précise que le but de cette venue n'est pas de condamner. Les spécialistes discutent pour savoir si ces lignes sont encore les paroles de Jésus ou déjà un commentaire de l'évangéliste.",
      en: "These two verses close the night conversation between Jesus and Nicodemus, a leading Pharisee. \"World\" here means all of humanity, including those who turn away from God. The text links the gift of the Son with faith and eternal life, and states that the purpose of his coming is not to condemn. Scholars debate whether these lines are still Jesus speaking or already the evangelist's own comment.",
    },
    action: {
      fr: "Remplace « le monde » par ton prénom en relisant le verset 16, puis garde cette phrase avec toi aujourd'hui.",
      en: "Read verse 16 again with your own name in place of \"the world\", and keep that sentence with you today.",
    },
    catholic: {
      fr: "La tradition catholique voit dans ce verset le cœur de l'Évangile : l'amour du Père qui donne son Fils jusqu'à la croix pour le salut de tous. Elle souligne que la foi qui sauve est une foi vivante, accueillie dans le baptême et qui agit par la charité. Elle rattache ce salut à la vie même de la Trinité, d'où vient tout amour.",
      en: "The Catholic tradition sees this verse as the heart of the Gospel: the love of the Father who gives his Son, even to the cross, for the salvation of all. It stresses that saving faith is a living faith, received in baptism and working through love. It ties this salvation to the very life of the Trinity, the source of all love.",
    },
    orthodox: {
      fr: "La tradition orthodoxe lit ce verset en lien avec la croix, chantée comme arbre de vie, et avec le don de la vie divine aux hommes. Le salut n'y est pas d'abord vu comme un jugement évité mais comme une guérison et une participation à la vie de Dieu. Le serpent d'airain du désert, évoqué juste avant, y est lu comme l'image du Christ élevé sur la croix.",
      en: "The Orthodox tradition reads this verse together with the cross, sung as the tree of life, and with the gift of divine life to humanity. Salvation is seen less as a judgement avoided than as a healing and a sharing in the life of God. The bronze serpent of the desert, mentioned just before, is read as an image of Christ lifted up on the cross.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions lisent ici l'amour universel du Père et le salut par le Christ ; l'accent porte sur la foi agissante d'un côté, sur la guérison et la participation à la vie divine de l'autre.",
        en: "Both traditions read here the Father's universal love and salvation in Christ; one stresses faith working through love, the other healing and sharing in divine life.",
      },
    },
    sources: [],
  },
  {
    key: "marc-bapteme",
    book: "MRK",
    chapterStart: 1,
    verseStart: 9,
    chapterEnd: 1,
    verseEnd: 11,
    category: "bapteme-tentations",
    difficulty: 1,
    explanation: {
      fr: "Marc raconte le baptême de Jésus en trois versets très sobres. Jésus vient de Nazareth, un village sans renom, et se fait baptiser par Jean dans le Jourdain comme les foules venues se repentir. Le ciel « se déchire », l'Esprit descend comme une colombe et une voix déclare Jésus Fils bien-aimé. Le lecteur sait dès le début qui est Jésus, alors que les personnages du récit mettront longtemps à le comprendre.",
      en: "Mark tells the baptism of Jesus in three very spare verses. Jesus comes from Nazareth, an obscure village, and is baptised by John in the Jordan like the crowds who came to repent. The heavens are \"torn open\", the Spirit comes down like a dove and a voice calls Jesus the beloved Son. The reader knows from the start who Jesus is, while the characters in the story take a long time to understand.",
    },
    action: {
      fr: "Si tu es baptisé, cherche la date de ton baptême ; sinon, pense à ce que signifierait pour toi être appelé « bien-aimé ».",
      en: "If you are baptised, find the date of your baptism; if not, think about what being called \"beloved\" would mean to you.",
    },
    catholic: {
      fr: "La tradition catholique voit dans cette scène la manifestation de la Trinité et la source du baptême chrétien. Bède le Vénérable, cité dans la Catena Aurea, y lit le signe de la grâce spirituelle donnée aux chrétiens dans le baptême. Ce baptême ouvre la mission publique de Jésus.",
      en: "The Catholic tradition sees in this scene the manifestation of the Trinity and the source of Christian baptism. The Venerable Bede, quoted in the Catena Aurea, reads it as a sign of the spiritual grace given to Christians in baptism. This baptism opens Jesus' public mission.",
    },
    orthodox: {
      fr: "Pour la tradition orthodoxe, ce récit est le cœur de la Théophanie, la manifestation de Dieu : le Père se fait entendre, le Fils est dans les eaux, l'Esprit apparaît. Le Christ y est compris comme celui qui sanctifie les eaux et, à travers elles, toute la création ; d'où la bénédiction des eaux propre à cette fête.",
      en: "For the Orthodox tradition this account is the heart of Theophany, the manifestation of God: the Father is heard, the Son stands in the waters, the Spirit appears. Christ is understood as the one who sanctifies the waters and, through them, the whole of creation; hence the blessing of the waters proper to this feast.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions lisent ici la révélation de la Trinité ; l'Orient en fait une fête majeure, la Théophanie, centrée sur la sanctification de la création.",
        en: "Both traditions read here the revelation of the Trinity; the East makes it a major feast, Theophany, centred on the sanctification of creation.",
      },
    },
    sources: [
      { tradition: "catholic", author: "Bede", work: "Catena Aurea (Thomas Aquinas), Commentary on Mark", section: "Chapter 1", ref: "MRK 1:10", usage: "quote", quote: "a sign of spiritual grace to be given to us in baptism" },
    ],
  },
  {
    key: "marc-jean-baptiste",
    book: "MRK",
    chapterStart: 1,
    verseStart: 1,
    chapterEnd: 1,
    verseEnd: 8,
    category: "bapteme-tentations",
    difficulty: 1,
    explanation: {
      fr: "Le premier verset sert de titre à tout l'Évangile de Marc : un « commencement » et une « bonne nouvelle » centrés sur Jésus. Marc présente ensuite Jean le Baptiste à travers une citation prophétique, puis le montre au désert, vêtu comme le prophète Élie. Jean appelle à changer de vie et annonce quelqu'un de plus fort que lui. Le baptême de Jean, dans l'eau, prépare un autre baptême, dans l'Esprit.",
      en: "The first verse works as a title for the whole of Mark's Gospel: a \"beginning\" and \"good news\" centred on Jesus. Mark then introduces John the Baptist through a prophetic quotation, and shows him in the desert, dressed like the prophet Elijah. John calls people to change their lives and announces someone stronger than himself. John's baptism in water prepares another baptism, in the Spirit.",
    },
    action: {
      fr: "Choisis une petite chose à « préparer » cette semaine pour faire de la place, comme Jean prépare le chemin : un rangement, un pardon, un temps de silence.",
      en: "Pick one small thing to \"prepare\" this week to make room, as John prepares the way: some tidying, a pardon, a moment of silence.",
    },
    catholic: {
      fr: "La tradition catholique lit ce passage pendant l'Avent : Jean le Baptiste y est la figure de l'attente et de la conversion qui préparent la venue du Christ. Elle distingue le baptême de Jean, signe de repentir, du sacrement du baptême institué par le Christ. Jean y apparaît comme le dernier des prophètes, qui montre du doigt celui qui vient.",
      en: "The Catholic tradition reads this passage in Advent: John the Baptist stands for the waiting and conversion that prepare for Christ's coming. It distinguishes John's baptism, a sign of repentance, from the sacrament of baptism instituted by Christ. John appears as the last of the prophets, pointing to the one who is coming.",
    },
    orthodox: {
      fr: "La tradition orthodoxe vénère Jean comme le Précurseur, le plus grand des prophètes, souvent représenté sur l'iconostase à côté du Christ. Théophylacte d'Ohrid, cité dans la Catena Aurea, précise que le baptême de Jean ne remettait pas les péchés mais conduisait à la pénitence. Son appel à la pénitence ouvre le chemin vers le baptême du Christ.",
      en: "The Orthodox tradition venerates John as the Forerunner, the greatest of the prophets, often shown on the iconostasis beside Christ. Theophylact of Ohrid, quoted in the Catena Aurea, explains that John's baptism did not forgive sins but led people to repentance. His call to repentance opens the way to Christ's baptism.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions voient en Jean le Précurseur qui appelle à la conversion et dont le baptême prépare celui du Christ.",
        en: "Both traditions see John as the Forerunner who calls to conversion and whose baptism prepares for Christ's.",
      },
    },
    sources: [
      { tradition: "orthodox", author: "Theophylact of Ohrid", work: "Catena Aurea (Thomas Aquinas), Commentary on Mark", section: "Chapter 1", ref: "MRK 1:4", usage: "quote", quote: "The baptism of John had not remission of sins, but only brought men to penitence." },
    ],
  },
  {
    key: "beatitudes",
    book: "MAT",
    chapterStart: 5,
    verseStart: 3,
    chapterEnd: 5,
    verseEnd: 10,
    category: "beatitudes",
    difficulty: 2,
    explanation: {
      fr: "Les Béatitudes ouvrent le Sermon sur la montagne, le premier grand discours de Jésus chez Matthieu. Le mot « Heureux » revient huit fois. Il désigne moins une émotion qu'une situation bénie par Dieu. Les personnes déclarées heureuses sont souvent celles que le monde plaint : les pauvres, ceux qui pleurent, les persécutés. La première et la dernière promesse parlent du royaume des cieux au présent, les autres au futur.",
      en: "The Beatitudes open the Sermon on the Mount, Jesus' first great discourse in Matthew. The word \"Blessed\" comes back eight times. It points less to a feeling than to a situation blessed by God. The people called blessed are often those the world pities: the poor, the mourning, the persecuted. The first and last promises speak of the kingdom of heaven in the present tense, the others in the future.",
    },
    action: {
      fr: "Choisis une seule béatitude et cherche aujourd'hui une personne qui la vit sans le savoir.",
      en: "Choose one Beatitude and look today for someone who lives it without knowing it.",
    },
    catholic: {
      fr: "La tradition catholique lit les Béatitudes comme le portrait du Christ et le chemin du bonheur véritable, au cœur de sa morale. Saint Ambroise, cité dans la Catena Aurea, note que pour le ciel la béatitude commence là où, pour les hommes, commence la misère. Les saints sont vus comme ceux qui ont vécu ces paroles.",
      en: "The Catholic tradition reads the Beatitudes as a portrait of Christ and the path to true happiness, at the centre of its moral teaching. Saint Ambrose, quoted in the Catena Aurea, notes that in heaven's eyes blessedness begins where, in human eyes, misery begins. The saints are seen as those who have lived these words.",
    },
    orthodox: {
      fr: "La tradition orthodoxe chante les Béatitudes dans la Divine Liturgie et les comprend comme les degrés d'une ascension spirituelle vers la ressemblance avec Dieu. Le pauvre en esprit, l'humble, est celui qui laisse de la place à la grâce.",
      en: "The Orthodox tradition sings the Beatitudes in the Divine Liturgy and understands them as the steps of a spiritual ascent toward likeness to God. The poor in spirit, the humble, are those who make room for grace.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions voient dans les Béatitudes le chemin du Royaume et le portrait du Christ.",
        en: "Both traditions see the Beatitudes as the way into the Kingdom and as a portrait of Christ.",
      },
    },
    sources: [
      { tradition: "catholic", author: "Ambrose of Milan", work: "Catena Aurea (Thomas Aquinas), Commentary on Matthew", section: "Chapter 5", ref: "MAT 5:3", usage: "quote", quote: "In the eye of Heaven blessedness begins there where misery begins in human estimation." },
    ],
  },
  {
    key: "notre-pere",
    book: "MAT",
    chapterStart: 6,
    verseStart: 9,
    chapterEnd: 6,
    verseEnd: 13,
    category: "priere-du-seigneur",
    difficulty: 1,
    explanation: {
      fr: "Jésus donne cette prière au milieu du Sermon sur la montagne, juste après avoir mis en garde contre les prières bavardes. Elle commence par trois demandes tournées vers Dieu, son nom, son règne, sa volonté, puis passe aux besoins humains : le pain, le pardon, la protection. Le pardon demandé est lié au pardon accordé aux autres. Luc donne une version plus courte de la même prière.",
      en: "Jesus gives this prayer in the middle of the Sermon on the Mount, just after warning against wordy prayers. It opens with three requests turned toward God, his name, his reign, his will, then moves to human needs: bread, forgiveness, protection. The forgiveness asked for is tied to the forgiveness given to others. Luke gives a shorter version of the same prayer.",
    },
    action: {
      fr: "Dis le Notre Père une fois aujourd'hui en t'arrêtant une respiration après chaque demande.",
      en: "Pray the Our Father once today, pausing for one breath after each request.",
    },
    catholic: {
      fr: "La tradition catholique voit dans cette prière un résumé de tout l'Évangile et la prie dans la messe. Saint Augustin, cité dans la Catena Aurea, explique que Dieu sait déjà ce dont nous avons besoin, mais que l'attitude de la prière apaise et purifie l'âme. Les sept demandes sont souvent lues comme un chemin complet de la vie chrétienne.",
      en: "The Catholic tradition sees this prayer as a summary of the whole Gospel and prays it at Mass. Saint Augustine, quoted in the Catena Aurea, explains that God already knows what we need, but that the posture of prayer calms and purifies the soul. The seven petitions are often read as a complete path of Christian life.",
    },
    orthodox: {
      fr: "La tradition orthodoxe chante cette prière dans la Divine Liturgie et la conclut par une louange adressée au Père, au Fils et au Saint-Esprit. Le « pain » est souvent compris à la fois comme la nourriture quotidienne et comme le pain eucharistique. Dire « notre » Père rappelle que nul ne prie seul.",
      en: "The Orthodox tradition sings this prayer in the Divine Liturgy and closes it with praise to the Father, the Son and the Holy Spirit. The \"bread\" is often understood both as daily food and as the eucharistic bread. Saying \"our\" Father is a reminder that no one prays alone.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Catholiques et orthodoxes prient cette même prière dans leur liturgie et y lisent le même chemin de confiance.",
        en: "Catholics and Orthodox pray this same prayer in their liturgy and read in it the same path of trust.",
      },
    },
    sources: [
      { tradition: "catholic", author: "Augustine of Hippo", work: "Catena Aurea (Thomas Aquinas), Commentary on Matthew", section: "Chapter 6", ref: "MAT 6:9", usage: "quote", quote: "The mental posture of prayer calms and purifies the soul" },
    ],
  },
  {
    key: "magnificat",
    book: "LUK",
    chapterStart: 1,
    verseStart: 46,
    chapterEnd: 1,
    verseEnd: 53,
    category: "magnificat",
    difficulty: 1,
    explanation: {
      fr: "Marie prononce ce chant chez sa cousine Élisabeth, après l'annonce de sa maternité. Le texte est tissé de souvenirs de l'Ancien Testament, en particulier du cantique d'Anne, la mère de Samuel. Le ton est celui de la joie. Marie loue Dieu pour ce qu'il fait pour elle, puis pour ce qu'il fait pour tout son peuple. Le chant annonce un renversement : les puissants descendent, les humbles sont relevés, les affamés sont nourris.",
      en: "Mary speaks this song at the home of her cousin Elizabeth, after learning that she will be a mother. The text is woven from Old Testament memories, especially the song of Hannah, Samuel's mother. Its tone is joy. Mary praises God for what he does for her, then for what he does for all his people. The song announces a reversal: the mighty come down, the lowly are lifted up, the hungry are fed.",
    },
    action: {
      fr: "Écris trois choses précises pour lesquelles tu peux dire merci aujourd'hui, même petites.",
      en: "Write down three specific things you can give thanks for today, even small ones.",
    },
    catholic: {
      fr: "La tradition catholique fait du Magnificat une prière quotidienne de l'Église. Marie y apparaît comme la première croyante et le modèle de l'Église qui reconnaît l'œuvre de Dieu. Le chant nourrit aussi la réflexion catholique sur l'attention aux pauvres.",
      en: "The Catholic tradition has made the Magnificat a daily prayer of the Church. Mary appears as the first believer and as a model of the Church that recognises God's work. The song also feeds Catholic reflection on care for the poor.",
    },
    orthodox: {
      fr: "La tradition orthodoxe chante aussi le Magnificat dans ses offices et honore Marie comme Théotokos, Mère de Dieu, celle en qui se réalise la promesse faite aux pères. L'humilité de Marie y est vue comme la condition de sa grandeur. Le chant est entendu comme la voix de toute l'Église qui loue Dieu.",
      en: "The Orthodox tradition also sings the Magnificat in its services and honours Mary as Theotokos, Mother of God, in whom the promise made to the fathers comes true. Mary's humility is seen as the condition of her greatness. The song is heard as the voice of the whole Church praising God.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions chantent le Magnificat dans leur prière quotidienne et y voient la louange de toute l'Église.",
        en: "Both traditions sing the Magnificat in their daily prayer and hear in it the praise of the whole Church.",
      },
    },
    sources: [],
  },
  {
    key: "annonciation",
    book: "LUK",
    chapterStart: 1,
    verseStart: 26,
    chapterEnd: 1,
    verseEnd: 33,
    category: "annonciation-visitation",
    difficulty: 2,
    explanation: {
      fr: "L'ange Gabriel est envoyé à Nazareth, chez une jeune fille fiancée à Joseph. Dans le salut de l'ange, « toi à qui une grâce a été faite » traduit un seul mot grec, qui suggère une faveur déjà reçue de Dieu. Marie est troublée, et l'ange annonce un fils qui recevra le trône de David et dont le règne n'aura pas de fin. Le récit est construit comme les annonces de naissance de l'Ancien Testament, mais avec une promesse plus grande.",
      en: "The angel Gabriel is sent to Nazareth, to a young woman engaged to Joseph. In the angel's greeting, \"Rejoice, you highly favored one\" renders a Greek word suggesting a favour already received from God. Mary is troubled, and the angel announces a son who will receive David's throne and whose reign will have no end. The story follows the birth announcements of the Old Testament, but with a greater promise.",
    },
    action: {
      fr: "Pense à une nouvelle qui t'a troublé récemment et pose-toi la question de Marie : « Comment cela se fera-t-il ? »",
      en: "Think of a piece of news that unsettled you recently and ask Mary's question: \"How will this be?\"",
    },
    catholic: {
      fr: "La tradition catholique voit dans « comblée de grâce » un appui pour le dogme de l'Immaculée Conception, défini en 1854 : Marie a été préservée du péché originel dès le premier instant de sa conception, en vue des mérites du Christ. Elle honore Marie comme Mère de Dieu et toujours vierge. Le « oui » de Marie est vu comme le modèle de la foi.",
      en: "The Catholic tradition finds in \"full of grace\" a support for the dogma of the Immaculate Conception, defined in 1854: Mary was preserved from original sin from the first moment of her conception, in view of the merits of Christ. It honours Mary as Mother of God and ever-virgin. Mary's \"yes\" is seen as the model of faith.",
    },
    orthodox: {
      fr: "La tradition orthodoxe vénère Marie comme Théotokos, toute sainte (Panaghia) et toujours vierge, et voit dans l'Annonciation le commencement du salut. En général, elle ne reçoit pas le dogme de l'Immaculée Conception tel qu'il est formulé à Rome, en lien avec une autre compréhension du péché ancestral, sans rien retirer à la sainteté de Marie. Saint Grégoire de Nysse, cité dans la Catena Aurea, oppose cette annonce à celle qui avait été faite à Ève.",
      en: "The Orthodox tradition venerates Mary as Theotokos, all-holy (Panagia) and ever-virgin, and sees in the Annunciation the beginning of salvation. In general it does not accept the dogma of the Immaculate Conception as formulated in Rome, because it understands ancestral sin differently, while taking nothing from Mary's holiness. Saint Gregory of Nyssa, quoted in the Catena Aurea, contrasts this announcement with the one once made to Eve.",
    },
    divergence: {
      type: "differ",
      topic: "marian-dogmas",
      summary: {
        fr: "Les deux traditions honorent Marie comme Mère de Dieu toute sainte ; elles divergent sur le dogme de l'Immaculée Conception, lié à leur compréhension du péché originel ou ancestral.",
        en: "Both traditions honour Mary as the all-holy Mother of God; they differ on the dogma of the Immaculate Conception, which depends on how original or ancestral sin is understood.",
      },
    },
    sources: [
      { tradition: "orthodox", author: "Gregory of Nyssa", work: "Catena Aurea (Thomas Aquinas), Commentary on Luke", section: "Chapter 1", ref: "LUK 1:28", usage: "quote", quote: "Far different then to the news formerly addressed to the woman, is the announcement now made to the Virgin." },
    ],
  },
  {
    key: "pierre-roc",
    book: "MAT",
    chapterStart: 16,
    verseStart: 15,
    chapterEnd: 16,
    verseEnd: 19,
    category: "ministeres-autorite",
    difficulty: 3,
    explanation: {
      fr: "Près de Césarée de Philippe, Jésus demande à ses disciples qui il est pour eux. Simon répond qu'il est le Christ, le Fils du Dieu vivant, et Jésus lui donne le nom de Pierre, qui signifie « roc ». Il promet de bâtir son Église sur ce roc et lui confie les clés du Royaume, une image de l'intendant qui ouvre et ferme la maison. Le sens exact de « ce roc » est discuté depuis l'Antiquité.",
      en: "Near Caesarea Philippi, Jesus asks his disciples who he is for them. Simon answers that he is the Christ, the Son of the living God, and Jesus gives him the name Peter, meaning \"rock\". He promises to build his Church on this rock and entrusts him with the keys of the Kingdom, the image of a steward who opens and shuts the house. What \"this rock\" means exactly has been discussed since antiquity.",
    },
    action: {
      fr: "Réponds pour toi-même, en une phrase écrite, à la question de Jésus : « Et vous, qui dites-vous que je suis ? »",
      en: "Answer Jesus' question for yourself in one written sentence: \"But who do you say that I am?\"",
    },
    catholic: {
      fr: "La tradition catholique lit dans ce passage l'institution d'une mission propre de Pierre parmi les apôtres. Elle enseigne que cette mission se poursuit dans l'évêque de Rome, successeur de Pierre, qui exerce une primauté de juridiction sur toute l'Église, définie au XIXe siècle. Les clés expriment cette charge de gouverner et de garder l'unité de la foi.",
      en: "The Catholic tradition reads in this passage the establishment of a particular mission for Peter among the apostles. It teaches that this mission continues in the bishop of Rome, Peter's successor, who exercises a primacy of jurisdiction over the whole Church, defined in the nineteenth century. The keys express this charge to govern and keep the unity of faith.",
    },
    orthodox: {
      fr: "La tradition orthodoxe honore Pierre comme coryphée des apôtres et lit souvent « ce roc » comme la foi qu'il vient de confesser, sur laquelle l'Église est fondée. Elle reconnaît à l'Église de Rome une primauté d'honneur dans l'Église ancienne, mais pas une juridiction universelle, et vit l'unité dans la communion des Églises et des conciles. Chaque évêque qui garde la vraie foi est vu comme héritier de la confession de Pierre.",
      en: "The Orthodox tradition honours Peter as the leader of the apostles and often reads \"this rock\" as the faith he has just confessed, on which the Church is founded. It recognises that the Church of Rome held a primacy of honour in the early Church, but not a universal jurisdiction, and lives unity through the communion of Churches and councils. Every bishop who keeps the true faith is seen as an heir of Peter's confession.",
    },
    divergence: {
      type: "differ",
      topic: "primacy",
      summary: {
        fr: "Les deux traditions honorent Pierre et sa confession ; elles divergent sur la primauté de l'évêque de Rome : juridiction universelle d'un côté, primauté d'honneur dans la communion des Églises de l'autre.",
        en: "Both traditions honour Peter and his confession; they differ on the primacy of the bishop of Rome: universal jurisdiction on one side, a primacy of honour within the communion of Churches on the other.",
      },
    },
    sources: [],
  },
  {
    key: "esprit-procede",
    book: "JHN",
    chapterStart: 15,
    verseStart: 26,
    chapterEnd: 15,
    verseEnd: 27,
    category: "esprit-saint",
    difficulty: 3,
    explanation: {
      fr: "Ces deux versets font partie du long discours de Jésus à ses disciples la veille de sa mort. C'est un adieu. Jésus promet le Consolateur, l'Esprit de vérité, qu'il enverra d'auprès du Père et qui « procède du Père ». L'Esprit rendra témoignage au Christ, et les disciples, qui l'ont suivi depuis le début, témoigneront à leur tour. Le verbe grec traduit par « procéder » est devenu un mot clé de la théologie de la Trinité.",
      en: "These two verses belong to Jesus' long discourse to his disciples on the eve of his death. Jesus promises the Advocate, the Spirit of truth, whom he will send from the Father and who \"proceeds from the Father\". The Spirit will bear witness to Christ, and the disciples, who have been with him from the beginning, will bear witness in their turn. The Greek verb rendered \"proceed\" became a key word in the theology of the Trinity.",
    },
    action: {
      fr: "Avant une conversation importante aujourd'hui, demande en silence l'Esprit de vérité.",
      en: "Before an important conversation today, silently ask for the Spirit of truth.",
    },
    catholic: {
      fr: "La tradition catholique confesse que l'Esprit procède du Père et du Fils comme d'un seul principe, ce qu'exprime l'ajout « et du Fils » (Filioque) au Credo en usage dans l'Église latine. Elle comprend cette formule comme compatible avec la monarchie du Père, source de toute la divinité. Les Églises catholiques orientales récitent le Credo sans cet ajout.",
      en: "The Catholic tradition confesses that the Spirit proceeds from the Father and the Son as from one principle, expressed by the words \"and the Son\" (Filioque) added to the Creed used in the Latin Church. It understands this formula as consistent with the monarchy of the Father, the source of all divinity. The Eastern Catholic Churches say the Creed without the addition.",
    },
    orthodox: {
      fr: "La tradition orthodoxe confesse, avec les mots mêmes de ce verset, que l'Esprit procède éternellement du Père seul, source unique au sein de la Trinité, et qu'il est envoyé dans le temps par le Fils. Elle refuse l'ajout du Filioque au Credo, fait sans concile commun, et y voit un risque de brouiller la place propre du Père. Ce point reste l'un des principaux sujets du dialogue entre les deux Églises.",
      en: "The Orthodox tradition confesses, in the very words of this verse, that the Spirit proceeds eternally from the Father alone, the one source within the Trinity, and is sent in time through the Son. It rejects the addition of the Filioque to the Creed, made without a common council, and sees in it a risk of blurring the Father's proper place. This remains one of the main topics of dialogue between the two Churches.",
    },
    divergence: {
      type: "differ",
      topic: "filioque",
      summary: {
        fr: "Les deux traditions confessent que l'Esprit procède du Père ; elles divergent sur l'ajout « et du Fils » au Credo et sur la manière de dire le rôle du Fils.",
        en: "Both traditions confess that the Spirit proceeds from the Father; they differ on the words \"and the Son\" added to the Creed and on how to express the role of the Son.",
      },
    },
    sources: [],
  },
  {
    key: "nature-divine",
    book: "2PE",
    chapterStart: 1,
    verseStart: 3,
    chapterEnd: 1,
    verseEnd: 4,
    category: "esperance",
    difficulty: 3,
    explanation: {
      fr: "Au début de sa deuxième lettre, l'auteur rappelle ce que Dieu a déjà donné aux croyants : tout ce qu'il faut pour la vie et la piété. Il parle de promesses grâce auxquelles les croyants deviennent « participants de la nature divine » et échappent à la corruption du monde. Cette expression, unique dans le Nouveau Testament, emprunte le vocabulaire de la philosophie grecque de l'époque. Les versets suivants énumèrent les vertus qui doivent en découler.",
      en: "At the start of his second letter, the author recalls what God has already given to believers: everything needed for life and godliness. He speaks of promises through which believers \"become partakers of the divine nature\" and escape the corruption of the world. This phrase, unique in the New Testament, borrows the vocabulary of the Greek philosophy of the time. The following verses list the virtues that should flow from it.",
    },
    action: {
      fr: "Choisis une vertu de la liste qui suit (2 P 1, 5-7) et cherche une occasion concrète de la pratiquer aujourd'hui.",
      en: "Choose one virtue from the list that follows (2 Pet 1:5-7) and look for one concrete chance to practise it today.",
    },
    catholic: {
      fr: "La tradition catholique lit dans ce verset la grâce sanctifiante, don qui rend l'homme réellement participant de la vie de Dieu sans le confondre avec lui. Elle parle aussi de divinisation, une idée présente chez les Pères latins et dans les grands théologiens médiévaux. Cette participation est vue comme commencée au baptême et achevée dans la vision de Dieu.",
      en: "The Catholic tradition reads in this verse sanctifying grace, a gift that makes a person truly share in God's life without being confused with him. It also speaks of divinisation, an idea found in the Latin Fathers and in the great medieval theologians. This sharing is seen as begun in baptism and completed in the vision of God.",
    },
    orthodox: {
      fr: "La tradition orthodoxe voit dans ce verset un fondement de la théosis, la divinisation, but même de la vie chrétienne. Elle distingue l'essence de Dieu, qui reste inaccessible, et ses énergies incréées, par lesquelles l'homme participe réellement à la vie divine. La prière, les sacrements et l'ascèse sont compris comme le chemin de cette transformation.",
      en: "The Orthodox tradition sees in this verse a foundation of theosis, deification, the very goal of the Christian life. It distinguishes God's essence, which remains inaccessible, from his uncreated energies, through which a person truly shares in divine life. Prayer, the sacraments and ascetic struggle are understood as the way of this transformation.",
    },
    divergence: {
      type: "differ",
      topic: "theosis",
      summary: {
        fr: "Les deux traditions affirment une vraie participation à la vie divine ; elles la pensent différemment : grâce sanctifiante d'un côté, énergies incréées distinguées de l'essence de l'autre.",
        en: "Both traditions affirm a real sharing in divine life; they think it through differently: sanctifying grace on one side, uncreated energies distinct from the essence on the other.",
      },
    },
    sources: [],
  },
  {
    key: "pain-de-vie",
    book: "JHN",
    chapterStart: 6,
    verseStart: 53,
    chapterEnd: 6,
    verseEnd: 58,
    category: "eucharistie",
    difficulty: 2,
    explanation: {
      fr: "Ces versets concluent le discours sur le pain de vie, prononcé dans la synagogue de Capharnaüm après la multiplication des pains. Jésus passe d'un langage sur la foi à un langage très concret : manger sa chair et boire son sang. Le mot grec utilisé pour « manger » est réaliste et a choqué une partie des auditeurs. Jésus compare ce pain à la manne du désert, en promettant une vie qui ne finit pas. Beaucoup de disciples s'en vont ensuite.",
      en: "These verses close the discourse on the bread of life, given in the synagogue at Capernaum after the feeding of the crowd. Jesus moves from language about faith to very concrete language: eating his flesh and drinking his blood. The Greek verb used for \"eat\" is a realistic one and shocked some of the listeners. Jesus compares this bread with the manna in the desert, promising a life that does not end. Many disciples leave afterwards.",
    },
    action: {
      fr: "La prochaine fois que tu partages un repas, prends un instant pour rendre grâce avant de commencer.",
      en: "The next time you share a meal, take a moment to give thanks before you begin.",
    },
    catholic: {
      fr: "La tradition catholique lit ce discours comme une annonce de l'Eucharistie, où le Christ est réellement présent. Elle décrit ce changement du pain et du vin par le mot transsubstantiation. Saint Augustin, cité dans la Catena Aurea, ajoute que les fidèles reçoivent le Corps du Christ s'ils travaillent à être eux-mêmes le corps du Christ.",
      en: "The Catholic tradition reads this discourse as announcing the Eucharist, in which Christ is truly present. It describes the change of bread and wine with the word transubstantiation. Saint Augustine, quoted in the Catena Aurea, adds that the faithful receive the Body of Christ if they labour to be the body of Christ themselves.",
    },
    orthodox: {
      fr: "La tradition orthodoxe lit aussi ce passage comme une annonce des saints Mystères, où le pain et le vin deviennent vraiment le Corps et le Sang du Christ. Elle parle de changement (metabolè) et souligne le rôle de l'Esprit invoqué par l'épiclèse, sans chercher à expliquer le comment. Saint Jean Chrysostome s'émerveille dans ses homélies que le Christ se donne à voir, mais aussi à toucher et à manger.",
      en: "The Orthodox tradition also reads this passage as announcing the Holy Mysteries, in which the bread and wine truly become the Body and Blood of Christ. It speaks of change (metabolē) and stresses the role of the Spirit called down in the epiclesis, without trying to explain how. Saint John Chrysostom marvels in his homilies that Christ gives himself to be seen, and also to be touched and eaten.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions confessent la présence réelle du Christ dans l'Eucharistie ; elles la décrivent avec un vocabulaire différent.",
        en: "Both traditions confess the real presence of Christ in the Eucharist; they describe it with different vocabulary.",
      },
    },
    sources: [
      { tradition: "catholic", author: "Augustine of Hippo", work: "Catena Aurea (Thomas Aquinas), Commentary on John", section: "Chapter 6", ref: "JHN 6:53", usage: "quote", quote: "The faithful know and receive the Body of Christ, if they labour to be the body of Christ." },
      { tradition: "orthodox", author: "John Chrysostom", work: "Homilies On John", section: "Homily 46", ref: "JHN 6:53", usage: "paraphrase" },
    ],
  },
  {
    key: "fils-prodigue",
    book: "LUK",
    chapterStart: 15,
    verseStart: 17,
    chapterEnd: 15,
    verseEnd: 24,
    category: "repentir-pardon",
    difficulty: 1,
    explanation: {
      fr: "Ce passage est le tournant de la parabole des deux fils. Le cadet, réduit à garder des porcs, « rentre en lui-même » et prépare un discours d'excuse. Le père le voit de loin, court vers lui, l'embrasse et l'interrompt avant la fin de son discours. Robe, anneau et sandales lui rendent sa place de fils, et la fête commence ; la suite de la parabole parlera du fils aîné.",
      en: "This passage is the turning point of the parable of the two sons. The younger son, reduced to tending pigs, \"comes to himself\" and prepares a speech of apology. The father sees him from far off, runs to him, embraces him and interrupts him before he finishes. The robe, ring and sandals give him back his place as a son, and the feast begins; the rest of the parable turns to the elder son.",
    },
    action: {
      fr: "Fais aujourd'hui le premier pas vers quelqu'un avec qui la relation s'est refroidie : un message, un appel, un mot.",
      en: "Take the first step today toward someone with whom things have cooled: a message, a call, a word.",
    },
    catholic: {
      fr: "La tradition catholique lit cette parabole comme l'image du sacrement de la réconciliation : la prise de conscience, la confession, puis le pardon accordé et la joie retrouvée. Saint Ambroise, cité dans la Catena Aurea, dit que le Père court à notre rencontre parce qu'il entend déjà les pensées secrètes du cœur. Le récit invite à revenir sans crainte.",
      en: "The Catholic tradition reads this parable as an image of the sacrament of reconciliation: awareness, confession, then pardon given and joy restored. Saint Ambrose, quoted in the Catena Aurea, says the Father runs to meet us because he already hears the secret thoughts of the heart. The story invites a return without fear.",
    },
    orthodox: {
      fr: "La tradition orthodoxe lit cette parabole pendant la préparation au Grand Carême. Le retour du fils y est vu comme le modèle de la metanoïa, le retournement du cœur, et la fête comme une image de l'Eucharistie. Saint Jean Chrysostome, cité dans la Catena Aurea, remarque que le père n'attend même pas les paroles de la confession.",
      en: "The Orthodox tradition reads this parable while preparing for Great Lent. The son's return is seen as the model of metanoia, the turning of the heart, and the feast as an image of the Eucharist. Saint John Chrysostom, quoted in the Catena Aurea, notes that the father does not even wait for the words of confession.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions voient ici la miséricorde du Père et le chemin du repentir.",
        en: "Both traditions see here the Father's mercy and the path of repentance.",
      },
    },
    sources: [
      { tradition: "catholic", author: "Ambrose of Milan", work: "Catena Aurea (Thomas Aquinas), Commentary on Luke", section: "Chapter 15", ref: "LUK 15:20", usage: "quote", quote: "He runs then to meet thee, because He hears thee within meditating the secrets of thy heart" },
      { tradition: "orthodox", author: "John Chrysostom", work: "Catena Aurea (Thomas Aquinas), Commentary on Luke", section: "Chapter 15", ref: "LUK 15:20", usage: "quote", quote: "the father perceiving his penitence did not wait to receive the words of his confession" },
    ],
  },
  {
    key: "psaume-1",
    book: "PSA",
    chapterStart: 1,
    verseStart: 1,
    chapterEnd: 1,
    verseEnd: 6,
    category: "psaumes-sagesse",
    difficulty: 1,
    explanation: {
      fr: "Le premier psaume sert de porte d'entrée à tout le livre des Psaumes. Il oppose deux chemins : celui de la personne qui médite la loi de Dieu jour et nuit, et celui des méchants. La première est comparée à un arbre planté près d'un cours d'eau, les seconds à la paille que le vent emporte. Ce psaume de sagesse ne porte pas de titre et a le même numéro dans la Bible hébraïque et dans la Septante.",
      en: "The first psalm is the doorway to the whole book of Psalms. It sets two paths side by side: that of the person who meditates on God's law day and night, and that of the wicked. The first is compared to a tree planted by streams of water, the others to chaff blown away by the wind. This wisdom psalm has no title and carries the same number in the Hebrew Bible and in the Septuagint.",
    },
    action: {
      fr: "Choisis un verset court de ce psaume et répète-le plusieurs fois dans la journée, comme on rumine un mot.",
      en: "Pick one short verse of this psalm and repeat it several times during the day, chewing it over like a single word.",
    },
    catholic: {
      fr: "La tradition catholique a souvent vu dans « l'homme heureux » du premier psaume une figure du Christ, le juste parfait. Le psaume invite à la lectio divina, la lecture lente et priée de l'Écriture, que le texte décrit lui-même comme une méditation jour et nuit. L'arbre planté près des eaux devient l'image de la croix qui donne du fruit.",
      en: "The Catholic tradition has often seen \"the blessed man\" of the first psalm as a figure of Christ, the perfectly righteous one. The psalm invites lectio divina, the slow and prayerful reading of Scripture, which the text itself describes as meditation day and night. The tree planted by the waters becomes an image of the cross that bears fruit.",
    },
    orthodox: {
      fr: "La tradition orthodoxe lit ce psaume comme l'entrée dans la prière du psautier, qui accompagne toute la vie de l'Église. L'homme heureux y est souvent compris comme le Christ lui-même. L'arbre près des eaux est compris comme le croyant enraciné dans le Christ et nourri par l'Esprit.",
      en: "The Orthodox tradition reads this psalm as the entrance into the prayer of the psalter, which goes with the whole life of the Church. The blessed man is often understood as Christ himself. The tree by the waters is understood as the believer rooted in Christ and fed by the Spirit.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions lisent ce psaume comme l'ouverture de la prière des psaumes et une invitation à méditer la Parole.",
        en: "Both traditions read this psalm as the opening of psalm prayer and an invitation to meditate on the Word.",
      },
    },
    sources: [],
  },
  {
    key: "psaume-23",
    book: "PSA",
    chapterStart: 23,
    verseStart: 1,
    chapterEnd: 23,
    verseEnd: 6,
    category: "silence-confiance",
    difficulty: 1,
    explanation: {
      fr: "Ce psaume de confiance compare Dieu à un berger qui guide, nourrit et protège. La deuxième partie change d'image : Dieu devient un hôte qui dresse une table, verse l'huile sur la tête et fait déborder la coupe. La « vallée de l'ombre de la mort » évoque un passage dangereux plutôt que la mort elle-même. Ce psaume porte le numéro 23 dans la Bible hébraïque et 22 dans la Septante et la Vulgate.",
      en: "This psalm of trust compares God to a shepherd who leads, feeds and protects. The second half changes image: God becomes a host who spreads a table, pours oil on the head and makes the cup overflow. The \"valley of the shadow of death\" suggests a dangerous passage rather than death itself. The psalm is numbered 23 in the Hebrew Bible and 22 in the Septuagint and the Vulgate.",
    },
    action: {
      fr: "Ce soir, avant de dormir, dis lentement le premier verset en pensant à ce qui t'inquiète.",
      en: "Tonight, before you sleep, say the first verse slowly while thinking of what worries you.",
    },
    catholic: {
      fr: "La tradition catholique lit ce psaume à la lumière du Christ, le bon Pasteur, et de l'initiation chrétienne : l'eau du baptême, l'huile de la confirmation, la table de l'Eucharistie. Le psaume nourrit la confiance de celui qui traverse l'épreuve.",
      en: "The Catholic tradition reads this psalm in the light of Christ the Good Shepherd and of Christian initiation: the water of baptism, the oil of confirmation, the table of the Eucharist. The psalm feeds the trust of anyone going through a trial.",
    },
    orthodox: {
      fr: "La tradition orthodoxe lit elle aussi dans ce psaume la vie sacramentelle : la table dressée et la coupe annoncent la communion, l'huile évoque le saint chrême. Le berger est le Christ qui conduit vers la vie. Au verset 5, la Septante, traduite par Giguet, parle d'un « calice enivrant », là où l'hébreu dit « ma coupe déborde ».",
      en: "The Orthodox tradition also reads sacramental life in this psalm: the table spread and the cup announce communion, the oil recalls holy chrism. The shepherd is Christ leading toward life. In verse 5 the Greek Septuagint, in Brenton's version, reads \"thy cup cheers me like the best wine\", where the Hebrew says \"my cup runs over\".",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions lisent ce psaume à la lumière du Christ Pasteur et des sacrements ; le texte grec et le texte hébreu diffèrent légèrement au verset 5.",
        en: "Both traditions read this psalm in the light of Christ the Shepherd and of the sacraments; the Greek and Hebrew texts differ slightly in verse 5.",
      },
    },
    sources: [],
  },
  {
    key: "psaume-51",
    book: "PSA",
    chapterStart: 51,
    verseStart: 3,
    chapterEnd: 51,
    verseEnd: 8,
    category: "psaumes-penitentiels",
    difficulty: 2,
    explanation: {
      fr: "Le titre de ce psaume le rattache au moment où le prophète Nathan reproche à David son adultère avec Bethsabée et le meurtre d'Urie. Le ton est direct. Le croyant ne cherche pas d'excuse : il reconnaît sa faute et en appelle à la bonté de Dieu. Il parle de la faute comme d'une tache à laver et d'une dette envers Dieu lui-même. Dans les Bibles hébraïques le titre occupe les deux premiers versets, d'où la numérotation qui commence ici au verset 3.",
      en: "The title of this psalm links it to the moment the prophet Nathan rebukes David for his adultery with Bathsheba and the killing of Uriah. The speaker makes no excuse: he admits his fault and appeals to God's kindness. He speaks of the fault as a stain to be washed and as a debt toward God himself. In Hebrew Bibles the title takes up the first two verses, which is why the numbering starts here at verse 3.",
    },
    action: {
      fr: "Prends cinq minutes ce soir pour relire ta journée et nommer, sans te juger, une chose que tu voudrais réparer.",
      en: "Take five minutes tonight to look back over your day and name, without judging yourself, one thing you would like to put right.",
    },
    catholic: {
      fr: "La tradition catholique a fait de ce psaume, appelé Miserere d'après son premier mot latin, la grande prière de la pénitence. Il accompagne souvent la préparation au sacrement de la réconciliation. Le cœur pur demandé par le psaume est vu comme un don de la grâce.",
      en: "The Catholic tradition has made this psalm, called the Miserere after its first Latin word, the great prayer of penance. It often accompanies preparation for the sacrament of reconciliation. The pure heart the psalm asks for is seen as a gift of grace.",
    },
    orthodox: {
      fr: "La tradition orthodoxe prie ce psaume, le Psaume 50 de la Septante, très souvent, dans les offices comme dans la prière personnelle. Il exprime la componction, la douleur du cœur qui s'ouvre à la miséricorde. La pénitence y est vue comme un retour vers la maison du Père plus que comme une peine.",
      en: "The Orthodox tradition prays this psalm, Psalm 50 in the Septuagint, very often, in the services as in personal prayer. It expresses compunction, the sorrow of a heart opening to mercy. Repentance is seen as a return to the Father's house rather than a penalty.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions prient ce psaume comme la prière de pénitence par excellence, sous le numéro 51 ou 50 selon la numérotation.",
        en: "Both traditions pray this psalm as the penitential prayer above all, numbered 51 or 50 depending on the numbering.",
      },
    },
    sources: [],
  },
  {
    key: "psaume-22-percé",
    book: "PSA",
    chapterStart: 22,
    verseStart: 17,
    chapterEnd: 22,
    verseEnd: 19,
    category: "psaumes-royaux-messianiques",
    difficulty: 3,
    explanation: {
      fr: "Dans ce psaume de détresse, l'homme qui prie se décrit encerclé par ses ennemis, épuisé, dépouillé de ses vêtements. Le verset 17 se lit différemment selon les textes : dans le texte hébreu traditionnel, le mot clé se lit « comme un lion », alors que la Septante grecque a « ils ont percé mes mains et mes pieds ». La traduction Louis Segond suit ici la lecture « ils ont percé ». Les évangiles citent le verset 19 dans le récit du partage des vêtements de Jésus.",
      en: "In this psalm of distress, the one praying describes himself surrounded by enemies, exhausted, stripped of his clothes. Verse 17 reads differently in different texts: in the traditional Hebrew text the key word reads \"like a lion\", while the Greek Septuagint has \"they pierced my hands and my feet\". The Louis Segond translation follows the reading \"they pierced\" here. The Gospels quote verse 19 when telling how Jesus' clothes were divided.",
    },
    action: {
      fr: "Pense à une personne qui traverse une grande épreuve et prie pour elle avec les mots de ce psaume, ou simplement en silence.",
      en: "Think of someone going through a great trial and pray for them with the words of this psalm, or simply in silence.",
    },
    catholic: {
      fr: "La tradition catholique lit ce psaume comme une prophétie de la Passion, puisque Jésus en prononce le premier verset sur la croix. Le texte de la Vulgate, traduit dans la Douay-Rheims, lit « ils ont percé mes mains et mes pieds ». La fin du psaume, tournée vers la louange, annonce la Résurrection.",
      en: "The Catholic tradition reads this psalm as a prophecy of the Passion, since Jesus speaks its first verse on the cross. The text of the Vulgate, rendered in the Douay-Rheims, reads \"they have dug my hands and feet\". The ending of the psalm, turned toward praise, points to the Resurrection.",
    },
    orthodox: {
      fr: "La tradition orthodoxe prie ce psaume, le Psaume 21 de la Septante, comme le chant de la Passion du Christ, et la Septante lit « ils ont percé mes mains et mes pieds ». Le partage des vêtements y est médité comme l'humiliation volontaire du Christ.",
      en: "The Orthodox tradition prays this psalm, Psalm 21 in the Septuagint, as the song of Christ's Passion, and the Septuagint reads \"they pierced my hands and my feet\". The dividing of the clothes is pondered there as Christ's freely accepted humiliation.",
    },
    divergence: {
      type: "agree",
      summary: {
        fr: "Les deux traditions prient ce psaume comme une annonce de la Passion ; la différence porte sur le texte du verset 17 entre l'hébreu traditionnel et la Septante, non entre les deux Églises.",
        en: "Both traditions pray this psalm as foretelling the Passion; the difference in verse 17 lies between the traditional Hebrew text and the Septuagint, not between the two Churches.",
      },
    },
    sources: [],
  },
];
