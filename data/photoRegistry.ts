export type DestinationPhotoType = 'hero' | 'card' | 'fallback';

export type PhotoSource =
  | 'own'
  | 'wikimedia'
  | 'pexels'
  | 'pixabay'
  | 'unsplash'
  | 'partner'
  | 'unknown';

export interface CuratedPhoto {
  src: string;
  alt: string;
  width: number;
  height: number;
  source: PhotoSource;
  author?: string;
  license?: string;
  sourceUrl?: string;
  attributionRequired: boolean;
  verifiedLocation: boolean;
  usageLabel: string;
  loading: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  /**
   * CSS object-position for the homepage context strip, where the photo is cropped into a
   * wide short band. Only set when the default center crop hides the subject (e.g. a tall
   * monument). Ignored by other surfaces.
   */
  objectPosition?: string;
}

export interface DestinationPhotoSet {
  hero?: CuratedPhoto;
  card?: CuratedPhoto;
  fallback?: CuratedPhoto;
}

export const supportedDestinationIds = [
  'milos',
  'crete',
  'rhodes',
  'corfu',
  'zakynthos',
  'kefalonia',
  'lefkada',
  'naxos',
  'paros',
  'mykonos',
  'santorini',
  'samos',
  'skiathos',
  'skopelos',
  'thasos',
  'chalkidiki',
  'attica',
  'peloponnese',
  'syros',
  'andros',
] as const;

export type DestinationId = (typeof supportedDestinationIds)[number];

export const supportedFallbackPhotoIds = [
  'greekBeach',
  'cyclades',
  'ionian',
  'aegean',
] as const;

export type FallbackPhotoId = (typeof supportedFallbackPhotoIds)[number];

