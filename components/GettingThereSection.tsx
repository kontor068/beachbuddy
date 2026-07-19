import React from 'react';
import { Ship, Car, Footprints, MountainSnow, ParkingCircle } from 'lucide-react';
import { Accessibility, Beach, LanguageCode } from '../types';
import { hasBoatOnlyAccess, hasChallengingAccess, hasDirtRoadAccess } from '../utils/access';

/**
 * "Getting there" honest access labels (Tier-1 "now"). The "will I wreck my car / can I
 * even get there" worry is near-universal on an unfamiliar beach, yet the detail page only
 * had a boat-only navigation caveat. We classify access from the same fields the cards use
 * (utils/access.ts + metadata.access) and state it plainly. Crucially we keep the app's
 * honesty discipline: boat/dirt/4x4/hike are conservative cautions (safe to surface), while
 * a bare "easy" with no explicit road type is flagged as an UNVERIFIED default — the access
 * audit found ~30% of "easy access" claims wrong, so we never present it as confirmed.
 * No indexed page states "1.5 km of gravel from the nearest paved road" for a long-tail cove,
 * which is exactly why a summariser can't answer this and we can.
 */

type AccessKind = 'boat' | 'hard' | 'dirt' | 'walk' | 'car' | 'carUnverified';

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

const classify = (beach: Beach): AccessKind | null => {
  const accessType = beach.metadata?.access?.type;
  if (hasBoatOnlyAccess(beach)) return 'boat';
  if (hasChallengingAccess(beach)) return 'hard';
  if (hasDirtRoadAccess(beach)) return 'dirt';
  if (accessType === 'hiking_path_easy') return 'walk';
  // An "asphalt" claim the OSM road audit could not corroborate (nearest paved road far,
  // only a track/footpath nearby) is shown honestly as unverified rather than confident paved.
  if (accessType === 'asphalt_road' && beach.metadata?.access?.roadSurfaceUnverified) return 'carUnverified';
  if (accessType === 'asphalt_road') return 'car';
  if (!accessType && (beach.accessibility === Accessibility.EASY || beach.accessibility === Accessibility.MODERATE)) {
    return 'carUnverified';
  }
  return null;
};

const KIND_TONE: Record<AccessKind, string> = {
  boat: 'border-teal-200 bg-teal-50/60 text-teal-900',
  hard: 'border-orange-200 bg-orange-50/70 text-orange-900',
  dirt: 'border-amber-200 bg-amber-50/70 text-amber-900',
  walk: 'border-sky-200 bg-sky-50/60 text-sky-900',
  car: 'border-emerald-200 bg-emerald-50/60 text-emerald-900',
  carUnverified: 'border-slate-200 bg-slate-50/70 text-slate-800',
};

const KIND_ICON: Record<AccessKind, React.ComponentType<{ className?: string }>> = {
  boat: Ship,
  hard: MountainSnow,
  dirt: Car,
  walk: Footprints,
  car: Car,
  carUnverified: Car,
};

const KIND_LABEL: Record<AccessKind, Copy> = {
  boat: { en: 'Boat access only', gr: 'Πρόσβαση μόνο με σκάφος', de: 'Nur per Boot erreichbar', it: 'Accesso solo via mare', fr: 'Accès uniquement par bateau' },
  hard: { en: 'Difficult access', gr: 'Δύσκολη πρόσβαση', de: 'Schwieriger Zugang', it: 'Accesso difficile', fr: 'Accès difficile' },
  dirt: { en: 'Dirt road', gr: 'Χωματόδρομος', de: 'Schotterstraße', it: 'Strada sterrata', fr: 'Route en terre' },
  walk: { en: 'On foot (path)', gr: 'Πρόσβαση με τα πόδια', de: 'Zu Fuß (Pfad)', it: 'A piedi (sentiero)', fr: 'À pied (sentier)' },
  car: { en: 'Reachable by car', gr: 'Πρόσβαση με αυτοκίνητο', de: 'Mit dem Auto erreichbar', it: 'Raggiungibile in auto', fr: 'Accessible en voiture' },
  carUnverified: { en: 'Likely easy access', gr: 'Μάλλον εύκολη πρόσβαση', de: 'Vermutlich leichter Zugang', it: 'Accesso probabilmente facile', fr: 'Accès probablement facile' },
};

