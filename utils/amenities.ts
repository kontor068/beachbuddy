import { Beach, LanguageCode } from '../types';
import {
  CAFE_AMENITY_TERMS,
  RESTAURANT_AMENITY_TERMS,
  TAVERNA_AMENITY_TERMS,
  amenityItemIncludesAny,
  hasExplicitBeachBarAmenity,
} from './amenityMatching.js';

export type AmenityChipKey =
  | 'beachBar'
  | 'sunbeds'
  | 'foodNearby'
  | 'cafeNearby'
  | 'parking'
  | 'organizedFacilities'
  | 'noFacilities'
  | 'seasonalFacilities'
  | 'unknownFacilities';

export type AmenityStatus = 'yes' | 'seasonal' | 'no' | 'unknown' | 'limited';

export interface AmenityChip {
  key: AmenityChipKey;
  label: string;
  status: AmenityStatus;
}

export interface AmenityStatusRow {
  key: Extract<AmenityChipKey, 'beachBar' | 'sunbeds' | 'foodNearby' | 'cafeNearby' | 'parking'>;
  label: string;
  value: string;
  status: AmenityStatus;
}

type SpecificAmenityKey = AmenityStatusRow['key'];

const specificAmenityOrder: SpecificAmenityKey[] = [
  'beachBar',
  'sunbeds',
  'foodNearby',
  'cafeNearby',
  'parking',
];

const normalize = (value: string | undefined): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

type LocalizedAmenityText = Record<LanguageCode, string>;

const localized = (language: LanguageCode, copy: LocalizedAmenityText): string =>
  copy[language] ?? copy.en;

const amenityLabels: Record<SpecificAmenityKey, LocalizedAmenityText> = {
  beachBar: { en: 'Beach bar', gr: 'Beach bar', fr: 'Bar de plage', de: 'Beach Bar', it: 'Beach bar' },
  sunbeds: { en: 'Sunbeds', gr: 'Ξαπλώστρες', fr: 'Transats', de: 'Liegen', it: 'Lettini' },
  foodNearby: { en: 'Tavernas nearby', gr: 'Ταβέρνες κοντά', fr: 'Tavernes proches', de: 'Tavernen in der Nähe', it: 'Taverne vicine' },
  cafeNearby: { en: 'Café nearby', gr: 'Καφέ κοντά', fr: 'Café proche', de: 'Café in der Nähe', it: 'Caffè vicino' },
  parking: { en: 'Parking nearby', gr: 'Parking κοντά', fr: 'Parking proche', de: 'Parken in der Nähe', it: 'Parcheggio vicino' },
};

const rowLabels: Record<SpecificAmenityKey, LocalizedAmenityText> = {
  ...amenityLabels,
  parking: { en: 'Parking', gr: 'Parking', fr: 'Parking', de: 'Parken', it: 'Parcheggio' },
};

const getLabel = (key: SpecificAmenityKey, language: LanguageCode): string => {
  const label = amenityLabels[key];
  return localized(language, label);
};

const getChipLabel = (key: AmenityChipKey, status: AmenityStatus, language: LanguageCode): string => {
  if (key === 'organizedFacilities') {
    return localized(language, { en: 'Facilities available', gr: 'Παροχές διαθέσιμες', fr: 'Services disponibles', de: 'Ausstattung verfügbar', it: 'Servizi disponibili' });
  }
  if (key === 'noFacilities') {
    return localized(language, { en: 'No beach facilities', gr: 'Χωρίς οργανωμένες παροχές', fr: 'Pas de services de plage', de: 'Keine Strandausstattung', it: 'Nessun servizio in spiaggia' });
  }
  if (key === 'seasonalFacilities') {
    return localized(language, { en: 'Seasonal facilities', gr: 'Εποχικές παροχές', fr: 'Services saisonniers', de: 'Saisonale Ausstattung', it: 'Servizi stagionali' });
  }
  if (key === 'unknownFacilities') {
    return localized(language, { en: 'Facilities unknown', gr: 'Άγνωστες παροχές', fr: 'Services inconnus', de: 'Ausstattung unbekannt', it: 'Servizi non verificati' });
  }

  const base = getLabel(key, language);
  if (status === 'seasonal') {
    const seasonalSuffix: Record<LanguageCode, string> = {
      en: `${base} seasonally`,
      gr: `${base} εποχικά`,
      fr: `${base} en saison`,
      de: `${base} saisonal`,
      it: `${base} stagionale`,
    };
    return seasonalSuffix[language];
  }
  if (status === 'limited' && key === 'parking') {
    return localized(language, { en: 'Limited parking', gr: 'Parking περιορισμένο', fr: 'Parking limité', de: 'Begrenztes Parken', it: 'Parcheggio limitato' });
  }
  return base;
};

