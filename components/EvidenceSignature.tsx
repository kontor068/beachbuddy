import React from 'react';
import type { LanguageCode } from '../types';

/**
 * Η ΥΠΟΓΡΑΦΗ — μία γραμμή που λέει ΓΙΑΤΙ αυτή η ετυμηγορία δεν είναι πρόγνωση καιρού.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (Μίλτος, 22/08/2026): «θέλω να ξέρει ο κόσμος πόσο τεκμηριωμένο είναι, όχι παίξε
 * γέλασε — αλλά χωρίς να τους πω πώς το κάνουμε». Το trust manifesto υπάρχει ήδη και είναι
 * καλογραμμένο (components/landing/HowWeDecideSection), αλλά ζει ΜΟΝΟ στη landing. Η κίνηση
 * έρχεται από το Google κατευθείαν σε σελίδα παραλίας και σε σελίδα περιοχής, όπου το μόνο που
 * λέγαμε ήταν μια γραμμή πηγών στο υποσέλιδο. Το λέγαμε εκεί που δεν πατάει κανείς.
 *
 * ΤΙ ΛΕΕΙ ΚΑΙ ΤΙ ΔΕΝ ΛΕΕΙ. Λέει ΤΙ κοιτάμε (τη δική της ακτή, όχι τον καιρό του νησιού) και
 * ΠΟΣΕΣ παραλίες έχουν περάσει από αυτό. ΔΕΝ λέει κατώφλια, συντελεστές, ονόματα κανόνων ή
 * σειρά τελεστών. Η διάκριση δεν είναι διακοσμητική: η ιδέα είναι ήδη δημόσια (το manifesto και
 * το FAQ τη λένε από τον Ιούλιο) και δεν αντιγράφεται σε ένα Σαββατοκύριακο — τα **2.873
 * μετρημένα προφίλ ακτογραμμής** είναι που κοστίζουν. Οι παράμετροι, αντίθετα, αντιγράφονται σε
 * δέκα λεπτά και δεν μπαίνουν πουθενά σε επιφάνεια χρήστη.
 *
 * ⚠️ ΕΙΝΑΙ ΥΠΟΓΡΑΦΗ, ΟΧΙ ΕΞΗΓΗΣΗ ΑΝΑ ΠΑΡΑΛΙΑ — ΚΑΙ ΑΥΤΟ ΜΕΤΡΗΘΗΚΕ.
 * Η πρώτη γραφή είχε δύο εκδοχές, μία για παραλίες με μετρημένη ακτογραμμή και μία για τις
 * υπόλοιπες, με το επιχείρημα «αλλάζει ανά παραλία, άρα δεν διαβάζεται σαν σλόγκαν». Η μέτρηση
 * το σκότωσε: **2.873 από 2.873 παραλίες έχουν μετρημένο προφίλ και καμία δεν έχει ύποπτη
 * πινέζα** (22/08/2026), οπότε η δεύτερη εκδοχή δεν θα εμφανιζόταν ΠΟΤΕ — νεκρός κώδικας που θα
 * φαινόταν σαν δίχτυ. Και η πύλη `new-beach-completeness` μπλοκάρει πλέον κάθε νέα παραλία που
 * έρχεται χωρίς γεωμετρία, άρα ούτε στο μέλλον.
 *
 * Γι' αυτό η πρόταση είναι σταθερή και μιλάει για το ΠΡΟΪΟΝ, όχι για τη συγκεκριμένη παραλία.
 * Ο κανόνας «καμία διπλή ρομποτική εξήγηση» απαγορεύει ψευτο-εξηγήσεις που προσποιούνται ότι
 * κρίνουν αυτό που βλέπεις· μια δηλωμένη υπογραφή, όπως η γραμμή πηγών του υποσέλιδου, είναι
 * άλλο πράγμα.
 *
 * ⚠️ ΜΙΑ ΦΟΡΑ ΑΝΑ ΟΘΟΝΗ (απόφαση Μίλτου, 22/08). Μπαίνει ΚΑΤΩ από την κάρτα της ετυμηγορίας
 * στη σελίδα παραλίας και ΚΑΤΩ από τη λεζάντα του χάρτη στη σελίδα περιοχής — και πουθενά
 * αλλού. Ούτε στις κάρτες της λίστας, ούτε στο υποσέλιδο, ούτε δεύτερη φορά στην ίδια σελίδα:
 * τρεις φορές στην ίδια οθόνη είναι ταπετσαρία, και μια ταπετσαρία δεν τη διαβάζει κανείς.
 *
 * ΓΙΑΤΙ Ο ΣΥΝΔΕΣΜΟΣ ΠΑΕΙ ΣΤΟ FAQ ΚΑΙ ΟΧΙ ΣΕ ΝΕΑ ΣΕΛΙΔΑ. Το FAQ απαντάει ήδη τα τρία ερωτήματα
 * που γεννάει αυτή η γραμμή — πόσο αξιόπιστη είναι η πρόγνωση, τι σημαίνει έκθεση, πώς βγαίνει
 * το ύψος κύματος — σε αρχές και χωρίς αριθμούς ρύθμισης (scripts/prerenderBeachPages.mjs,
 * `/faq/`). Ξεχωριστή σελίδα «Πώς κρίνουμε» έχει νόημα μόνο αν πει ΑΛΛΟ πράγμα (τι αρνούμαστε
 * να κάνουμε, τι ελέγχουμε, πότε), αλλιώς είναι διπλό περιεχόμενο στα μάτια της Google.
 */

