import { LanguageCode } from '../types';

/**
 * Copy for the "Live webcam" block on the beach detail page. The camera is a
 * third party's PUBLIC page (see BeachWebcam in types.ts): we link, we never embed,
 * and every string here says so — the reader must never think the picture is ours.
 */
const localized = (language: LanguageCode, copy: Record<LanguageCode, string>): string =>
  copy[language] ?? copy.en;

export const getWebcamSectionTitle = (language: LanguageCode): string =>
  localized(language, {
    en: 'Live webcam',
    gr: 'Live κάμερα',
    de: 'Live-Webcam',
    fr: 'Webcam en direct',
    it: 'Webcam in diretta',
  });

export const getWebcamLead = (language: LanguageCode): string =>
  localized(language, {
    en: 'See the sea right now on a public camera pointed at this beach.',
    gr: 'Δες πώς είναι η θάλασσα τώρα σε δημόσια κάμερα που κοιτάει αυτή την παραλία.',
    de: 'Sieh das Meer jetzt über eine öffentliche Kamera, die auf diesen Strand zeigt.',
    fr: 'Voyez la mer en ce moment via une caméra publique tournée vers cette plage.',
    it: 'Guarda il mare adesso su una webcam pubblica puntata su questa spiaggia.',
  });

export const getWebcamDisclaimer = (language: LanguageCode): string =>
  localized(language, {
    en: 'Not run by CalmBeach — opens in a new tab.',
    gr: 'Δεν ανήκει στο CalmBeach — ανοίγει σε νέα καρτέλα.',
    de: 'Nicht von CalmBeach betrieben — öffnet in neuem Tab.',
    fr: 'Non gérée par CalmBeach — s’ouvre dans un nouvel onglet.',
    it: 'Non gestita da CalmBeach — si apre in una nuova scheda.',
  });

export const getWebcamCheckedLabel = (language: LanguageCode): string =>
  localized(language, {
    en: 'Checked',
    gr: 'Ελέγχθηκε',
    de: 'Geprüft',
    fr: 'Vérifié',
    it: 'Verificato',
  });
