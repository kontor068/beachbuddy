/**
 * Single source of truth for a region's dominant SUMMER wind regime — shared by
 * TypeScript runtime (windClimatology, beachGuides, App) and the plain-node build
 * scripts (buildBeachRegionData, prerenderBeachPages). Plain .mjs so every context
 * can import it.
 *
 * The meltemi is a Central/South Aegean phenomenon. The Ionian/West runs on the
 * afternoon NW "maistros"; the Thermaic gulf's winter Vardaris is irrelevant in
 * summer — the nuisance there is the same afternoon NW/W sea breeze. So the
 * "sheltered from the local summer wind" sectors differ by regime.
 */

// Only non-default regions listed; everything else is 'aegean'.
export const REGION_WIND_CONTEXT = {
  // Ionian & West — the NW maistros
  'ionian-islands-corfu': 'ionian', 'ionian-islands-kefalonia': 'ionian', 'ionian-islands-zakynthos': 'ionian',
  'ionian-islands-lefkada': 'ionian', 'ionian-islands-paxos': 'ionian', 'ionian-islands-antipaxos': 'ionian',
  'ionian-islands-ithaca': 'ionian', 'ionian-islands-meganisi': 'ionian', 'ionian-islands-othonoi': 'ionian',
  'ionian-islands-erikoussa': 'ionian', 'ionian-islands-mathraki': 'ionian',
  'epirus-thesprotia-mainland': 'ionian', 'epirus-preveza-mainland': 'ionian', 'epirus-arta-mainland': 'ionian',
  'west-greece-achaia-mainland': 'ionian', 'west-greece-aetolia-acarnania-mainland': 'ionian', 'west-greece-ileia-mainland': 'ionian',
  'peloponnese-korinthia-mainland': 'ionian', 'central-greece-fokida-mainland': 'ionian', 'central-greece-viotia-mainland': 'ionian',
  // Thermaic gulf — afternoon NW/W summer sea breeze (no wind name in copy)
  'central-macedonia-pieria-mainland': 'thermaic', 'central-macedonia-thessaloniki-area': 'thermaic',
};

export const getRegionWindContext = regionId => REGION_WIND_CONTEXT[regionId] || 'aegean';

// Sectors that define "sheltered from the local summer wind" per regime.
export const LOCAL_WIND_SECTORS = {
  aegean: ['N', 'NE'],
  ionian: ['NW', 'W'],
  thermaic: ['NW', 'W'],
};

// Copy tokens per regime. `elFrom`/`elIn` bake the article + case; thermaic has
// no wind name ("the summer wind"), by design.
export const LOCAL_WIND_LABEL = {
  aegean:   { elNom: 'το μελτέμι',        elFrom: 'από το μελτέμι',            elIn: 'στο μελτέμι',            en: 'the meltemi',    enSubject: 'the meltemi',    de: 'dem Meltemi',    fr: 'du meltem',       it: 'dal meltemi' },
  ionian:   { elNom: 'ο μαΐστρος',        elFrom: 'από τον μαΐστρο',           elIn: 'στον μαΐστρο',           en: 'the maistros',   enSubject: 'the maistros',   de: 'dem Maistros',   fr: 'du maïstro',      it: 'dal maestrale' },
  thermaic: { elNom: 'ο καλοκαιρινός αέρας', elFrom: 'από τον καλοκαιρινό αέρα', elIn: 'στον καλοκαιρινό αέρα', en: 'the summer wind', enSubject: 'the summer wind', de: 'dem Sommerwind', fr: "du vent d'été",   it: 'dal vento estivo' },
};

export const localWindLabelFor = regionId => LOCAL_WIND_LABEL[getRegionWindContext(regionId)];
export const localWindSectorsFor = regionId => LOCAL_WIND_SECTORS[getRegionWindContext(regionId)];

// Atomic tokens for prose that names the regime (word / direction abbrev / sea).
export const LOCAL_WIND_ATOMS = {
  aegean:   { word: { en: 'meltemi',     gr: 'μελτέμι',          de: 'Meltemi',     it: 'meltemi',    fr: 'meltemi' }, dir: { en: 'N/NE', gr: 'Β/ΒΑ', de: 'N/NO', it: 'N/NE', fr: 'N/NE' }, sea: { en: 'the Aegean', gr: 'το Αιγαίο', de: 'die Ägäis', it: "l'Egeo", fr: 'la mer Égée' } },
  ionian:   { word: { en: 'maistros',    gr: 'μαΐστρος',         de: 'Maistros',    it: 'maestrale',  fr: 'maïstro' }, dir: { en: 'NW/W', gr: 'ΒΔ/Δ', de: 'NW/W', it: 'NO/O', fr: 'NO/O' }, sea: { en: 'the Ionian', gr: 'το Ιόνιο', de: 'das Ionische Meer', it: 'lo Ionio', fr: 'la mer Ionienne' } },
  thermaic: { word: { en: 'summer wind', gr: 'καλοκαιρινός αέρας', de: 'Sommerwind', it: 'vento estivo', fr: "vent d'été" }, dir: { en: 'NW/W', gr: 'ΒΔ/Δ', de: 'NW/W', it: 'NO/O', fr: 'NO/O' }, sea: { en: 'the Thermaic Gulf', gr: 'τον Θερμαϊκό', de: 'den Thermaischen Golf', it: 'il Golfo Termaico', fr: 'le golfe Thermaïque' } },
};

