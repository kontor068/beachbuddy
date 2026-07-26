// Copy for the multi-day trip planner. Co-located (same pattern as
// components/landing/landingCopy.ts) rather than swelling translations.ts.
//
// Voice rules learned the hard way on this project: state facts, never claim
// our own honesty, and never promise more than the forecast carries. A blank
// day says WHY and points at the next good one — it does not invent an
// activity we know nothing about.

export type TripPlannerCopy = {
  prompt: string;
  promptDays: (n: number) => string;
  moreDays: string;
  title: string;
  change: string;
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
  reasons: {
    too_windy: string;
    storm: string;
    rain: string;
    no_match: string;
  };
  seaSettles: (day: string) => string;
  beyondHorizon: (n: number) => string;
};

export const tripPlannerCopy: Record<'en' | 'gr', TripPlannerCopy> = {
  gr: {
    prompt: 'Μένεις περισσότερες μέρες;',
    promptDays: (n) => `${n} μέρες`,
    moreDays: 'Περισσότερες',
    title: 'Το πλάνο σου',
    change: 'Αλλαγή',
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
    promptDays: (n) => `${n} days`,
    moreDays: 'More',
    title: 'Your plan',
    change: 'Change',
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
    reasons: {
      too_windy: 'Blowing hard — nowhere here is sheltered.',
      storm: 'Storm. Not a beach day.',
      rain: 'Rain for most of the day.',
      no_match: 'Nothing here is worth the trip today.',
    },
    seaSettles: (day) => `The sea settles again on ${day}.`,
    beyondHorizon: (n) => `We have no forecast yet for the other ${n === 1 ? 'day' : `${n} days`} — we'll know closer to the time.`,
  },
};