const getRowLabel = (key: SpecificAmenityKey, language: LanguageCode): string => {
  const label = rowLabels[key];
  return localized(language, label);
};

const getStatusValue = (status: AmenityStatus, language: LanguageCode): string => {
  const values: Record<AmenityStatus, LocalizedAmenityText> = {
    yes: { en: 'Yes', gr: 'Ναι', fr: 'Oui', de: 'Ja', it: 'Sì' },
    seasonal: { en: 'Seasonal', gr: 'Εποχικά', fr: 'Saisonnier', de: 'Saisonal', it: 'Stagionale' },
    no: { en: 'No', gr: 'Όχι', fr: 'Non', de: 'Nein', it: 'No' },
    unknown: { en: 'Unknown', gr: 'Άγνωστο', fr: 'Inconnu', de: 'Unbekannt', it: 'Sconosciuto' },
    limited: { en: 'Limited', gr: 'Περιορισμένο', fr: 'Limité', de: 'Begrenzt', it: 'Limitato' },
  };
  return localized(language, values[status]);
};

const getAmenityTextItems = (beach: Beach): string[] => {
  const metadataItems = beach.metadata?.amenities || [];
  const legacyItems = Array.isArray((beach as unknown as { amenities?: unknown }).amenities)
    ? ((beach as unknown as { amenities: string[] }).amenities)
    : [];
  return [...metadataItems, ...legacyItems].filter(Boolean);
};

const itemMatches = (item: string, key: SpecificAmenityKey): boolean => {
  const text = normalize(item);
  switch (key) {
    case 'beachBar':
      return hasExplicitBeachBarAmenity(item);
    case 'sunbeds':
      return /ξαπλωστ|ομπρελ|sunbed|umbrella/.test(text);
    case 'foodNearby':
      return amenityItemIncludesAny(item, [...TAVERNA_AMENITY_TERMS, ...RESTAURANT_AMENITY_TERMS, 'food']);
    case 'cafeNearby':
      return amenityItemIncludesAny(item, CAFE_AMENITY_TERMS);
    case 'parking':
      return /parking|παρκ|σταθμευσ/.test(text);
    default:
      return false;
  }
};

const itemMatchesTaverna = (item: string): boolean =>
  amenityItemIncludesAny(item, [...TAVERNA_AMENITY_TERMS, ...RESTAURANT_AMENITY_TERMS]);

const hasTavernaSignal = (beach: Beach): boolean =>
  Boolean(beach.amenities?.taverna || beach.amenities?.restaurant) || getAmenityTextItems(beach).some(itemMatchesTaverna);

const getFoodNearbyLabel = (beach: Beach, language: LanguageCode): string => {
  if (hasTavernaSignal(beach)) {
    return localized(language, {
      en: 'Tavernas nearby',
      gr: 'Ταβέρνες κοντά',
      fr: 'Tavernes proches',
      de: 'Tavernen in der Nähe',
      it: 'Taverne vicine',
    });
  }
  return getLabel('foodNearby', language);
};

const getFoodNearbyChipLabel = (beach: Beach, status: AmenityStatus, language: LanguageCode): string => {
  const base = getFoodNearbyLabel(beach, language);
  if (status === 'seasonal') {
    return {
      en: `${base} seasonally`,
      gr: `${base} εποχικά`,
      fr: `${base} en saison`,
      de: `${base} saisonal`,
      it: `${base} stagionale`,
    }[language];
  }
  return base;
};

const itemIsSeasonal = (item: string): boolean =>
  /εποχ|season|summer|high season|σεζον/.test(normalize(item));

const itemIsLimited = (item: string): boolean =>
  /περιορισ|limited|στον δρομο|street/.test(normalize(item));

const itemSaysNoFacilities = (item: string): boolean =>
  /καμια οργανωμενη παροχ|χωρις οργανωμεν|χωρις παροχ|no beach facilit|no facilit/.test(normalize(item));

const booleanStatus = (value: boolean | undefined): AmenityStatus | null => {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return null;
};

