const hasGreekText = (value?: string): boolean => /[\u0370-\u03ff]/.test(value || '');

const normalizeGreekFinalSigma = (text: string): string =>
  text.replace(/σ(?=([\s)\],.:;!?»"']|$))/g, 'ς');

const stripBeachAffixes = (value: string): string => {
  const original = value.trim().replace(/\s+/g, ' ');
  if (!original) return '';

  const withoutPrefix = original.replace(/^(paralia|akti|ormos|beach|plaz)\s+/i, '').trim();
  const withoutSuffix = withoutPrefix
    .replace(/[,.\s-]+(beach bar|beach club|beach|bay|bar|club|resort|hotel|camping|canteen|kantina|taverna|studios|suites|apartments|villas|paralia|akti|ormos|plaz|strand)$/i, '')
    .trim();

  return withoutSuffix || original;
};

const normalizeLookupKey = (value: string): string =>
  stripBeachAffixes(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const VERIFIED_GREEK_BEACH_NAMES: Record<string, string> = {
  // High-confidence corrections for current app-ready beach names stored as Latin/Greeklish.
  abelakia: 'Αμπελάκια',
  achlada: 'Αχλάδα',
  afrata: 'Αφράτα',
  afrathia: 'Αφραθιά',
  agridia: 'Αγρίδια',
  agrapidia: 'Αγραπιδιά',
  'agias triades': 'Αγίας Τριάδας',
  'agios georgios': 'Άγιος Γεώργιος',
  'agios nikolaos': 'Άγιος Νικόλαος',
  'agios onoufrios': 'Άγιος Ονούφριος',
  agni: 'Αγνή',
  'akti kalogrias': 'Ακτή Καλογριάς',
  alipa: 'Άλιπα',
  alonaki: 'Αλωνάκι',
  alyki: 'Αλυκή',
  'alykes kitrous': 'Αλυκές Κίτρους',
  ammos: 'Άμμος',
  aptera: 'Άπτερα',
  aretsou: 'Αρετσού',
  artolithia: 'Αρτολίθια',
  'aspri limni': 'Άσπρη Λίμνη',
  athiki: 'Αθίκι',
  astropelekita: 'Αστροπελεκητά',
  balos: 'Μπάλος',
  benitses: 'Μπενίτσες',
  bouka: 'Μπούκα',
  'chrysi akti': 'Χρυσή Ακτή',
  'chrysi ammoudia': 'Χρυσή Αμμουδιά',
  dafnila: 'Δαφνίλα',
  dassia: 'Δασιά',
  diaporti: 'Διαπόρτι',
  'dimotiki plaz 1': 'Δημοτική Πλαζ 1',
  'dimotiki plaz 2': 'Δημοτική Πλαζ 2',
  'dimotiki plaz 3': 'Δημοτική Πλαζ 3',
  drenia: 'Δρένια',
  elafonisi: 'Ελαφονήσι',
  faka: 'Φάκα',
  falasarna: 'Φαλάσαρνα',
  finikas: 'Φοίνικας',
  foniadiko: 'Φωνιαδικό',
  galiskari: 'Γαλισκάρι',
  'gero aggeli': 'Γέρο Αγγέλι',
  georgioupoli: 'Γεωργιούπολη',
  'giatrou tsairi': 'Γιατρού Τσαΐρι',
  glyfa: 'Γλύφα',
  grammeno: 'Γραμμένο',
  griavas: 'Γριάβας',
  hara: 'Χαρά',
  hanioti: 'Χανιώτη',
  iliovasilema: 'Ηλιοβασίλεμα',
  ilingas: 'Ίλιγγας',
  imerolia: 'Ημερολιά',
  issos: 'Ίσσος',
  kakoudia: 'Κακούδια',
  kalami: 'Καλάμι',
  kalamionas: 'Καλαμιώνας',
  kalamitsi: 'Καλαμίτσι',
  kalathas: 'Καλαθάς',
  kallithea: 'Καλλιθέα',
  kalopigado: 'Καλοπήγαδο',
  'kalo avlaki': 'Καλό Αυλάκι',
  kalyves: 'Καλύβες',
  kaminaki: 'Καμινάκι',
  kanoni: 'Κανόνι',
  karagatsia: 'Καραγάτσια',
  karavi: 'Καράβι',
  katharos: 'Καθαρός',
  kavouri: 'Καβούρι',
  kavourotrypes: 'Καβουρότρυπες',
  kedrodasos: 'Κεδρόδασος',
  kefalas: 'Κεφαλάς',
  kera: 'Κερά',
  klimataria: 'Κληματαριά',
  kogevina: 'Κογεβίνα',
  komitsa: 'Κομίτσα',
  'kryfos paradeisos': 'Κρυφός Παράδεισος',
  'kyani akti': 'Κυανή Ακτή',
  lagomandra: 'Λαγόμανδρα',
  lemos: 'Λαιμός',
  likithos: 'Λήκυθος',
  lilikas: 'Λιλικάς',
  limanaki: 'Λιμανάκι',
  limani: 'Λιμάνι',
  linaraki: 'Λιναράκι',
  livadi: 'Λιβάδι',
  maltas: 'Μάλτας',
  marathias: 'Μαραθιάς',
  'megali ammos': 'Μεγάλη Άμμος',
  'mikri elia': 'Μικρή Ελιά',
  milies: 'Μηλιές',
  'monastiraki': 'Μοναστηράκι',
  mongonisi: 'Μογγονήσι',
  moraitika: 'Μωραΐτικα',
  mirtia: 'Μυρτιά',
  'mylos': 'Μύλος',
  myti: 'Μύτη',
  'nea michaniona': 'Νέα Μηχανιώνα',
  'nea vrasna': 'Νέα Βρασνά',
  nissaki: 'Νησάκι',
  'ormos mikri vichlada': 'Όρμος Μικρή Βλυχάδα',
  ouranoupoli: 'Ουρανούπολη',
  panteleimonas: 'Παντελεήμονας',
  paradisos: 'Παράδεισος',
  paramonas: 'Παραμόνας',
  patoma: 'Πάτωμα',
  pefkochori: 'Πευκοχώρι',
  peraia: 'Περαία',
  plakotos: 'Πλακωτός',
  'plagia flogita': 'Πλάγια Φλογητά',
  platania: 'Πλατάνια',
  platanitsi: 'Πλατανίτσι',
  psakoudia: 'Ψακούδια',
  pydna: 'Πύδνα',
  'porto koufo': 'Πόρτο Κουφό',
  sarti: 'Σάρτη',
  'santa barbara': 'Σάντα Μπάρμπαρα',
  skalia: 'Σκαλιά',
  skotina: 'Σκοτίνα',
  sykia: 'Συκιά',
  tigania: 'Τηγάνια',
  tourkolimnionas: 'Τουρκολιμνιώνας',
  trapezi: 'Τραπέζι',
  'trani ammouda': 'Τρανή Αμμούδα',
  tsaska: 'Τσάσκα',
  tsifliki: 'Τσιφλίκι',
  vali: 'Βαλί',
  valti: 'Βάλτι',
  varkes: 'Βάρκες',
  velonas: 'Βελόνας',
  'voreas limani': 'Βόρειο Λιμάνι',
  voulitsa: 'Βουλίτσα',
  vourvourou: 'Βουρβουρού',
};

export const getVerifiedGreekBeachName = (value?: string): string | undefined => {
  const input = value?.trim();
  if (!input) return undefined;
  if (hasGreekText(input)) return normalizeGreekFinalSigma(input);

  const directKey = input.toLowerCase();
  const direct = VERIFIED_GREEK_BEACH_NAMES[directKey];
  if (direct) return normalizeGreekFinalSigma(direct);

  const normalized = VERIFIED_GREEK_BEACH_NAMES[normalizeLookupKey(input)];
  return normalized ? normalizeGreekFinalSigma(normalized) : undefined;
};

export const getGreekBeachNameDisplay = (primary?: string, fallback?: string): string => {
  const verified = getVerifiedGreekBeachName(primary) || getVerifiedGreekBeachName(fallback);
  return verified || primary?.trim() || fallback?.trim() || '';
};
