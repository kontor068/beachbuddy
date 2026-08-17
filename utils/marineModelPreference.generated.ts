/**
 * ΠΑΡΑΓΟΜΕΝΟ ΑΡΧΕΙΟ — μην το γράψεις με το χέρι.
 * Φτιάχνεται από: node scripts/bakeMarineModelPreference.mjs
 *
 * Ποια σημεία πρόγνωσης πρέπει να διαβάζονται από ΑΛΛΟ μοντέλο κύματος από το προεπιλεγμένο.
 * Το «γιατί» ζει ολόκληρο στον παραγωγό και στο utils/marineForecastParsing. Σε δύο γραμμές:
 * το ewam κερδίζει παντού επειδή μετρήθηκε καλύτερο σε 9.723 ώρες σημαδούρας, ΑΛΛΑ σε 57
 * σημεία το κελί του περιγράφει νερό που η παραλία δεν βλέπει ενώ του meteofrance_wave όχι.
 * Οι 15 περιπτώσεις όπου το meteofrance θα έχανε τη διάκριση των δύο ακτών ΔΕΝ μπαίνουν εδώ.
 */
export type MarineModelId = 'ewam' | 'meteofrance_wave';

/** Κλειδί: `${lat.toFixed(3)}_${lon.toFixed(3)}` του σημείου που ζητείται από το Open-Meteo. */
export const MARINE_MODEL_PREFERENCE: Readonly<Record<string, MarineModelId>> = Object.freeze({
  '37.657_24.094': 'meteofrance_wave', // #71 Πούντα Ζέζα (attica-east-attica-mainland) — safe
  '37.373_23.462': 'meteofrance_wave', // #105 Μανδράκι (attica-hydra) — safe
  '37.966_23.548': 'meteofrance_wave', // #182 Παραλία Περάματος (attica-piraeus-area) — safe
  '37.984_24.442': 'meteofrance_wave', // #220 Ελιά (central-greece-evia) — both-smeared
  '38.072_24.285': 'meteofrance_wave', // #256 Μεγάλη Άμμος (central-greece-evia) — both-smeared
  '38.879_22.965': 'meteofrance_wave', // #291 Πόρτο Πεύκο (central-greece-evia) — safe
  '38.937_24.460': 'meteofrance_wave', // #324 Πετρίτσα (central-greece-skyros) — both-smeared
  '40.044_23.773': 'meteofrance_wave', // #390 Diaporti (central-macedonia-halkidiki-mainland) — both-smeared
  '39.995_23.861': 'meteofrance_wave', // #418 Likithos (central-macedonia-halkidiki-mainland) — both-smeared
  '39.355_20.271': 'meteofrance_wave', // #896 Ζαβία (epirus-thesprotia-mainland) — both-smeared
  '39.362_20.230': 'meteofrance_wave', // #906 Πάνα (epirus-thesprotia-mainland) — both-smeared
  '39.441_20.202': 'meteofrance_wave', // #920 Πισίνα (epirus-thesprotia-mainland) — both-smeared
  '38.206_20.438': 'meteofrance_wave', // #1108 Λυγιά Φάρσων (ionian-islands-kefalonia) — safe
  '38.315_25.953': 'meteofrance_wave', // #1275 Ποταμοί (north-aegean-chios) — safe
  '37.533_26.442': 'meteofrance_wave', // #1315 Πετροκόπι (north-aegean-fournoi) — safe
  '37.552_26.455': 'meteofrance_wave', // #1317 Καμπί (north-aegean-fournoi) — safe
  '39.850_25.087': 'meteofrance_wave', // #1437 Κόκκινα (βόρειος όρμος) (north-aegean-lemnos) — safe
  '37.442_23.070': 'meteofrance_wave', // #1492 Παραλία Φούρνων (peloponnese-argolida-mainland) — safe
  '36.776_21.799': 'meteofrance_wave', // #1618 Καντούνι (peloponnese-messinia-mainland) — safe
  '36.879_25.894': 'meteofrance_wave', // #1658 Άγιος Παύλος (south-aegean-amorgos) — both-smeared
  '37.721_24.350': 'meteofrance_wave', // #1825 Οτζιάς (south-aegean-kea) — safe
  '37.356_24.454': 'meteofrance_wave', // #1859 Άγιος Ιωάννης (south-aegean-kythnos) — safe
  '37.374_24.458': 'meteofrance_wave', // #1861 Άγιος Στέφανος (south-aegean-kythnos) — safe
  '37.358_24.485': 'meteofrance_wave', // #1864 Αγκορίτσα (south-aegean-kythnos) — safe
  '36.707_24.429': 'meteofrance_wave', // #1903 Αχιβαδολίμνη (south-aegean-milos) — both-smeared
  '36.708_24.440': 'meteofrance_wave', // #1917 Παπικινού (south-aegean-milos) — both-smeared
  '37.384_25.316': 'meteofrance_wave', // #1941 Αγία Άννα Παράγκας (south-aegean-mykonos) — safe
  '37.054_25.335': 'meteofrance_wave', // #2006 Μικρή Βίγλα (south-aegean-naxos) — safe
  '36.940_25.526': 'meteofrance_wave', // #2015 Παραλία Σπεδό (south-aegean-naxos) — safe
  '37.088_25.070': 'meteofrance_wave', // #2020 Αγία Ειρήνη (south-aegean-paros) — safe
  '37.127_25.225': 'meteofrance_wave', // #2034 Λίμνες (south-aegean-paros) — both-smeared
  '37.134_24.577': 'meteofrance_wave', // #2071 Άγιος Σώστης (south-aegean-serifos) — safe
  '37.121_24.519': 'meteofrance_wave', // #2074 Αυλόμωνας (south-aegean-serifos) — safe
  '37.129_24.431': 'meteofrance_wave', // #2076 Βάγια (south-aegean-serifos) — both-smeared
  '37.104_24.420': 'meteofrance_wave', // #2078 Γάνεμα (south-aegean-serifos) — safe
  '37.209_24.433': 'meteofrance_wave', // #2082 Καραβάς (south-aegean-serifos) — safe
  '37.112_24.455': 'meteofrance_wave', // #2085 Κουτάλας (south-aegean-serifos) — both-smeared
  '37.127_24.529': 'meteofrance_wave', // #2087 Λιβαδάκια (south-aegean-serifos) — safe
  '36.892_24.753': 'meteofrance_wave', // #2113 Φασολού (south-aegean-sifnos) — safe
  '37.343_24.941': 'meteofrance_wave', // #2131 Αχλάδι (south-aegean-syros) — safe
  '37.457_24.841': 'meteofrance_wave', // #2135 Δελφίνι (south-aegean-syros) — safe
  '37.357_24.853': 'meteofrance_wave', // #2148 Φοίνικας (south-aegean-syros) — safe
  '36.936_25.550': 'meteofrance_wave', // #2194 Αφρυανιά (south-aegean-koufonisia) — both-smeared
  '36.944_25.561': 'meteofrance_wave', // #2202 Λίμνη Κάτω Κουφονησίου (south-aegean-koufonisia) — both-smeared
  '37.428_26.960': 'meteofrance_wave', // #2226 Γαδουρόλακκος (south-aegean-agathonisi) — safe
  '36.544_26.374': 'meteofrance_wave', // #2233 Άγιος Κωνσταντίνος (south-aegean-astypalaia) — both-smeared
  '36.619_26.384': 'meteofrance_wave', // #2249 Ψιλή Άμμος (south-aegean-astypalaia) — safe
  '36.958_27.060': 'meteofrance_wave', // #2253 Χαλί (south-aegean-kalymnos) — safe
  '37.042_27.032': 'meteofrance_wave', // #2270 Παραλία Σική (south-aegean-kalymnos) — both-smeared
  '37.202_26.814': 'meteofrance_wave', // #2367 Παραλία Μπλεφούτης (south-aegean-leros) — safe
  '37.297_26.733': 'meteofrance_wave', // #2377 Λεντού (south-aegean-lipsi) — both-smeared
  '39.179_23.932': 'meteofrance_wave', // #2586 Βασίλη Μπαμπακιές (thessaly-alonissos) — safe
  '39.199_23.946': 'meteofrance_wave', // #2588 Γλυφά (thessaly-alonissos) — safe
  '39.192_23.949': 'meteofrance_wave', // #2591 Καλύβια Σταματίου (thessaly-alonissos) — safe
  '39.133_23.853': 'meteofrance_wave', // #2601 Παραλία Βότση (thessaly-alonissos) — both-smeared
  '39.148_23.928': 'meteofrance_wave', // #2612 Τζώρτζη (thessaly-alonissos) — both-smeared
  '36.545_22.355': 'meteofrance_wave', // #3091 Παραλία Κάτω Μέζαπος (peloponnese-lakonia-mainland) — safe
});

/** Πόσα σημεία απέκλεισε ο έλεγχος «μουτζούρας» — για την πύλη, ώστε να μη σβήσει σιωπηλά. */
export const MARINE_MODEL_PREFERENCE_SKIPPED = 15;