const getTopLevelStatus = (beach: Beach, key: SpecificAmenityKey): AmenityStatus | null => {
  const looseBeach = beach as Beach & {
    beachBar?: boolean;
    sunbeds?: boolean;
    foodNearby?: boolean;
    cafeNearby?: boolean;
    parking?: boolean;
    seasonal?: boolean;
  };

  if (key === 'foodNearby') {
    return booleanStatus(looseBeach.foodNearby ?? beach.amenities?.taverna ?? beach.amenities?.restaurant);
  }
  if (key === 'cafeNearby') {
    return booleanStatus(looseBeach.cafeNearby);
  }
  return booleanStatus(looseBeach[key] ?? beach.amenities?.[key as keyof Beach['amenities']] as boolean | undefined);
};

const getTextStatus = (items: string[], key: SpecificAmenityKey): AmenityStatus | null => {
  const matches = items.filter(item => itemMatches(item, key));
  if (matches.length === 0) return null;
  if (key === 'parking' && matches.some(itemIsLimited)) return 'limited';
  if (matches.some(itemIsSeasonal)) return 'seasonal';
  return 'yes';
};

const getSpecificAmenityStatus = (beach: Beach, key: SpecificAmenityKey): AmenityStatus => {
  const items = getAmenityTextItems(beach);
  const textStatus = getTextStatus(items, key);
  if (textStatus) return textStatus;

  const fieldStatus = getTopLevelStatus(beach, key);
  if (fieldStatus === 'yes') return 'yes';

  if (beach.metadata) {
    if (beach.metadata.organized === false && (key === 'beachBar' || key === 'sunbeds')) {
      return 'no';
    }
    return 'unknown';
  }

  return fieldStatus || 'unknown';
};

export const hasSeasonalAmenitySignal = (beach: Beach): boolean => {
  const looseBeach = beach as Beach & { seasonal?: boolean };
  if (looseBeach.seasonal) return true;
  return getAmenityTextItems(beach).some(itemIsSeasonal);
};

export const getAmenityChips = (beach: Beach, language: LanguageCode): AmenityChip[] => {
  const chips: AmenityChip[] = specificAmenityOrder.reduce<AmenityChip[]>((acc, key) => {
    const status = getSpecificAmenityStatus(beach, key);
    if (status !== 'yes' && status !== 'seasonal' && status !== 'limited') return acc;
    acc.push({
      key,
      status,
      label: key === 'foodNearby'
        ? getFoodNearbyChipLabel(beach, status, language)
        : getChipLabel(key, status, language),
    });
    return acc;
  }, []);

  if (chips.length > 0) return chips;

  const items = getAmenityTextItems(beach);
  const organized = beach.metadata?.organized ?? beach.amenities?.organized;

  if (organized === false || items.some(itemSaysNoFacilities)) {
    return [{
      key: 'noFacilities',
      status: 'no',
      label: getChipLabel('noFacilities', 'no', language),
    }];
  }

  if (hasSeasonalAmenitySignal(beach)) {
    return [{
      key: 'seasonalFacilities',
      status: 'seasonal',
      label: getChipLabel('seasonalFacilities', 'seasonal', language),
    }];
  }

  if (organized === true) {
    return [{
      key: 'organizedFacilities',
      status: 'yes',
      label: getChipLabel('organizedFacilities', 'yes', language),
    }];
  }

  return [{
    key: 'unknownFacilities',
    status: 'unknown',
    label: getChipLabel('unknownFacilities', 'unknown', language),
  }];
};

export const getAmenityStatusRows = (beach: Beach, language: LanguageCode): AmenityStatusRow[] =>
  specificAmenityOrder.map(key => {
    const status = getSpecificAmenityStatus(beach, key);
    return {
      key,
      label: key === 'foodNearby' ? getFoodNearbyLabel(beach, language) : getRowLabel(key, language),
      value: getStatusValue(status, language),
      status,
    };
  });

export const getAmenityDisclaimer = (language: LanguageCode): string =>
  localized(language, {
    en: 'Facilities can vary by season.',
    gr: 'Οι παροχές μπορεί να διαφέρουν ανά εποχή.',
    fr: 'Les services peuvent varier selon la saison.',
    de: 'Ausstattung kann je nach Saison variieren.',
    it: 'I servizi possono variare in base alla stagione.',
  });

export const shouldShowAmenityDisclaimer = (beach: Beach): boolean => {
  if (hasSeasonalAmenitySignal(beach)) return true;
  const rows = getAmenityStatusRows(beach, 'en');
  return rows.some(row => row.status === 'yes' || row.status === 'limited');
};
