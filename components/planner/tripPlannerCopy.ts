// Copy for the multi-day trip planner. Co-located (same pattern as
// components/landing/landingCopy.ts) rather than swelling translations.ts.
// ALL FIVE LANGUAGES ARE AUTHORED HERE — the Record<LanguageCode, …> type
// makes tsc fail until they all exist, which is the point. Formality follows
// the landing convention: de → du, it → tu, fr → vous, en/gr second person.
//
// Voice rules learned the hard way on this project: state facts, never claim
// our own honesty, and never promise more than the forecast carries. A blank
// day says WHY and points at the next good one — it does not invent an
// activity we know nothing about.
//
// The exposure vocabulary (Προστατευμένη / Μερική προστασία / Εκτεθειμένη)
// is copied VERBATIM from the map's labels (components/BeachMap.tsx) — one
// vocabulary across strip, pin and card, never synonyms.

import type { LanguageCode, WindSector } from '../../types';

export type TripPlannerCopy = {
  prompt: string;
  title: string;
  clear: string;
  today: string;
  tomorrow: string;
  provisional: string;
  provisionalNote: string;
  repeat: string;
  alternative: (name: string) => string;
  windUnit: string;
  /** Shown instead of a calm claim when the pick came from the caution tier. */
  cautionBadge: string;
  cautionNote: string;
  /** Badge for a weather-refuge pick from outside the trip's essentials. */
  refugeBadge: string;
  /** One-line footnote explaining what a refuge day is. */
  refugeNote: string;
  /** The plan follows the forecast — say so instead of pretending stability. */
  planUpdatesDaily: string;
  /** "from the north" etc. — adverbial, slots into the why sentences. */
  windFrom: Record<WindSector, string>;
  /** The per-day "why this beach" line, keyed by TripWhyKey. */
  why: {
    calm_everywhere: string;
    cove_refuge: (windFrom: string) => string;
    sheltered: (windFrom: string) => string;
    partial_shelter: (windFrom: string) => string;
    best_available: (windFrom: string, beaufort: number) => string;
  };
  /** Appended to the why line on provisional days — the direction is a guess. */
  ifWindHolds: string;
  reasons: {
    too_windy: string;
    storm: string;
    rain: string;
    no_match: string;
  };
  seaSettles: (day: string) => string;
  beyondHorizon: (n: number) => string;
};

