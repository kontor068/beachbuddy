// Η ΚΟΥΚΚΙΔΑ ΤΟΥ ΜΕΝΟΥ — «υπάρχει κάτι νέο εδώ μέσα που δεν έχεις δει».
//
// Θυμόμαστε μόνο ΤΗΝ ΗΜΕΡΟΜΗΝΙΑ της πιο πρόσφατης εγγραφής του ημερολογίου
// (components/landing/changelog.ts) που έχει ήδη ανοίξει το μενού σε αυτή τη
// συσκευή — όχι ολόκληρο ιστορικό. Μία εγγραφή βγαίνει live, η κουκκίδα
// ανάβει σε όποιον την είχε ήδη δει μέχρι εκείνη τη μέρα· σβήνει μόλις
// ανοίξει το μενού μία φορά.
import { getStoredValue, setStoredValue } from './safeStorage';

const STORE_KEY = 'calmbeach_menu_seen_update';

/** true όταν η πιο πρόσφατη εγγραφή του ημερολογίου δεν έχει ανοιχτεί ακόμα σε αυτή τη συσκευή. */
export const hasUnseenMenuUpdate = (latestDate: string): boolean => getStoredValue(STORE_KEY) !== latestDate;

/** Κλήσου όταν ανοίγει το μενού: η κουκκίδα δεν ξαναφαίνεται μέχρι την επόμενη εγγραφή. */
export const markMenuUpdateSeen = (latestDate: string): void => {
  setStoredValue(STORE_KEY, latestDate);
};
