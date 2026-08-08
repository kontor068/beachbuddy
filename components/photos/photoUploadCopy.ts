// Co-located copy for the "add your photo" sheet, in the same per-component
// pattern as landingCopy / homeCopy — and, like those, typed as a
// Record<LanguageCode, …> so adding a field fails the build until all five
// locales have it rather than silently dropping a German visitor into English.
//
// FORMALITY, matching the rest of the app: de → du, it → tu, fr → vous,
// en/gr → second person singular.
//
// TONE: this is a form that asks a stranger for something and then tells them
// "not yet". Every message has to be true — we do not say "it's live", we say a
// person will look at it. The rights line is deliberately plain: a checkbox
// nobody understands is not consent.

import type { LanguageCode } from '../../types';

export type PhotoUploadCopy = {
  title: string;
  subtitle: string;
  close: string;
  /** Shown while nobody is signed in — the sheet doubles as the sign-in reason. */
  signInTitle: string;
  signInBody: string;
  signInCta: string;
  beachLabel: string;
  beachPlaceholder: string;
  beachSearching: string;
  beachNoResults: string;
  beachChange: string;
  pickFile: string;
  pickFileAgain: string;
  fileHint: string;
  captionLabel: string;
  captionPlaceholder: string;
  captionOptional: string;
  /** The rights grant. Must stay one readable sentence. */
  rightsLabel: string;
  /**
   * Whether the uploader's name appears under the published photo. ASKED, never
   * assumed: this publishes the real name Google gave us on a page search
   * engines index, and silence is not consent for that. Default ticked, because
   * attribution is what most people sending a photo want — but it is a decision
   * on the record, stored as beach_photos.show_credit.
   */
  creditLabel: string;
  creditOnHint: string;
  creditOffHint: string;
  privacyNote: string;
  submit: string;
  submitting: string;
  preparing: string;
  successTitle: string;
  successBody: string;
  successAgain: string;
  successDone: string;
  errors: {
    unreadable: string;
    tooSmall: string;
    notSignedIn: string;
    quota: string;
    failed: string;
    noBeach: string;
    noRights: string;
  };
};