const KIND_DESC: Record<AccessKind, Copy> = {
  boat: {
    en: 'No road in — you need a boat, water taxi, or a swim from the next cove.',
    gr: 'Δεν υπάρχει δρόμος — χρειάζεσαι σκάφος, water taxi ή κολύμπι από διπλανό όρμο.',
    de: 'Keine Straße — Boot, Wassertaxi oder Schwimmen von der Nachbarbucht nötig.',
    it: 'Niente strada — servono barca, taxi-boat o una nuotata dalla cala vicina.',
    fr: "Pas de route — il faut un bateau, un taxi-boat ou nager depuis la crique voisine.",
  },
  hard: {
    en: 'Rough track, steep path or 4x4 ground — plan the last stretch before you set off.',
    gr: 'Δύσβατος δρόμος, απότομο μονοπάτι ή έδαφος για 4x4 — υπολόγισε το τελευταίο κομμάτι πριν ξεκινήσεις.',
    de: 'Raue Piste, steiler Pfad oder 4x4-Gelände — plane das letzte Stück vorab.',
    it: 'Pista accidentata, sentiero ripido o terreno da 4x4 — pianifica l’ultimo tratto.',
    fr: "Piste accidentée, sentier raide ou terrain 4x4 — anticipez le dernier tronçon.",
  },
  dirt: {
    en: 'The last stretch is unpaved — slow and careful in a normal car, fine in the dry.',
    gr: 'Τα τελευταία χιλιόμετρα είναι χωμάτινα — αργά και προσεκτικά με συμβατικό αυτοκίνητο.',
    de: 'Das letzte Stück ist unbefestigt — langsam und vorsichtig mit normalem Auto.',
    it: "L'ultimo tratto è sterrato — piano e con prudenza con un'auto normale.",
    fr: "Le dernier tronçon n'est pas goudronné — lentement et prudemment en voiture normale.",
  },
  walk: {
    en: 'A short walk on a path gets you there — not driveable to the sand.',
    gr: 'Φτάνεις με σύντομο περπάτημα σε μονοπάτι — όχι με αυτοκίνητο μέχρι την άμμο.',
    de: 'Ein kurzer Fußweg führt hin — nicht bis zum Strand befahrbar.',
    it: 'Ci si arriva con una breve camminata su sentiero — non in auto fino alla sabbia.',
    fr: "Une courte marche sur un sentier y mène — pas accessible en voiture jusqu'au sable.",
  },
  car: {
    en: 'Paved road most of the way to the beach.',
    gr: 'Άσφαλτος σχεδόν μέχρι την παραλία.',
    de: 'Asphaltierte Straße fast bis zum Strand.',
    it: 'Strada asfaltata quasi fino alla spiaggia.',
    fr: "Route goudronnée presque jusqu'à la plage.",
  },
  carUnverified: {
    en: 'It looks easy to reach from the data we have, but we haven’t verified it on the ground.',
    gr: 'Με βάση τα διαθέσιμα στοιχεία φαίνεται εύκολη, αλλά δεν την έχουμε επαληθεύσει επιτόπου.',
    de: 'Laut unseren Daten wohl leicht erreichbar, aber nicht vor Ort bestätigt.',
    it: 'Dai dati sembra facile da raggiungere, ma non l’abbiamo verificata sul posto.',
    fr: "D'après nos données, l'accès semble facile, mais non vérifié sur place.",
  },
};

const TITLE: Copy = {
  en: 'Getting there',
  gr: 'Πώς θα πας',
  de: 'Anfahrt',
  it: 'Come arrivare',
  fr: 'Comment y aller',
};

const PARKING: Copy = {
  en: 'Parking nearby',
  gr: 'Πάρκινγκ κοντά',
  de: 'Parkplatz in der Nähe',
  it: 'Parcheggio nelle vicinanze',
  fr: 'Parking à proximité',
};

interface GettingThereSectionProps {
  beach: Beach;
  language: LanguageCode;
}

export const GettingThereSection: React.FC<GettingThereSectionProps> = ({ beach, language }) => {
  const kind = classify(beach);
  const hasParking = beach.amenities?.parking === true;

  // Nothing trustworthy to say (unknown access, no parking) → render nothing. We deliberately do
  // NOT render the raw accessNotes: the access label above is clearer, and that field can carry
  // verbose / internal maintenance text (e.g. "Επανέλεγχος 2026-05-25 ...") that isn't for users.
  if (!kind && !hasParking) return null;

  const Icon = kind ? KIND_ICON[kind] : Car;

  return (
    <section className="space-y-3" data-nosnippet="true">
      <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{pick(TITLE, language)}</h3>

      {kind && (
        <div className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 ${KIND_TONE[kind]}`}>
          <Icon className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-bold leading-snug">{pick(KIND_LABEL[kind], language)}</p>
            <p className="text-sm font-medium leading-relaxed opacity-90">{pick(KIND_DESC[kind], language)}</p>
          </div>
        </div>
      )}

      {hasParking && (
        <div className="flex items-center gap-2 px-1 text-sm font-semibold text-slate-700">
          <ParkingCircle className="h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden="true" />
          <span>{pick(PARKING, language)}</span>
        </div>
      )}
    </section>
  );
};