interface EvidenceSignatureCopy {
  /** Η πρόταση. Μία, σύντομη, χωρίς αριθμό ρύθμισης μέσα της. */
  line: string;
  /** Το ερώτημα που γεννάει η πρόταση — και που το FAQ όντως απαντάει. */
  link: string;
}

const COPY: Record<LanguageCode, EvidenceSignatureCopy> = {
  gr: {
    line: 'Κάθε παραλία κρίνεται από τη δική της ακτή, όχι από τον καιρό του νησιού.',
    link: 'Πόσο σίγουρο είναι αυτό;',
  },
  en: {
    line: "Every beach is judged by its own shoreline, not by the island's weather.",
    link: 'How reliable is this?',
  },
  de: {
    line: 'Jeder Strand wird nach seiner eigenen Küstenform beurteilt, nicht nach dem Wetter der Insel.',
    link: 'Wie verlässlich ist das?',
  },
  fr: {
    line: "Chaque plage est jugée d'après son propre rivage, pas d'après la météo de l'île.",
    link: 'Quelle est la fiabilité ?',
  },
  it: {
    line: "Ogni spiaggia è valutata in base alla propria costa, non al meteo dell'isola.",
    link: 'Quanto è affidabile?',
  },
};

interface EvidenceSignatureProps {
  language: LanguageCode;
  /** Extra spacing/alignment for the surface it sits under. */
  className?: string;
}

export const EvidenceSignature: React.FC<EvidenceSignatureProps> = ({ language, className = '' }) => {
  const copy = COPY[language] ?? COPY.en;

  // Ίδιος χειρισμός με το HowWeDecideSection: το FAQ είναι prerendered στατική σελίδα που
  // υπάρχει στην παραγωγή και στην εφαρμογή, αλλά ΟΧΙ κάτω από vite dev/preview.
  const faqPath = language === 'gr' ? '/el/faq/' : '/faq/';
  const external = import.meta.env.DEV;
  const href = external ? `https://calmbeach.gr${faqPath}` : faqPath;

  return (
    <p className={`px-1 text-[11px] font-medium leading-snug text-slate-500 ${className}`.trim()}>
      {copy.line}{' '}
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="font-bold text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-slate-800 hover:decoration-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
      >
        {copy.link}
      </a>
    </p>
  );
};