// Full seasonal-shelter section copy per regime (LocalWindShelterSection reads this).
// `statusBoatGr` = neuter-agreeing Greek for boat-only spots ("Το Κλέφτικο …").
//
// EVERY TITLE SAYS "USUALLY" (05/08/2026). This section is a seasonal atlas and is
// deliberately independent of today's forecast — but on a real phone, «Στον μαΐστρο»
// three screens below a calm mint card read as a statement about NOW, and the beach
// appeared to contradict itself: ideal at the top, "exposed, often choppy" further down.
// Both were true; only one said when. The word costs nothing and removes the collision.
export const LOCAL_WIND_SECTION = {
  aegean: {
    title: { en: 'Usually in the meltemi', gr: 'Συνήθως στα μελτέμια', de: 'Normalerweise beim Meltemi', it: 'Di solito con il meltemi', fr: 'Habituellement pendant le meltem' },
    intro: {
      en: 'The meltemi is the dry N/NE wind that dominates Aegean summers — the single best guide to how a beach usually behaves from July to September.',
      gr: 'Το μελτέμι είναι ο ξηρός Β/ΒΑ άνεμος που κυριαρχεί το καλοκαίρι στο Αιγαίο — ο πιο αξιόπιστος οδηγός για το πώς συμπεριφέρεται συνήθως μια παραλία από τον Ιούλιο ως τον Σεπτέμβριο.',
      de: 'Der Meltemi ist der trockene N/NO-Wind, der die Ägäis-Sommer prägt — der beste Hinweis darauf, wie sich ein Strand von Juli bis September meist verhält.',
      it: "Il meltemi è il vento secco da N/NE che domina l'estate nell'Egeo — la guida migliore su come si comporta di solito una spiaggia da luglio a settembre.",
      fr: "Le meltemi est le vent sec de N/NE qui domine l'été en mer Égée — le meilleur indice du comportement habituel d'une plage de juillet à septembre.",
    },
    status: {
      protected: { en: 'usually stays sheltered when the meltemi blows.', gr: 'συνήθως μένει προστατευμένη όταν φυσά μελτέμι.', de: 'bleibt beim Meltemi meist windgeschützt.', it: 'di solito resta riparata quando soffia il meltemi.', fr: 'reste généralement abritée quand le meltemi souffle.' },
      partial:   { en: 'has partial shelter in the meltemi — calm some days, choppy on stronger ones.', gr: 'έχει μερική προστασία στα μελτέμια — κάποιες μέρες ήρεμη, με κυματάκι όταν δυναμώνουν.', de: 'ist beim Meltemi teils exponiert — mal ruhig, bei stärkerem Wind kabbelig.', it: 'è in parte esposta al meltemi — calma certi giorni, mossa nei più forti.', fr: 'est en partie exposée au meltemi — calme certains jours, agitée par vent fort.' },
      exposed:   { en: 'is exposed in the meltemi — often choppy on summer N/NE days.', gr: 'είναι εκτεθειμένη στα μελτέμια — συχνά με κύμα τις καλοκαιρινές Β/ΒΑ μέρες.', de: 'ist beim Meltemi exponiert — an N/NO-Sommertagen oft kabbelig.', it: 'è esposta al meltemi — spesso mossa nelle giornate estive da N/NE.', fr: "est exposée au meltemi — souvent agitée les jours d'été de N/NE." },
    },
    statusBoatGr: {
      protected: 'συνήθως μένει προστατευμένο όταν φυσά μελτέμι.',
      partial: 'έχει μερική προστασία στα μελτέμια — κάποιες μέρες ήρεμο, με κυματάκι όταν δυναμώνουν.',
      exposed: 'είναι εκτεθειμένο στα μελτέμια — συχνά με κύμα τις καλοκαιρινές Β/ΒΑ μέρες.',
    },
    shelteredHeading: { en: 'Coves here that stay calm in the meltemi', gr: 'Σταθερά προστατευμένες παραλίες εδώ στα μελτέμια', de: 'Buchten hier, die beim Meltemi ruhig bleiben', it: 'Cale qui che restano calme con il meltemi', fr: 'Criques ici qui restent calmes au meltemi' },
    sourceNote: { en: 'Based on each cove’s coastline orientation to the N/NE — a seasonal guide, not today’s forecast.', gr: 'Βάσει του προσανατολισμού της ακτής κάθε όρμου στον Β/ΒΑ — εποχικός οδηγός, όχι η σημερινή πρόγνωση.', de: 'Basierend auf der N/NO-Ausrichtung jeder Bucht — ein saisonaler Hinweis, keine heutige Vorhersage.', it: "In base all'orientamento della costa di ogni cala verso N/NE — una guida stagionale, non la previsione di oggi.", fr: "D'après l'orientation de chaque crique vers le N/NE — un repère saisonnier, pas la prévision du jour." },
  },
  ionian: {
    title: { en: 'Usually in the maistros', gr: 'Συνήθως στον μαΐστρο', de: 'Normalerweise beim Maistros', it: 'Di solito con il maestrale', fr: 'Habituellement par le maïstro' },
    intro: {
      en: 'The maistros is the NW/W wind that picks up on summer afternoons in the Ionian — the best guide to how a beach usually behaves from June to September.',
      gr: 'Ο μαΐστρος είναι ο ΒΔ/Δ άνεμος που σηκώνεται τα καλοκαιρινά απογεύματα στο Ιόνιο — ο πιο αξιόπιστος οδηγός για το πώς συμπεριφέρεται συνήθως μια παραλία από τον Ιούνιο ως τον Σεπτέμβριο.',
      de: 'Der Maistros ist der NW/W-Wind, der an Sommernachmittagen im Ionischen Meer aufkommt — der beste Hinweis darauf, wie sich ein Strand von Juni bis September meist verhält.',
      it: 'Il maestrale è il vento da NO/O che si alza nei pomeriggi estivi nello Ionio — la guida migliore su come si comporta di solito una spiaggia da giugno a settembre.',
      fr: "Le maïstro est le vent de NO/O qui se lève les après-midis d'été en mer Ionienne — le meilleur indice du comportement habituel d'une plage de juin à septembre.",
    },
    status: {
      protected: { en: 'usually stays sheltered when the maistros blows.', gr: 'συνήθως μένει προστατευμένη όταν φυσά μαΐστρος.', de: 'bleibt beim Maistros meist windgeschützt.', it: 'di solito resta riparata quando soffia il maestrale.', fr: 'reste généralement abritée quand le maïstro souffle.' },
      partial:   { en: 'has partial shelter in the maistros — calm some days, choppy on stronger ones.', gr: 'έχει μερική προστασία στον μαΐστρο — κάποιες μέρες ήρεμη, με κυματάκι όταν δυναμώνει.', de: 'ist beim Maistros teils exponiert — mal ruhig, bei stärkerem Wind kabbelig.', it: 'è in parte esposta al maestrale — calma certi giorni, mossa nei più forti.', fr: 'est en partie exposée au maïstro — calme certains jours, agitée par vent fort.' },
      exposed:   { en: 'is exposed in the maistros — often choppy on summer NW/W afternoons.', gr: 'είναι εκτεθειμένη στον μαΐστρο — συχνά με κύμα τα καλοκαιρινά ΒΔ/Δ απογεύματα.', de: 'ist beim Maistros exponiert — an NW/W-Sommernachmittagen oft kabbelig.', it: 'è esposta al maestrale — spesso mossa nei pomeriggi estivi da NO/O.', fr: "est exposée au maïstro — souvent agitée les après-midis d'été de NO/O." },
    },
    statusBoatGr: {
      protected: 'συνήθως μένει προστατευμένο όταν φυσά μαΐστρος.',
      partial: 'έχει μερική προστασία στον μαΐστρο — κάποιες μέρες ήρεμο, με κυματάκι όταν δυναμώνει.',
      exposed: 'είναι εκτεθειμένο στον μαΐστρο — συχνά με κύμα τα καλοκαιρινά ΒΔ/Δ απογεύματα.',
    },
    shelteredHeading: { en: 'Coves here that stay calm in the maistros', gr: 'Σταθερά προστατευμένες παραλίες εδώ στον μαΐστρο', de: 'Buchten hier, die beim Maistros ruhig bleiben', it: 'Cale qui che restano calme con il maestrale', fr: 'Criques ici qui restent calmes au maïstro' },
    sourceNote: { en: "Based on each cove’s coastline orientation to the NW/W — a seasonal guide, not today’s forecast.", gr: 'Βάσει του προσανατολισμού της ακτής κάθε όρμου στον ΒΔ/Δ — εποχικός οδηγός, όχι η σημερινή πρόγνωση.', de: 'Basierend auf der NW/W-Ausrichtung jeder Bucht — ein saisonaler Hinweis, keine heutige Vorhersage.', it: "In base all'orientamento della costa di ogni cala verso NO/O — una guida stagionale, non la previsione di oggi.", fr: "D'après l'orientation de chaque crique vers le NO/O — un repère saisonnier, pas la prévision du jour." },
  },
  thermaic: {
    title: { en: 'Usually in the summer wind', gr: 'Συνήθως στον καλοκαιρινό αέρα', de: 'Normalerweise beim Sommerwind', it: 'Di solito con il vento estivo', fr: "Habituellement par le vent d'été" },
    intro: {
      en: 'The afternoon NW/W summer wind on the Thermaic Gulf is the best guide to how a beach usually behaves in summer.',
      gr: 'Ο απογευματινός ΒΔ/Δ καλοκαιρινός αέρας στον Θερμαϊκό είναι ο πιο αξιόπιστος οδηγός για το πώς συμπεριφέρεται συνήθως μια παραλία το καλοκαίρι.',
      de: 'Der nachmittägliche NW/W-Sommerwind am Thermaischen Golf ist der beste Hinweis darauf, wie sich ein Strand im Sommer meist verhält.',
      it: 'Il vento estivo pomeridiano da NO/O nel Golfo Termaico è la guida migliore su come si comporta di solito una spiaggia in estate.',
      fr: "Le vent d'été de NO/O de l'après-midi dans le golfe Thermaïque est le meilleur indice du comportement habituel d'une plage en été.",
    },
    status: {
      protected: { en: 'usually stays sheltered in the summer wind.', gr: 'συνήθως μένει προστατευμένη στον καλοκαιρινό αέρα.', de: 'bleibt beim Sommerwind meist windgeschützt.', it: 'di solito resta riparata con il vento estivo.', fr: "reste généralement abritée par le vent d'été." },
      partial:   { en: 'has partial shelter in the summer wind — calm some days, choppy on stronger ones.', gr: 'έχει μερική προστασία στον καλοκαιρινό αέρα — κάποιες μέρες ήρεμη, με κυματάκι όταν δυναμώνει.', de: 'ist beim Sommerwind teils exponiert — mal ruhig, bei stärkerem Wind kabbelig.', it: 'è in parte esposta al vento estivo — calma certi giorni, mossa nei più forti.', fr: "est en partie exposée au vent d'été — calme certains jours, agitée par vent fort." },
      exposed:   { en: 'is exposed in the summer wind — often choppy on NW/W afternoons.', gr: 'είναι εκτεθειμένη στον καλοκαιρινό αέρα — συχνά με κύμα τα ΒΔ/Δ απογεύματα.', de: 'ist beim Sommerwind exponiert — an NW/W-Nachmittagen oft kabbelig.', it: 'è esposta al vento estivo — spesso mossa nei pomeriggi da NO/O.', fr: "est exposée au vent d'été — souvent agitée les après-midis de NO/O." },
    },
    statusBoatGr: {
      protected: 'συνήθως μένει προστατευμένο στον καλοκαιρινό αέρα.',
      partial: 'έχει μερική προστασία στον καλοκαιρινό αέρα — κάποιες μέρες ήρεμο, με κυματάκι όταν δυναμώνει.',
      exposed: 'είναι εκτεθειμένο στον καλοκαιρινό αέρα — συχνά με κύμα τα ΒΔ/Δ απογεύματα.',
    },
    shelteredHeading: { en: 'Coves here that stay calm in the summer wind', gr: 'Σταθερά προστατευμένες παραλίες εδώ στον καλοκαιρινό αέρα', de: 'Buchten hier, die beim Sommerwind ruhig bleiben', it: 'Cale qui che restano calme con il vento estivo', fr: "Criques ici qui restent calmes au vent d'été" },
    sourceNote: { en: "Based on each cove’s coastline orientation to the NW/W — a seasonal guide, not today’s forecast.", gr: 'Βάσει του προσανατολισμού της ακτής κάθε όρμου στον ΒΔ/Δ — εποχικός οδηγός, όχι η σημερινή πρόγνωση.', de: 'Basierend auf der NW/W-Ausrichtung jeder Bucht — ein saisonaler Hinweis, keine heutige Vorhersage.', it: "In base all'orientamento della costa di ogni cala verso NO/O — una guida stagionale, non la previsione di oggi.", fr: "D'après l'orientation de chaque crique vers le NO/O — un repère saisonnier, pas la prévision du jour." },
  },
};
export const localWindSectionFor = regionId => LOCAL_WIND_SECTION[getRegionWindContext(regionId)];
