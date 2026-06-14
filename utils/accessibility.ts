import { AccessFeatureStatus, Beach, BeachSeatracAccess, LanguageCode } from '../types';

/**
 * Localized copy + row builders for the disability / wheelchair sea-access (Seatrac) section.
 * Mirrors utils/amenities.ts so the detail-page UI stays visually consistent.
 *
 * SAFETY: every helper here errs toward caution. Unknown amenities are shown as "unknown",
 * never implied present; the seasonal + verify caveats are always surfaced when the record
 * is unverified (the default for bulk-imported data).
 */

type LocalizedText = Record<LanguageCode, string>;

const localized = (language: LanguageCode, copy: LocalizedText): string => copy[language] ?? copy.en;

export type AccessFeatureKey = keyof BeachSeatracAccess['amenities'];

/** Render order — ramp-adjacent essentials first, comfort last. */
const featureOrder: AccessFeatureKey[] = [
  'disabledParking',
  'boardwalkToWater',
  'accessibleWc',
  'changingRoom',
  'shower',
  'shade',
];

const featureLabels: Record<AccessFeatureKey, LocalizedText> = {
  disabledParking: { en: 'Disabled parking', gr: 'Πάρκινγκ ΑμεΑ', fr: 'Parking PMR', de: 'Behindertenparkplatz', it: 'Parcheggio disabili' },
  boardwalkToWater: { en: 'Boardwalk to water', gr: 'Διάδρομος προς τη θάλασσα', fr: "Passerelle vers l'eau", de: 'Steg zum Wasser', it: "Passerella verso l'acqua" },
  accessibleWc: { en: 'Accessible WC', gr: 'Προσβάσιμη τουαλέτα', fr: 'WC accessible', de: 'Barrierefreies WC', it: 'WC accessibile' },
  changingRoom: { en: 'Accessible changing room', gr: 'Προσβάσιμο αποδυτήριο', fr: 'Cabine accessible', de: 'Barrierefreie Umkleide', it: 'Spogliatoio accessibile' },
  shower: { en: 'Accessible shower', gr: 'Προσβάσιμο ντους', fr: 'Douche accessible', de: 'Barrierefreie Dusche', it: 'Doccia accessibile' },
  shade: { en: 'Shaded seating', gr: 'Σκιασμένος χώρος', fr: 'Espace ombragé', de: 'Schattenplatz', it: 'Zona ombreggiata' },
};

const statusValues: Record<AccessFeatureStatus, LocalizedText> = {
  yes: { en: 'Yes', gr: 'Ναι', fr: 'Oui', de: 'Ja', it: 'Sì' },
  seasonal: { en: 'Seasonal', gr: 'Εποχικά', fr: 'Saisonnier', de: 'Saisonal', it: 'Stagionale' },
  no: { en: 'No', gr: 'Όχι', fr: 'Non', de: 'Nein', it: 'No' },
  unknown: { en: 'Not verified', gr: 'Μη επιβεβαιωμένο', fr: 'Non vérifié', de: 'Nicht bestätigt', it: 'Non verificato' },
};

export interface AccessibilityStatusRow {
  key: AccessFeatureKey;
  label: string;
  value: string;
  status: AccessFeatureStatus;
}

/** Read the Seatrac record from either the top-level alias or metadata (mirrors blueFlag2026). */
export const getSeatracAccess = (beach: Beach): BeachSeatracAccess | undefined =>
  beach.seatrac ?? beach.metadata?.seatrac;

export const hasSeatracInfo = (beach: Beach): boolean => Boolean(getSeatracAccess(beach)?.hasSeatrac);

export const getAccessibilityStatusRows = (beach: Beach, language: LanguageCode): AccessibilityStatusRow[] => {
  const seatrac = getSeatracAccess(beach);
  if (!seatrac) return [];
  return featureOrder.map(key => {
    const status = seatrac.amenities[key];
    return {
      key,
      label: localized(language, featureLabels[key]),
      value: localized(language, statusValues[status]),
      status,
    };
  });
};

