import type { Island, LanguageCode } from '../types';

type IslandGroup = Island['group'];

// Tourist-facing region label for an island group, used e.g. as the homepage context
// strip eyebrow ("ΚΥΚΛΑΔΕΣ › Μήλος"). More recognizable than the administrative region.
// Resolves requested language → English → undefined, so callers can fall back to a
// country label when a group has no entry (e.g. 'other').
const ISLAND_GROUP_LABELS: Partial<Record<IslandGroup, Partial<Record<LanguageCode, string>>>> = {
  cyclades: { en: 'Cyclades', gr: 'Κυκλάδες', fr: 'Cyclades', de: 'Kykladen', it: 'Cicladi' },
  dodecanese: { en: 'Dodecanese', gr: 'Δωδεκάνησα', fr: 'Dodécanèse', de: 'Dodekanes', it: 'Dodecaneso' },
  sporades: { en: 'Sporades', gr: 'Σποράδες', fr: 'Sporades', de: 'Sporaden', it: 'Sporadi' },
  north_aegean: { en: 'North Aegean', gr: 'Βόρειο Αιγαίο', fr: 'Égée du Nord', de: 'Nordägäis', it: 'Egeo Settentrionale' },
  crete: { en: 'Crete', gr: 'Κρήτη', fr: 'Crète', de: 'Kreta', it: 'Creta' },
  ionian: { en: 'Ionian Islands', gr: 'Ιόνια Νησιά', fr: 'Îles Ioniennes', de: 'Ionische Inseln', it: 'Isole Ionie' },
  attica: { en: 'Attica', gr: 'Αττική', fr: 'Attique', de: 'Attika', it: 'Attica' },
  argosaronic: { en: 'Argo-Saronic', gr: 'Αργοσαρωνικός', fr: 'Argo-Saronique', de: 'Argosaronischer Golf', it: 'Argosaronico' },
  euboea: { en: 'Euboea', gr: 'Εύβοια', fr: 'Eubée', de: 'Euböa', it: 'Eubea' },
  mainland_peloponnese: { en: 'Peloponnese', gr: 'Πελοπόννησος', fr: 'Péloponnèse', de: 'Peloponnes', it: 'Peloponneso' },
  mainland_central: { en: 'Central Greece', gr: 'Στερεά Ελλάδα', fr: 'Grèce centrale', de: 'Mittelgriechenland', it: 'Grecia Centrale' },
  mainland_thessaly: { en: 'Thessaly', gr: 'Θεσσαλία', fr: 'Thessalie', de: 'Thessalien', it: 'Tessaglia' },
  mainland_epirus: { en: 'Epirus', gr: 'Ήπειρος', fr: 'Épire', de: 'Epirus', it: 'Epiro' },
  mainland_macedonia: { en: 'Macedonia', gr: 'Μακεδονία', fr: 'Macédoine', de: 'Makedonien', it: 'Macedonia' },
  mainland_thrace: { en: 'Thrace', gr: 'Θράκη', fr: 'Thrace', de: 'Thrakien', it: 'Tracia' },
  mainland_west_greece: { en: 'Western Greece', gr: 'Δυτική Ελλάδα', fr: 'Grèce occidentale', de: 'Westgriechenland', it: 'Grecia Occidentale' },
};

export const getIslandGroupLabel = (
  group: IslandGroup | undefined,
  language: LanguageCode,
): string | undefined => {
  if (!group) return undefined;
  const entry = ISLAND_GROUP_LABELS[group];
  if (!entry) return undefined;
  return entry[language] ?? entry.en;
};