export const photoUploadCopy: Record<LanguageCode, PhotoUploadCopy> = {
  gr: {
    title: 'Πρόσθεσε τη φωτογραφία σου',
    subtitle: 'Οι καλές φωτογραφίες μπαίνουν στην κάρτα της παραλίας, με το όνομά σου από κάτω.',
    close: 'Κλείσιμο',
    signInTitle: 'Χρειάζεται σύνδεση',
    signInBody: 'Μπαίνεις με τον λογαριασμό Google σου, για να ξέρουμε ποιανού είναι η φωτογραφία και να σου τη γράψουμε σωστά.',
    signInCta: 'Σύνδεση με Google',
    beachLabel: 'Ποια παραλία;',
    beachPlaceholder: 'Γράψε το όνομα της παραλίας',
    beachSearching: 'Ψάχνουμε…',
    beachNoResults: 'Δεν βρήκα παραλία με αυτό το όνομα.',
    beachChange: 'Αλλαγή',
    pickFile: 'Διάλεξε φωτογραφία',
    pickFileAgain: 'Διάλεξε άλλη',
    fileHint: 'Μία φωτογραφία τη φορά. Τη σμικρύνουμε εμείς — δεν χρειάζεται να κάνεις τίποτα.',
    captionLabel: 'Δυο λόγια για τη φωτογραφία',
    captionPlaceholder: 'π.χ. Νωρίς το πρωί, πριν φυσήξει',
    captionOptional: 'προαιρετικό',
    rightsLabel: 'Η φωτογραφία είναι δική μου και δίνω άδεια στο CalmBeach να τη δείξει στη σελίδα της παραλίας.',
    creditLabel: 'Να φαίνεται το όνομά μου κάτω από τη φωτογραφία.',
    creditOnHint: 'Θα γράφει το όνομα που έχεις στη Google.',
    creditOffHint: 'Η φωτογραφία θα μπει χωρίς όνομα.',
    privacyNote: 'Σβήνουμε τα κρυφά στοιχεία του αρχείου — μαζί και το σημείο όπου τραβήχτηκε — πριν φύγει από το κινητό σου.',
    submit: 'Στείλε τη φωτογραφία',
    // Passive, matching landingCopy's «Στέλνεται…» — the app must not become a
    // second narrator speaking in the first person singular.
    submitting: 'Στέλνεται…',
    preparing: 'Ετοιμάζεται η φωτογραφία…',
    successTitle: 'Την πήραμε — ευχαριστούμε.',
    successBody: 'Θα τη δει άνθρωπος πριν δημοσιευτεί. Αν περάσει, θα εμφανιστεί στην κάρτα της παραλίας.',
    successAgain: 'Στείλε κι άλλη',
    successDone: 'Τέλεια',
    errors: {
      unreadable: 'Δεν μπόρεσα να διαβάσω αυτό το αρχείο. Δοκίμασε μια κανονική φωτογραφία από το κινητό σου.',
      tooSmall: 'Η φωτογραφία είναι πολύ μικρή για να δημοσιευτεί. Θέλουμε κάτι μεγαλύτερο.',
      notSignedIn: 'Έληξε η σύνδεσή σου. Μπες ξανά και ξαναδοκίμασε.',
      quota: 'Έχεις στείλει ήδη πολλές φωτογραφίες. Περίμενε να ελεγχθούν αυτές που εκκρεμούν.',
      failed: 'Κάτι πήγε στραβά και δεν στάλθηκε. Δοκίμασε ξανά σε λίγο.',
      noBeach: 'Διάλεξε πρώτα παραλία.',
      noRights: 'Χρειάζεται να επιβεβαιώσεις ότι η φωτογραφία είναι δική σου.',
    },
  },
  en: {
    title: 'Add your photo',
    subtitle: 'Good photos go on the beach card itself, credited to you.',
    close: 'Close',
    signInTitle: 'Sign in first',
    signInBody: 'Sign in with Google so we know whose photo it is and can credit you properly.',
    signInCta: 'Sign in with Google',
    beachLabel: 'Which beach?',
    beachPlaceholder: 'Type the name of the beach',
    beachSearching: 'Searching…',
    beachNoResults: 'No beach found with that name.',
    beachChange: 'Change',
    pickFile: 'Choose a photo',
    pickFileAgain: 'Choose another',
    fileHint: 'One photo at a time. We shrink it for you — nothing to do on your side.',
    captionLabel: 'A line about the photo',
    captionPlaceholder: 'e.g. Early morning, before the wind picked up',
    captionOptional: 'optional',
    rightsLabel: 'This photo is mine, and I allow CalmBeach to show it on the beach page.',
    creditLabel: 'Show my name under the photo.',
    creditOnHint: 'It will show the name you have on Google.',
    creditOffHint: 'The photo goes up with no name on it.',
    privacyNote: 'We strip the hidden data in the file — including where it was taken — before it leaves your phone.',
    submit: 'Send the photo',
    submitting: 'Sending…',
    preparing: 'Preparing your photo…',
    successTitle: 'Got it — thank you.',
    successBody: 'A person reviews it before it goes live. If it passes, it appears on the beach card.',
    successAgain: 'Send another',
    successDone: 'Done',
    errors: {
      unreadable: 'That file could not be read. Try a normal photo from your phone.',
      tooSmall: 'That photo is too small to publish. We need a bigger one.',
      notSignedIn: 'Your session expired. Sign in again and retry.',
      quota: 'You have already sent a lot of photos. Wait for the pending ones to be reviewed.',
      failed: 'Something went wrong and it was not sent. Try again in a moment.',
      noBeach: 'Pick a beach first.',
      noRights: 'Please confirm the photo is yours.',
    },
  },
  de: {
    title: 'Füge dein Foto hinzu',
    subtitle: 'Gute Fotos kommen auf die Strandkarte selbst — mit deinem Namen darunter.',
    close: 'Schließen',
    signInTitle: 'Zuerst anmelden',
    signInBody: 'Melde dich mit Google an, damit wir wissen, wessen Foto es ist, und dich richtig nennen können.',
    signInCta: 'Mit Google anmelden',
    beachLabel: 'Welcher Strand?',
    beachPlaceholder: 'Namen des Strandes eingeben',
    beachSearching: 'Suche…',
    beachNoResults: 'Kein Strand mit diesem Namen gefunden.',
    beachChange: 'Ändern',
    pickFile: 'Foto auswählen',
    pickFileAgain: 'Anderes auswählen',
    fileHint: 'Ein Foto auf einmal. Wir verkleinern es für dich — du musst nichts tun.',
    captionLabel: 'Ein Satz zum Foto',
    captionPlaceholder: 'z. B. Früh am Morgen, bevor der Wind kam',
    captionOptional: 'optional',
    rightsLabel: 'Das Foto gehört mir, und ich erlaube CalmBeach, es auf der Strandseite zu zeigen.',
    creditLabel: 'Meinen Namen unter dem Foto zeigen.',
    creditOnHint: 'Es erscheint der Name, den du bei Google hast.',
    creditOffHint: 'Das Foto erscheint ohne Namen.',
    privacyNote: 'Wir entfernen die versteckten Daten der Datei — auch den Aufnahmeort — bevor sie dein Handy verlässt.',
    submit: 'Foto senden',
    submitting: 'Senden…',
    preparing: 'Foto wird vorbereitet…',
    successTitle: 'Angekommen — danke.',
    successBody: 'Ein Mensch prüft es vor der Veröffentlichung. Wenn es passt, erscheint es auf der Strandkarte.',
    successAgain: 'Noch eins senden',
    successDone: 'Fertig',
    errors: {
      unreadable: 'Diese Datei konnte nicht gelesen werden. Versuche ein normales Foto von deinem Handy.',
      tooSmall: 'Das Foto ist zu klein zum Veröffentlichen. Wir brauchen ein größeres.',
      notSignedIn: 'Deine Sitzung ist abgelaufen. Melde dich erneut an und versuche es nochmal.',
      quota: 'Du hast schon viele Fotos gesendet. Warte, bis die offenen geprüft sind.',
      failed: 'Etwas ist schiefgelaufen, es wurde nicht gesendet. Versuche es gleich nochmal.',
      noBeach: 'Wähle zuerst einen Strand.',
      noRights: 'Bitte bestätige, dass das Foto dir gehört.',
    },
  },
  fr: {
    title: 'Ajoutez votre photo',
    subtitle: 'Les bonnes photos vont sur la fiche de la plage, à votre nom.',
    close: 'Fermer',
    signInTitle: 'Connectez-vous d’abord',
    signInBody: 'Connectez-vous avec Google pour que nous sachions à qui est la photo et puissions vous créditer.',
    signInCta: 'Se connecter avec Google',
    beachLabel: 'Quelle plage ?',
    beachPlaceholder: 'Saisissez le nom de la plage',
    beachSearching: 'Recherche…',
    beachNoResults: 'Aucune plage trouvée avec ce nom.',
    beachChange: 'Changer',
    pickFile: 'Choisir une photo',
    pickFileAgain: 'En choisir une autre',
    fileHint: 'Une photo à la fois. Nous la réduisons pour vous — rien à faire de votre côté.',
    captionLabel: 'Une phrase sur la photo',
    captionPlaceholder: 'ex. Tôt le matin, avant le vent',
    captionOptional: 'facultatif',
    rightsLabel: 'Cette photo est la mienne et j’autorise CalmBeach à l’afficher sur la page de la plage.',
    creditLabel: 'Afficher mon nom sous la photo.',
    creditOnHint: 'Ce sera le nom que vous avez sur Google.',
    creditOffHint: 'La photo sera publiée sans nom.',
    privacyNote: 'Nous supprimons les données cachées du fichier — dont le lieu de prise de vue — avant qu’il ne quitte votre téléphone.',
    submit: 'Envoyer la photo',
    submitting: 'Envoi…',
    preparing: 'Préparation de la photo…',
    successTitle: 'Bien reçue — merci.',
    successBody: 'Une personne la vérifie avant publication. Si elle passe, elle apparaîtra sur la fiche de la plage.',
    successAgain: 'En envoyer une autre',
    successDone: 'Terminé',
    errors: {
      unreadable: 'Ce fichier n’a pas pu être lu. Essayez une photo normale prise avec votre téléphone.',
      tooSmall: 'Cette photo est trop petite pour être publiée. Il en faut une plus grande.',
      notSignedIn: 'Votre session a expiré. Reconnectez-vous et réessayez.',
      quota: 'Vous avez déjà envoyé beaucoup de photos. Attendez que celles en attente soient vérifiées.',
      failed: 'Un problème est survenu, la photo n’a pas été envoyée. Réessayez dans un instant.',
      noBeach: 'Choisissez d’abord une plage.',
      noRights: 'Veuillez confirmer que la photo est la vôtre.',
    },
  },
  it: {
    title: 'Aggiungi la tua foto',
    subtitle: 'Le foto belle finiscono sulla scheda della spiaggia, con il tuo nome.',
    close: 'Chiudi',
    signInTitle: 'Prima accedi',
    signInBody: 'Accedi con Google così sappiamo di chi è la foto e possiamo citarti correttamente.',
    signInCta: 'Accedi con Google',
    beachLabel: 'Quale spiaggia?',
    beachPlaceholder: 'Scrivi il nome della spiaggia',
    beachSearching: 'Cerco…',
    beachNoResults: 'Nessuna spiaggia trovata con questo nome.',
    beachChange: 'Cambia',
    pickFile: 'Scegli una foto',
    pickFileAgain: 'Scegline un’altra',
    fileHint: 'Una foto alla volta. La rimpiccioliamo noi — tu non devi fare nulla.',
    captionLabel: 'Una frase sulla foto',
    captionPlaceholder: 'es. Presto la mattina, prima del vento',
    captionOptional: 'facoltativo',
    rightsLabel: 'La foto è mia e autorizzo CalmBeach a mostrarla nella pagina della spiaggia.',
    creditLabel: 'Mostra il mio nome sotto la foto.',
    creditOnHint: 'Comparirà il nome che hai su Google.',
    creditOffHint: 'La foto viene pubblicata senza nome.',
    privacyNote: 'Togliamo i dati nascosti del file — anche il luogo dello scatto — prima che lasci il tuo telefono.',
    submit: 'Invia la foto',
    submitting: 'Invio…',
    preparing: 'Preparo la foto…',
    successTitle: 'Ricevuta — grazie.',
    successBody: 'Una persona la controlla prima della pubblicazione. Se passa, appare sulla scheda della spiaggia.',
    successAgain: 'Inviane un’altra',
    successDone: 'Fatto',
    errors: {
      unreadable: 'Non è stato possibile leggere questo file. Prova con una foto normale dal telefono.',
      tooSmall: 'Questa foto è troppo piccola per essere pubblicata. Ne serve una più grande.',
      notSignedIn: 'La sessione è scaduta. Accedi di nuovo e riprova.',
      quota: 'Hai già inviato molte foto. Aspetta che quelle in attesa vengano controllate.',
      failed: 'Qualcosa è andato storto e non è stata inviata. Riprova tra poco.',
      noBeach: 'Scegli prima una spiaggia.',
      noRights: 'Conferma che la foto è tua.',
    },
  },
};