/** One-line state of the sea-access ramp itself, keyed on operational status. */
export const getAccessibilityHeadline = (beach: Beach, language: LanguageCode): string => {
  const seatrac = getSeatracAccess(beach);
  if (!seatrac || !seatrac.hasSeatrac) return '';
  if (seatrac.status === 'online') {
    return localized(language, {
      en: 'Autonomous sea-access ramp (Seatrac) available',
      gr: 'Διαθέσιμη ράμπα αυτόνομης πρόσβασης στη θάλασσα (Seatrac)',
      fr: "Rampe d'accès autonome à la mer (Seatrac) disponible",
      de: 'Autonome Meereszugangsrampe (Seatrac) vorhanden',
      it: 'Rampa di accesso autonomo al mare (Seatrac) disponibile',
    });
  }
  if (seatrac.status === 'uninstalled') {
    return localized(language, {
      en: 'Sea-access ramp listed as uninstalled — may not be available',
      gr: 'Η ράμπα αναφέρεται ως μη εγκατεστημένη — ίσως να μην είναι διαθέσιμη',
      fr: "Rampe d'accès indiquée comme non installée — peut-être indisponible",
      de: 'Rampe als nicht installiert gelistet — möglicherweise nicht verfügbar',
      it: 'Rampa indicata come non installata — potrebbe non essere disponibile',
    });
  }
  return localized(language, {
    en: 'Sea-access ramp listed — operational status unconfirmed',
    gr: 'Καταγεγραμμένη ράμπα — η λειτουργία δεν έχει επιβεβαιωθεί',
    fr: "Rampe d'accès répertoriée — état de fonctionnement non confirmé",
    de: 'Rampe gelistet — Betriebsstatus nicht bestätigt',
    it: 'Rampa elencata — stato operativo non confermato',
  });
};

/** Equipment is seasonal — always worth saying. */
export const getAccessibilitySeasonalNote = (language: LanguageCode): string =>
  localized(language, {
    en: 'Sea-access equipment is seasonal (usually installed June–September). Confirm it is in place before visiting.',
    gr: 'Ο εξοπλισμός πρόσβασης είναι εποχικός (συνήθως τοποθετείται Ιούνιο–Σεπτέμβριο). Επιβεβαιώστε ότι είναι στη θέση του πριν επισκεφθείτε.',
    fr: "L'équipement d'accès à la mer est saisonnier (généralement installé de juin à septembre). Confirmez sa présence avant de vous déplacer.",
    de: 'Die Meereszugangsausrüstung ist saisonal (meist Juni–September installiert). Bestätigen Sie vor dem Besuch, dass sie vorhanden ist.',
    it: "L'attrezzatura di accesso al mare è stagionale (di solito installata da giugno a settembre). Verificane la presenza prima di andare.",
  });

/** Re-verify caveat (the safety-critical line). */
export const getAccessibilityVerifyNote = (language: LanguageCode): string =>
  localized(language, {
    en: 'Accessibility details come from a periodic survey and can be out of date. Verify on seatrac.gr or call ahead before relying on them.',
    gr: 'Οι πληροφορίες προσβασιμότητας προέρχονται από περιοδική καταγραφή και μπορεί να μην είναι ενημερωμένες. Επιβεβαιώστε στο seatrac.gr ή τηλεφωνικά πριν βασιστείτε σε αυτές.',
    fr: "Les informations d'accessibilité proviennent d'un relevé périodique et peuvent être obsolètes. Vérifiez sur seatrac.gr ou appelez avant de vous y fier.",
    de: 'Die Barrierefreiheitsangaben stammen aus einer periodischen Erhebung und können veraltet sein. Prüfen Sie auf seatrac.gr oder rufen Sie vorher an, bevor Sie sich darauf verlassen.',
    it: "I dettagli sull'accessibilità provengono da un rilevamento periodico e potrebbero non essere aggiornati. Verifica su seatrac.gr o chiama prima di farci affidamento.",
  });

/** Section title. */
export const getAccessibilitySectionTitle = (language: LanguageCode): string =>
  localized(language, {
    en: 'Accessibility (disabled access)',
    gr: 'Προσβασιμότητα ΑμεΑ',
    fr: 'Accessibilité PMR',
    de: 'Barrierefreiheit',
    it: 'Accessibilità disabili',
  });

/** "Last checked" prefix for the source line. */
export const getAccessibilityCheckedLabel = (language: LanguageCode): string =>
  localized(language, {
    en: 'Last checked',
    gr: 'Τελευταίος έλεγχος',
    fr: 'Dernière vérification',
    de: 'Zuletzt geprüft',
    it: 'Ultimo controllo',
  });
