import { MARINE_MODEL_PREFERENCE, type MarineModelId } from './marineModelPreference.generated';

/**
 * ΠΟΙΟ ΜΟΝΤΕΛΟ ΚΥΜΑΤΟΣ ΠΡΕΠΕΙ ΝΑ ΗΓΕΙΤΑΙ ΣΕ ΑΥΤΟ ΤΟ ΣΗΜΕΙΟ.
 *
 * Επιστρέφει `undefined` σχεδόν πάντα — και αυτό είναι το σωστό. Το ewam ηγείται παντού επειδή
 * μετρήθηκε καλύτερο σε 9.723 ώρες σημαδούρας (utils/marineForecastParsing). Η εξαίρεση αφορά
 * μετρημένα σημεία όπου το κελί του ewam περιγράφει νερό που η παραλία ΔΕΝ βλέπει: εκεί η
 * καλύτερη βαθμολογία του είναι άσχετη, γιατί μετράει σωστά τη λάθος θάλασσα.
 *
 * Η στρογγυλοποίηση στα 3 δεκαδικά είναι η ΙΔΙΑ με το κλειδί που χρησιμοποιεί ο παραγωγός και
 * το utils/marineSamplePoints — αν αλλάξει εδώ, τα κλειδιά παύουν να ταιριάζουν και η προτίμηση
 * γίνεται σιωπηλά ανενεργή. Γι' αυτό η πύλη μετράει πόσα σημεία βρίσκουν όντως αντιστοιχία.
 */
export const preferredMarineModelFor = (lat: number, lon: number): MarineModelId | undefined => {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  return MARINE_MODEL_PREFERENCE[`${lat.toFixed(3)}_${lon.toFixed(3)}`];
};

export type { MarineModelId };
