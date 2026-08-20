// ─────────────────────────────────────────────────────────────────────────────
// ΠΡΟΣΤΑΣΙΑ ΑΠΟ ΤΗ ΜΕΤΑΦΡΑΣΗ ΤΟΥ BROWSER (20/08/2026)
//
// Το site είναι ελληνικό και το μισό κοινό του είναι τουρίστες. Chrome και Edge
// προσφέρονται αυτόματα να μεταφράσουν τη σελίδα — και όταν ο επισκέπτης δεχτεί, ο
// μεταφραστής ΑΝΤΙΚΑΘΙΣΤΑ κείμενο μέσα στη σελίδα με δικά του κομμάτια. Το React δεν
// το ξέρει αυτό: την επόμενη φορά που θα αλλάξει μια λέξη (π.χ. αλλάζει η ώρα στο
// ρυθμιστικό), ζητάει από τον browser να αφαιρέσει ένα κείμενο που ο μεταφραστής έχει
// ήδη μετακινήσει — και ο browser πετάει
// «Failed to execute 'removeChild' on 'Node'», που για τον επισκέπτη σημαίνει
// ΟΛΟΚΛΗΡΗ η σελίδα σβήνει και μένει η οθόνη σφάλματος.
//
// Πραγματικό περιστατικό: Edge 151 σε Windows, /beaches/karpathos/, 20/08/2026.
//
// Η θωράκιση: αν το React ζητήσει να αφαιρέσει/βάλει κάτι σε λάθος γονιό, το
// αγνοούμε αντί να πετάξουμε σφάλμα. Δεν αλλάζει ΤΙΠΟΤΑ σε κανονική λειτουργία —
// επεμβαίνει μόνο στις ακριβώς ίδιες περιπτώσεις που ούτως ή άλλως θα έσκαγαν. Το
// χειρότερο που μπορεί να μείνει είναι μια μεταφρασμένη λέξη που δεν ανανεώθηκε·
// άπειρα καλύτερο από λευκή σελίδα.
//
// Είναι ο καθιερωμένος τρόπος αντιμετώπισης (React issue #11538) — όχι δικό μας κόλπο.
// ─────────────────────────────────────────────────────────────────────────────

let installed = false;

export const installDomTranslationGuard = (): void => {
  if (installed || typeof Node !== 'function' || !Node.prototype) return;
  installed = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChildSafely<T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      // Ο μεταφραστής το έχει ήδη μετακινήσει. Δεν υπάρχει τίποτα να αφαιρεθεί.
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function insertBeforeSafely<T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      // Το σημείο αναφοράς δεν είναι πια εδώ· βάλ' το στο τέλος αντί να σκάσεις.
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
};