export const destinationPhotoRegistry: Record<DestinationId, DestinationPhotoSet> = {
  milos: {
    hero: {
      src: '/images/destinations/milos/milos-sarakiniko-hero.webp',
      alt: 'Sarakiniko beach landscape in Milos, Greece',
      width: 1600,
      height: 900,
      source: 'wikimedia',
      author: 'dronepicr',
      license: 'CC BY 2.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Sarakiniko_Beach_on_Milos_Island,_Greece_with_a_view_of_the_Aegean_Sea.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Μήλος',
      loading: 'eager',
      fetchPriority: 'high',
    },
    card: {
      src: '/images/destinations/milos/milos-kleftiko-card.webp',
      alt: 'Kleftiko cliffs and turquoise water in Milos, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'dronepicr',
      license: 'CC BY 2.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Cliffs_and_rock_formations_at_Kleftiko_on_Milos_Island,_Greece.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Μήλος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
    fallback: {
      src: '/images/destinations/milos/milos-kleftiko-sea-caves-fallback.webp',
      alt: 'Sea caves and coastline in Milos, Greece',
      width: 1200,
      height: 800,
      source: 'wikimedia',
      author: 'dronepicr',
      license: 'CC BY 2.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Sea_caves_at_Kleftiko_on_Milos_Island,_Greece.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Εικόνα από τη Μήλο',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  crete: {
    card: {
      src: '/images/destinations/crete/crete-balos-beach-card.webp',
      alt: 'Aerial view of Balos beach and turquoise lagoon in Crete, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Simao Arinto',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Aerial_view_of_Balos_beach.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Κρήτη',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  rhodes: {
    card: {
      src: '/images/destinations/rhodes/rhodes-lindos-beach-card.webp',
      alt: 'Lindos beach and harbour in Rhodes, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Marc Ryckaert (MJJR)',
      license: 'CC BY 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rhodos_Lindos_Beach_R01.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Ρόδος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  corfu: {
    card: {
      src: '/images/destinations/corfu/corfu-paleokastritsa-beach-card.webp',
      alt: 'Paleokastritsa beach in Corfu, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Marc Ryckaert (MJJR)',
      license: 'CC BY 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Corfu_Paleokastritsa_Beach_R01.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Κέρκυρα',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  zakynthos: {
    card: {
      src: '/images/destinations/zakynthos/zakynthos-navagio-beach-card.webp',
      alt: 'Navagio Shipwreck beach in Zakynthos, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'kallerna',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Navagio_beach_Zakynthos_3.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Ζάκυνθος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  kefalonia: {
    card: {
      src: '/images/destinations/kefalonia/kefalonia-myrtos-beach-card.webp',
      alt: 'Myrtos beach in Kefalonia, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Matt Sims',
      license: 'CC BY 2.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Myrtos_Beach,_Kefalonia.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Κεφαλονιά',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  lefkada: {
    card: {
      src: '/images/destinations/lefkada/lefkada-porto-katsiki-card.webp',
      alt: 'Porto Katsiki beach in Lefkada, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Dimitra Papadimitriou',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Porto_Katsiki_Beach,_Lefkada,_Ionian_Islands,_Greece.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Λευκάδα',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  naxos: {
    card: {
      src: '/images/destinations/naxos/naxos-portara-sunset-card.webp',
      alt: 'Portara of Naxos at sunset in Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Vasilismorfo',
      license: 'CC BY 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Portara_of_Naxos_at_Sunset.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Νάξος',
      loading: 'lazy',
      fetchPriority: 'auto',
      // Lift the crop so the Portara gate + sky show in the strip instead of the dark horizon.
      objectPosition: 'center 32%',
    },
  },
  paros: {
    card: {
      src: '/images/destinations/paros/paros-kolymbithres-card.webp',
      alt: 'Kolymbithres beach in Paros, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Tango7174',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Paros_Kolymbithres1_tango7174.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Πάρος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  mykonos: {
    card: {
      src: '/images/destinations/mykonos/mykonos-chora-windmills-card.webp',
      alt: 'Windmills in Chora of Mykonos, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Bernard Gagnon',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Windmills_in_Mykonos_01.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Μύκονος',
      loading: 'lazy',
      fetchPriority: 'auto',
      // Center the windmills row (upper third) rather than the town below it.
      objectPosition: 'center 30%',
    },
  },
  santorini: {
    card: {
      src: '/images/destinations/santorini/santorini-oia-caldera-card.webp',
      alt: 'Oia village and caldera view in Santorini, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Norbert Nagel',
      license: 'CC BY-SA 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Oia_-_Santorini_-_Greece_-_16.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Σαντορίνη',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  samos: {
    card: {
      src: '/images/destinations/samos/samos-tsamadou-beach-card.webp',
      alt: 'Tsamadou beach with turquoise water in Samos, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Αναστασίου Νίκος (Nicosanastassiou)',
      license: 'CC BY 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tsamadou_542s.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Σάμος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  skiathos: {
    card: {
      src: '/images/destinations/skiathos/skiathos-koukounaries-beach-card.webp',
      alt: 'Koukounaries beach and pine forest in Skiathos, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Shi Annan',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Koukounaries_Beach_from_west_2016.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Σκιάθος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  skopelos: {
    card: {
      src: '/images/destinations/skopelos/skopelos-milia-beach-card.webp',
      alt: 'Aerial view of Milia beach in Skopelos, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'dronepicr',
      license: 'CC BY 2.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Milia_Beach,_Skopelos,_Greece_(51696411084).jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Σκόπελος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  thasos: {
    card: {
      src: '/images/destinations/thasos/thasos-golden-beach-card.webp',
      alt: 'Golden Beach (Chrysi Ammoudia) in Thasos, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Rosa-Maria Rinkl',
      license: 'CC BY-SA 4.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Golden_Beach,_Thassos.JPG',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Θάσος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  chalkidiki: {
    card: {
      src: '/images/destinations/chalkidiki/chalkidiki-karidi-beach-card.webp',
      alt: 'Karidi beach at Vourvourou, Sithonia, Halkidiki, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Srđan Mijatov',
      license: 'CC BY 3.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Karidi_Beach_-_Vourvourou,_Sithonia,_Greece_-_panoramio.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Χαλκιδική',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  attica: {},
  peloponnese: {
    card: {
      src: '/images/destinations/peloponnese/peloponnese-voidokilia-beach-card.webp',
      alt: 'Voidokilia beach and lagoon in Messinia, Peloponnese, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Grzontan',
      license: 'CC BY-SA 3.0',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Voidokilia_beach3.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Πελοπόννησος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  syros: {
    card: {
      src: '/images/destinations/syros/syros-galissas-beach-card.webp',
      alt: 'Galissas beach in Syros, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'Olavfin',
      license: 'Public domain',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gallissas_beach.jpg',
      attributionRequired: false,
      verifiedLocation: true,
      usageLabel: 'Σύρος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
  andros: {
    card: {
      src: '/images/destinations/andros/andros-chora-beach-card.webp',
      alt: 'Main beach at Chora of Andros, Cyclades, Greece',
      width: 800,
      height: 600,
      source: 'wikimedia',
      author: 'GKantaris',
      license: 'CC BY-SA 4.0',
      sourceUrl:
        'https://commons.wikimedia.org/wiki/File:Main_beach_at_Chora_Andros,_Andros_Island,_Cyclades,_Greece.jpg',
      attributionRequired: true,
      verifiedLocation: true,
      usageLabel: 'Άνδρος',
      loading: 'lazy',
      fetchPriority: 'auto',
    },
  },
};

export const fallbackPhotoRegistry: Partial<Record<FallbackPhotoId, CuratedPhoto>> = {};

const supportedDestinationIdSet = new Set<string>(supportedDestinationIds);
const supportedFallbackPhotoIdSet = new Set<string>(supportedFallbackPhotoIds);

export const isDestinationId = (destinationId: string): destinationId is DestinationId =>
  supportedDestinationIdSet.has(destinationId);

export const isFallbackPhotoId = (fallbackPhotoId: string): fallbackPhotoId is FallbackPhotoId =>
  supportedFallbackPhotoIdSet.has(fallbackPhotoId);

export const getDestinationPhotoSet = (
  destinationId: string,
): DestinationPhotoSet | undefined => {
  if (!isDestinationId(destinationId)) {
    return undefined;
  }

  return destinationPhotoRegistry[destinationId];
};

export const getDestinationPhoto = (
  destinationId: string,
  type: DestinationPhotoType,
): CuratedPhoto | undefined => getDestinationPhotoSet(destinationId)?.[type];

export const hasDestinationPhoto = (
  destinationId: string,
  type: DestinationPhotoType,
): boolean => Boolean(getDestinationPhoto(destinationId, type));

export const getFallbackPhoto = (
  fallbackPhotoId: string,
): CuratedPhoto | undefined => {
  if (!isFallbackPhotoId(fallbackPhotoId)) {
    return undefined;
  }

  return fallbackPhotoRegistry[fallbackPhotoId];
};

export const hasFallbackPhoto = (fallbackPhotoId: string): boolean =>
  Boolean(getFallbackPhoto(fallbackPhotoId));
