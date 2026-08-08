// The signed-in account area.
//
// WHAT IT IS FOR. Not "you are logged in" — that is already obvious from the
// avatar in the header. The first thing in this panel is the reason anyone
// signed in at all: their saved beaches, counted, with the promise that they
// travel. Identity, what we hold, and the two destructive actions sit below it.
//
// SHAPE. A bottom sheet on a phone and an anchored dropdown from `sm` up, in one
// component. The header's existing dropdown is `w-56`, which cannot hold a real
// sheet's worth of content at 320px, and a wider anchored panel overflows the
// screen. On a phone this is also simply where the thumb is — the app is used
// standing in sunlight, not at a desk.
//
// WHAT IS DELIBERATELY NOT HERE:
//   • Editing the name — Google owns it; an edit path buys nothing.
//   • "Download your data" — we hold a name, an email and a list of beach ids;
//     the privacy address covers portability at this size honestly.
//   • A device list — "signed in on 3 devices" alarms more than it reassures,
//     and we do not record it.
//   • Placeholders for photos and reviews — promising a feature that does not
//     exist yet is a debt paid with trust.

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Heart, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import { getLocalizedCopy, type SupportedLanguage } from '../../utils/i18n';

export interface AccountPanelProps {
  language: SupportedLanguage;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  savedCount: number;
  savedOtherIslandsCount?: number;
  onOpenSaved: () => void;
  onSignOut: () => void;
  onDeleteAccount: () => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}

type Copy = {
  title: string;
  close: string;
  savedOne: string;
  savedMany: string;
  savedPromise: string;
  savedEmpty: string;
  savedOtherIslands: string;
  dataTitle: string;
  dataName: string;
  dataSaved: string;
  dataSettings: string;
  dataNone: string;
  dataPrivacyLink: string;
  photosTitle: string;
  photosNone: string;
  photosPending: string;
  photosApproved: string;
  photosRejected: string;
  photosAdd: string;
  signOut: string;
  signOutHint: string;
  del: string;
  delConfirmTitle: string;
  delConfirmBody: string;
  delYes: string;
  delNo: string;
  delWorking: string;
  delFailed: string;
};