export const tripPlannerCopy: Record<LanguageCode, TripPlannerCopy> = {
  gr: {
    prompt: 'Μένεις περισσότερες μέρες;',
    title: 'Το πλάνο σου',
    clear: 'Κλείσιμο',
    today: 'Σήμερα',
    tomorrow: 'Αύριο',
    provisional: 'προσωρινό',
    provisionalNote: 'Από την 4η μέρα και μετά η πρόγνωση αλλάζει — τσέκαρε ξανά πιο κοντά.',
    repeat: 'ξανά',
    alternative: (name) => `ή ${name}`,
    windUnit: 'μποφόρ',
    cautionBadge: 'με κύμα',
    cautionNote: 'Οι μέρες «με κύμα» δεν είναι ήρεμες — είναι η καλύτερη επιλογή μιας δύσκολης μέρας. Θέλει άνεση στο κολύμπι.',
    refugeBadge: 'απάγκιο',
    refugeNote: 'Όπου καμία από τις γνωστές παραλίες δεν κάνει με τον άνεμο της μέρας, προτείνεται ένα προστατευμένο απάγκιο εκτός λίστας.',
    planUpdatesDaily: 'Το πλάνο ξαναϋπολογίζεται κάθε μέρα με τη νέα πρόγνωση — οι μακρινές μέρες μπορεί να αλλάξουν.',
    windFrom: {
      N: 'από βορρά', NE: 'από βορειοανατολικά', E: 'από ανατολικά', SE: 'από νοτιοανατολικά',
      S: 'από νότο', SW: 'από νοτιοδυτικά', W: 'από δυτικά', NW: 'από βορειοδυτικά',
    },
    why: {
      calm_everywhere: 'Ήπιος άνεμος — ήρεμα σχεδόν παντού· η καλύτερη συνολικά επιλογή.',
      cove_refuge: (windFrom) => `Κλειστός όρμος — ο αέρας ${windFrom} δεν μπαίνει.`,
      sheltered: (windFrom) => `Προστατευμένη ${windFrom} — πιο ήρεμη από την εκτεθειμένη πλευρά, αλλά με λίγο αέρα κι εδώ.`,
      partial_shelter: (windFrom) => `Μερική προστασία ${windFrom} — θα έχει κάποιο κύμα.`,
      best_available: (windFrom, beaufort) => `Η πιο ήρεμη επιλογή για μέρα ${beaufort} μποφόρ ${windFrom} — αέρας και κύμα.`,
    },
    ifWindHolds: 'αν κρατήσει ο άνεμος από εκεί.',
    reasons: {
      too_windy: 'Φυσάει δυνατά — καμία παραλία εδώ δεν είναι προστατευμένη.',
      storm: 'Θύελλα. Όχι μέρα για θάλασσα.',
      rain: 'Βροχή το μεγαλύτερο μέρος της ημέρας.',
      no_match: 'Δεν βρήκαμε παραλία που να αξίζει σήμερα.',
    },
    seaSettles: (day) => `Η θάλασσα ησυχάζει ξανά ${day}.`,
    beyondHorizon: (n) => `Για τις υπόλοιπες ${n === 1 ? 'μέρα' : `${n} μέρες`} δεν υπάρχει ακόμη πρόγνωση — θα το ξέρουμε πιο κοντά.`,
  },
  en: {
    prompt: 'Staying a few days?',
    title: 'Your plan',
    clear: 'Close',
    today: 'Today',
    tomorrow: 'Tomorrow',
    provisional: 'provisional',
    provisionalNote: 'From day 4 the forecast still moves — check again closer to the day.',
    repeat: 'again',
    alternative: (name) => `or ${name}`,
    windUnit: 'Beaufort',
    cautionBadge: 'choppy',
    cautionNote: 'A “choppy” day is not a calm one — it is the best of a hard day, and it wants a confident swimmer.',
    refugeBadge: 'wind refuge',
    refugeNote: 'When none of the well-known beaches works with the day’s wind, a sheltered refuge from outside the list steps in.',
    planUpdatesDaily: 'The plan is recalculated every day with the fresh forecast — the later days can change.',
    windFrom: {
      N: 'from the north', NE: 'from the northeast', E: 'from the east', SE: 'from the southeast',
      S: 'from the south', SW: 'from the southwest', W: 'from the west', NW: 'from the northwest',
    },
    why: {
      calm_everywhere: 'Light wind — calm almost everywhere; the best all-round choice.',
      cove_refuge: (windFrom) => `A closed cove — the wind ${windFrom} does not get in.`,
      sheltered: (windFrom) => `Sheltered ${windFrom} — calmer than the exposed side, with a little wind even here.`,
      partial_shelter: (windFrom) => `Partial shelter ${windFrom} — expect some chop.`,
      best_available: (windFrom, beaufort) => `The calmest option on a ${beaufort} Beaufort day ${windFrom} — wind and waves.`,
    },
    ifWindHolds: 'if the wind holds from that direction.',
    reasons: {
      too_windy: 'Blowing hard — nowhere here is sheltered.',
      storm: 'Storm. Not a beach day.',
      rain: 'Rain for most of the day.',
      no_match: 'Nothing here is worth the trip today.',
    },
    seaSettles: (day) => `The sea settles again on ${day}.`,
    beyondHorizon: (n) => `We have no forecast yet for the other ${n === 1 ? 'day' : `${n} days`} — we'll know closer to the time.`,
  },
  de: {
    prompt: 'Bleibst du mehrere Tage?',
    title: 'Dein Plan',
    clear: 'Schließen',
    today: 'Heute',
    tomorrow: 'Morgen',
    provisional: 'vorläufig',
    provisionalNote: 'Ab Tag 4 bewegt sich die Vorhersage noch — schau näher am Tag noch einmal nach.',
    repeat: 'erneut',
    alternative: (name) => `oder ${name}`,
    windUnit: 'Beaufort',
    cautionBadge: 'kabbelig',
    cautionNote: 'Ein „kabbeliger“ Tag ist kein ruhiger — er ist die beste Option eines schwierigen Tages und verlangt sicheres Schwimmen.',
    refugeBadge: 'Windschutz',
    refugeNote: 'Wenn keiner der bekannten Strände zum Wind des Tages passt, springt ein geschützter Platz außerhalb der Liste ein.',
    planUpdatesDaily: 'Der Plan wird jeden Tag mit der frischen Vorhersage neu berechnet — die späteren Tage können sich ändern.',
    windFrom: {
      N: 'aus Norden', NE: 'aus Nordosten', E: 'aus Osten', SE: 'aus Südosten',
      S: 'aus Süden', SW: 'aus Südwesten', W: 'aus Westen', NW: 'aus Nordwesten',
    },
    why: {
      calm_everywhere: 'Leichter Wind — fast überall ruhig; die beste Wahl insgesamt.',
      cove_refuge: (windFrom) => `Eine geschlossene Bucht — der Wind ${windFrom} kommt nicht hinein.`,
      sheltered: (windFrom) => `Geschützt vor Wind ${windFrom} — ruhiger als die exponierte Seite, mit etwas Wind auch hier.`,
      partial_shelter: (windFrom) => `Teilweise geschützt vor Wind ${windFrom} — mit etwas Welle ist zu rechnen.`,
      best_available: (windFrom, beaufort) => `Die ruhigste Option an einem Tag mit ${beaufort} Beaufort ${windFrom} — Wind und Wellen.`,
    },
    ifWindHolds: 'falls der Wind aus dieser Richtung bleibt.',
    reasons: {
      too_windy: 'Es weht stark — kein Strand hier ist geschützt.',
      storm: 'Sturm. Kein Strandtag.',
      rain: 'Regen über weite Teile des Tages.',
      no_match: 'Heute lohnt sich hier kein Strand.',
    },
    seaSettles: (day) => `Das Meer beruhigt sich wieder am ${day}.`,
    beyondHorizon: (n) => `Für ${n === 1 ? 'den weiteren Tag' : `die weiteren ${n} Tage`} gibt es noch keine Vorhersage — wir wissen es näher am Termin.`,
  },
  it: {
    prompt: 'Ti fermi più giorni?',
    title: 'Il tuo piano',
    clear: 'Chiudi',
    today: 'Oggi',
    tomorrow: 'Domani',
    provisional: 'provvisorio',
    provisionalNote: 'Dal 4° giorno la previsione può ancora cambiare — ricontrolla più vicino alla data.',
    repeat: 'di nuovo',
    alternative: (name) => `oppure ${name}`,
    windUnit: 'Beaufort',
    cautionBadge: 'mosso',
    cautionNote: 'Un giorno «mosso» non è un giorno calmo — è la scelta migliore di una giornata difficile, e richiede sicurezza nel nuoto.',
    refugeBadge: 'riparo dal vento',
    refugeNote: 'Quando nessuna delle spiagge note funziona con il vento del giorno, entra un riparo protetto fuori lista.',
    planUpdatesDaily: 'Il piano viene ricalcolato ogni giorno con la previsione aggiornata — i giorni più lontani possono cambiare.',
    windFrom: {
      N: 'da nord', NE: 'da nord-est', E: 'da est', SE: 'da sud-est',
      S: 'da sud', SW: 'da sud-ovest', W: 'da ovest', NW: 'da nord-ovest',
    },
    why: {
      calm_everywhere: 'Vento leggero — calmo quasi ovunque; la scelta migliore in assoluto.',
      cove_refuge: (windFrom) => `Una cala chiusa — il vento ${windFrom} non entra.`,
      sheltered: (windFrom) => `Riparata dal vento ${windFrom} — più calma del lato esposto, con un po' di vento anche qui.`,
      partial_shelter: (windFrom) => `Riparo parziale dal vento ${windFrom} — aspettati un po' di onda.`,
      best_available: (windFrom, beaufort) => `L'opzione più calma in una giornata di ${beaufort} Beaufort ${windFrom} — vento e onde.`,
    },
    ifWindHolds: 'se il vento tiene da quella direzione.',
    reasons: {
      too_windy: 'Soffia forte — qui nessuna spiaggia è riparata.',
      storm: 'Tempesta. Non è giornata da spiaggia.',
      rain: 'Pioggia per gran parte della giornata.',
      no_match: 'Oggi qui nessuna spiaggia vale il viaggio.',
    },
    seaSettles: (day) => `Il mare si calma di nuovo ${day}.`,
    beyondHorizon: (n) => `Per ${n === 1 ? "l'altro giorno" : `gli altri ${n} giorni`} non c'è ancora previsione — lo sapremo più vicino alla data.`,
  },
  fr: {
    prompt: 'Vous restez plusieurs jours ?',
    title: 'Votre plan',
    clear: 'Fermer',
    today: "Aujourd'hui",
    tomorrow: 'Demain',
    provisional: 'provisoire',
    provisionalNote: 'À partir du 4e jour, la prévision bouge encore — revérifiez plus près de la date.',
    repeat: 'à nouveau',
    alternative: (name) => `ou ${name}`,
    windUnit: 'Beaufort',
    cautionBadge: 'agitée',
    cautionNote: "Une journée « agitée » n'est pas une journée calme — c'est la meilleure option d'une journée difficile, pour un nageur à l'aise.",
    refugeBadge: 'abri du vent',
    refugeNote: "Quand aucune des plages connues ne convient au vent du jour, un abri protégé hors liste prend le relais.",
    planUpdatesDaily: 'Le plan est recalculé chaque jour avec la prévision fraîche — les jours lointains peuvent changer.',
    windFrom: {
      N: 'du nord', NE: 'du nord-est', E: "de l'est", SE: 'du sud-est',
      S: 'du sud', SW: 'du sud-ouest', W: "de l'ouest", NW: 'du nord-ouest',
    },
    why: {
      calm_everywhere: 'Vent léger — calme presque partout ; le meilleur choix global.',
      cove_refuge: (windFrom) => `Une crique fermée — le vent ${windFrom} n'y entre pas.`,
      sheltered: (windFrom) => `Abritée du vent ${windFrom} — plus calme que le côté exposé, avec un peu de vent ici aussi.`,
      partial_shelter: (windFrom) => `Abri partiel du vent ${windFrom} — attendez-vous à un peu de clapot.`,
      best_available: (windFrom, beaufort) => `L'option la plus calme un jour de ${beaufort} Beaufort ${windFrom} — vent et vagues.`,
    },
    ifWindHolds: 'si le vent tient de cette direction.',
    reasons: {
      too_windy: "Ça souffle fort — aucune plage ici n'est abritée.",
      storm: 'Tempête. Pas un jour de plage.',
      rain: 'Pluie une grande partie de la journée.',
      no_match: "Aujourd'hui, aucune plage ici ne vaut le déplacement.",
    },
    seaSettles: (day) => `La mer se calme à nouveau ${day}.`,
    beyondHorizon: (n) => `Pas encore de prévision pour ${n === 1 ? "l'autre jour" : `les ${n} autres jours`} — nous le saurons plus près de la date.`,
  },
};