const COPY: Record<SupportedLanguage, Copy> = {
  gr: {
    title: 'Ο λογαριασμός σου',
    close: 'Κλείσιμο',
    savedOne: '1 αποθηκευμένη παραλία',
    savedMany: '{n} αποθηκευμένες παραλίες',
    savedPromise: 'Τις βρίσκεις από όποιο κινητό ή υπολογιστή κι αν μπεις.',
    savedEmpty: 'Δεν έχεις αποθηκεύσει παραλίες ακόμη. Πάτησε την καρδιά σε μια παραλία και θα τη βρίσκεις εδώ, σε όποια συσκευή κι αν μπεις.',
    savedOtherIslands: '+{n} σε άλλα νησιά',
    dataTitle: 'Τι κρατάμε για σένα',
    dataName: 'Το όνομα και το email σου, όπως μας τα έδωσε η Google.',
    dataSaved: 'Τις παραλίες που αποθήκευσες.',
    dataSettings: 'Τις ρυθμίσεις αναζήτησης που διάλεξες.',
    dataNone: 'Τίποτα άλλο. Δεν κρατάμε πού βρίσκεσαι, ούτε σε ποιες παραλίες πήγες.',
    dataPrivacyLink: 'Διάβασε την πολιτική απορρήτου',
    signOut: 'Αποσύνδεση',
    signOutHint: 'Οι παραλίες σου μένουν στον λογαριασμό.',
    del: 'Διαγραφή λογαριασμού',
    delConfirmTitle: 'Να σβήσουμε τον λογαριασμό σου;',
    delConfirmBody: 'Θα σβηστούν το όνομα, το email και οι αποθηκευμένες παραλίες σου. Δεν μπορούμε να τα επαναφέρουμε μετά.',
    delYes: 'Ναι, σβήσ\' τον',
    delNo: 'Άκυρο',
    delWorking: 'Σβήνουμε τον λογαριασμό σου…',
    delFailed: 'Δεν έγινε η διαγραφή. Δοκίμασε ξανά σε λίγο.',
  },
  en: {
    title: 'Your account',
    close: 'Close',
    savedOne: '1 saved beach',
    savedMany: '{n} saved beaches',
    savedPromise: "You'll find them on any phone or computer you sign in from.",
    savedEmpty: "You haven't saved any beaches yet. Tap the heart on a beach and you'll find it here, on any device you sign in from.",
    savedOtherIslands: '+{n} on other islands',
    dataTitle: 'What we keep about you',
    dataName: 'Your name and email, as Google gave them to us.',
    dataSaved: 'The beaches you saved.',
    dataSettings: 'The search settings you chose.',
    dataNone: "Nothing else. We don't keep where you are, or which beaches you went to.",
    dataPrivacyLink: 'Read the privacy policy',
    signOut: 'Sign out',
    signOutHint: 'Your beaches stay on your account.',
    del: 'Delete account',
    delConfirmTitle: 'Delete your account?',
    delConfirmBody: "Your name, your email and your saved beaches will be deleted. We can't bring them back afterwards.",
    delYes: 'Yes, delete it',
    delNo: 'Cancel',
    delWorking: 'Deleting your account…',
    delFailed: "That didn't work. Please try again in a moment.",
  },
  de: {
    title: 'Dein Konto',
    close: 'Schließen',
    savedOne: '1 gespeicherter Strand',
    savedMany: '{n} gespeicherte Strände',
    savedPromise: 'Du findest sie auf jedem Handy oder Computer, an dem du dich anmeldest.',
    savedEmpty: 'Du hast noch keine Strände gespeichert. Tippe auf das Herz bei einem Strand — dann findest du ihn hier, auf jedem Gerät.',
    savedOtherIslands: '+{n} auf anderen Inseln',
    dataTitle: 'Was wir über dich speichern',
    dataName: 'Deinen Namen und deine E-Mail, so wie Google sie uns gegeben hat.',
    dataSaved: 'Die Strände, die du gespeichert hast.',
    dataSettings: 'Die Sucheinstellungen, die du gewählt hast.',
    dataNone: 'Sonst nichts. Wir speichern nicht, wo du bist oder an welchen Stränden du warst.',
    dataPrivacyLink: 'Datenschutzerklärung lesen',
    signOut: 'Abmelden',
    signOutHint: 'Deine Strände bleiben in deinem Konto.',
    del: 'Konto löschen',
    delConfirmTitle: 'Dein Konto löschen?',
    delConfirmBody: 'Dein Name, deine E-Mail und deine gespeicherten Strände werden gelöscht. Wir können sie danach nicht wiederherstellen.',
    delYes: 'Ja, löschen',
    delNo: 'Abbrechen',
    delWorking: 'Dein Konto wird gelöscht…',
    delFailed: 'Das hat nicht geklappt. Bitte versuche es gleich noch einmal.',
  },
  fr: {
    title: 'Votre compte',
    close: 'Fermer',
    savedOne: '1 plage enregistrée',
    savedMany: '{n} plages enregistrées',
    savedPromise: 'Vous les retrouvez sur tout téléphone ou ordinateur où vous vous connectez.',
    savedEmpty: "Vous n'avez pas encore enregistré de plage. Touchez le cœur sur une plage et vous la retrouverez ici, sur n'importe quel appareil.",
    savedOtherIslands: '+{n} sur d\'autres îles',
    dataTitle: 'Ce que nous gardons sur vous',
    dataName: 'Votre nom et votre e-mail, tels que Google nous les a transmis.',
    dataSaved: 'Les plages que vous avez enregistrées.',
    dataSettings: 'Les réglages de recherche que vous avez choisis.',
    dataNone: 'Rien d\'autre. Nous ne gardons ni où vous êtes, ni les plages où vous êtes allé.',
    dataPrivacyLink: 'Lire la politique de confidentialité',
    signOut: 'Se déconnecter',
    signOutHint: 'Vos plages restent sur votre compte.',
    del: 'Supprimer le compte',
    delConfirmTitle: 'Supprimer votre compte ?',
    delConfirmBody: 'Votre nom, votre e-mail et vos plages enregistrées seront supprimés. Nous ne pourrons pas les récupérer ensuite.',
    delYes: 'Oui, supprimer',
    delNo: 'Annuler',
    delWorking: 'Suppression de votre compte…',
    delFailed: "Cela n'a pas fonctionné. Réessayez dans un instant.",
  },
  it: {
    title: 'Il tuo account',
    close: 'Chiudi',
    savedOne: '1 spiaggia salvata',
    savedMany: '{n} spiagge salvate',
    savedPromise: 'Le ritrovi da qualsiasi telefono o computer con cui accedi.',
    savedEmpty: 'Non hai ancora salvato spiagge. Tocca il cuore su una spiaggia e la ritroverai qui, su qualsiasi dispositivo.',
    savedOtherIslands: '+{n} su altre isole',
    dataTitle: 'Cosa conserviamo di te',
    dataName: 'Il tuo nome e la tua email, così come ce li ha dati Google.',
    dataSaved: 'Le spiagge che hai salvato.',
    dataSettings: 'Le impostazioni di ricerca che hai scelto.',
    dataNone: 'Nient\'altro. Non conserviamo dove sei, né in quali spiagge sei stato.',
    dataPrivacyLink: 'Leggi l\'informativa sulla privacy',
    signOut: 'Esci',
    signOutHint: 'Le tue spiagge restano sul tuo account.',
    del: 'Elimina account',
    delConfirmTitle: 'Eliminare il tuo account?',
    delConfirmBody: 'Il tuo nome, la tua email e le spiagge salvate verranno eliminati. Dopo non potremo recuperarli.',
    delYes: 'Sì, elimina',
    delNo: 'Annulla',
    delWorking: 'Stiamo eliminando il tuo account…',
    delFailed: 'Non ha funzionato. Riprova tra poco.',
  },
};

const ROW = 'group flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl bg-white/62 px-4 py-3 text-left font-bold text-slate-800 shadow-sm ring-1 ring-white/55 transition hover:bg-cyan-50 hover:text-cyan-800 active:scale-[0.995] active:bg-cyan-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';

export const AccountPanel: React.FC<AccountPanelProps> = ({
  language,
  name,
  email,
  avatarUrl,
  savedCount,
  savedOtherIslandsCount = 0,
  onOpenSaved,
  onSignOut,
  onDeleteAccount,
  onClose,
}) => {
  const copy = getLocalizedCopy(language, COPY);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // iOS Safari ignores `body { overflow: hidden }` for touch scrolling, so the
  // page behind a sheet keeps moving and peeks through. Pin the body instead and
  // restore the scroll position on close. Copied from the one correct
  // implementation in the codebase (components/BeachSearcherHome.tsx).
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (typeof window === 'undefined' || window.innerWidth >= 640) return undefined;

    const { body } = document;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Escape backs out of the confirmation first — one press should never
      // dismiss both the question and the panel that asked it.
      if (confirmingDelete) setConfirmingDelete(false);
      else onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [confirmingDelete, onClose]);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    const result = await onDeleteAccount();
    if (!result.ok) {
      setDeleting(false);
      setDeleteError(copy.delFailed);
      return;
    }
    onClose();
  };

  const savedLabel = savedCount === 1
    ? copy.savedOne
    : copy.savedMany.replace('{n}', String(savedCount));

  return (
    <>
      {/* Backdrop exists only where the panel is a sheet. */}
      <div
        className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-[2px] sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
        className="fixed inset-x-0 bottom-0 z-[80] max-h-[85svh] overflow-y-auto overscroll-contain rounded-t-[1.65rem] border-t border-white/70 bg-white/96 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-xl shadow-sky-900/14 ring-1 ring-white/70 backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:z-[60] sm:mt-2 sm:max-h-none sm:w-80 sm:rounded-2xl sm:border sm:border-cyan-100 sm:p-2"
      >
        <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />

        {/* Who you are — confirmation at a glance, no controls. Travellers often
            have two Google accounts on one phone. */}
        <div className="flex items-center gap-3 rounded-2xl bg-sky-50/70 px-3 py-3 ring-1 ring-white/60">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-cyan-100"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-sm font-extrabold text-[#007a83] ring-1 ring-cyan-100">
              {(name || email || '?').trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            {name && <span className="block truncate text-sm font-bold text-slate-800">{name}</span>}
            {email && <span className="block truncate text-xs font-semibold text-slate-600">{email}</span>}
          </div>
        </div>

        {/* The reason the account exists. Heaviest element on purpose. */}
        <button
          type="button"
          onClick={() => { onClose(); onOpenSaved(); }}
          className={`${ROW} mt-2`}
        >
          <span className="flex min-w-0 items-center gap-3">
            <Heart
              className={savedCount > 0 ? 'h-5 w-5 shrink-0 fill-rose-500 text-rose-500' : 'h-5 w-5 shrink-0 text-slate-300'}
              aria-hidden="true"
            />
            <span className="min-w-0">
              {savedCount > 0 ? (
                <>
                  <span className="block truncate">{savedLabel}</span>
                  <span className="block truncate text-xs font-semibold text-slate-600">{copy.savedPromise}</span>
                </>
              ) : (
                // The one place text is allowed to wrap: an empty state that is
                // cut off explains nothing.
                <span className="block text-xs font-semibold leading-relaxed text-slate-600">{copy.savedEmpty}</span>
              )}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {savedOtherIslandsCount > 0 && (
              <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-extrabold text-cyan-700 ring-1 ring-cyan-100">
                {copy.savedOtherIslands.replace('{n}', String(savedOtherIslandsCount))}
              </span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-cyan-600" aria-hidden="true" />
          </span>
        </button>

        {/* Transparency, folded away. Someone who came for their beaches should
            not have to walk past a wall of policy to reach them. */}
        <details className="group mt-2 rounded-2xl bg-white/62 px-4 py-3 shadow-sm ring-1 ring-white/55">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 font-bold text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 [&::-webkit-details-marker]:hidden">
            <span className="flex min-w-0 items-center gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-[#007a83]" aria-hidden="true" />
              <span className="truncate">{copy.dataTitle}</span>
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-300 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="mt-2 space-y-1.5 text-xs font-semibold leading-relaxed text-slate-600">
            <li>{copy.dataName}</li>
            <li>{copy.dataSaved}</li>
            <li>{copy.dataSettings}</li>
            <li className="text-slate-500">{copy.dataNone}</li>
          </ul>
          <button
            type="button"
            onClick={() => document.dispatchEvent(new CustomEvent('calmbeach:openLegalModal', { detail: 'privacy' }))}
            className="mt-2 text-xs font-extrabold text-[#007a83] underline underline-offset-2 hover:text-cyan-800"
          >
            {copy.dataPrivacyLink}
          </button>
        </details>

        <button type="button" onClick={onSignOut} className={`${ROW} mt-2`}>
          <span className="flex min-w-0 items-center gap-3">
            <LogOut className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate">{copy.signOut}</span>
              <span className="block truncate text-xs font-semibold text-slate-600">{copy.signOutHint}</span>
            </span>
          </span>
        </button>

        {/* Destructive, and shaped like it: quiet until pressed, then a real
            question with the consequence spelled out before the red button. */}
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-xs font-bold text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {copy.del}
          </button>
        ) : (
          <div className="mt-2 rounded-2xl bg-rose-50 px-4 py-3 ring-1 ring-rose-100">
            <p className="text-sm font-extrabold text-rose-900">{copy.delConfirmTitle}</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-rose-800">{copy.delConfirmBody}</p>
            {deleteError && <p className="mt-2 text-xs font-bold text-rose-900">{deleteError}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="min-h-11 rounded-full bg-rose-600 px-4 text-sm font-extrabold text-white transition hover:bg-rose-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                {deleting ? copy.delWorking : copy.delYes}
              </button>
              <button
                type="button"
                onClick={() => { setConfirmingDelete(false); setDeleteError(''); }}
                disabled={deleting}
                className="min-h-11 rounded-full px-4 text-sm font-extrabold text-rose-900 transition hover:bg-rose-100 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                {copy.delNo}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AccountPanel;
