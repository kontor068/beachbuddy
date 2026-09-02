import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { photoSrcSet, sizedPhotoUrl } from '../../utils/photoSizing.mjs';

/**
 * ΜΕΓΕΝΘΥΣΗ ΦΩΤΟΓΡΑΦΙΑΣ ΠΑΡΑΛΙΑΣ (Μίλτος, 02/09/2026).
 *
 * Η σελίδα της παραλίας έδειχνε μία μεγάλη φωτογραφία και από κάτω τις υπόλοιπες σε
 * τετράγωνα 96-128 px. Καμία δεν πατιόταν: οι μικρές ήταν σκέτα <img> μέσα σε <div>, οπότε
 * ο επισκέπτης έβλεπε ότι υπάρχουν κι άλλες φωτογραφίες και δεν είχε κανέναν τρόπο να τις
 * δει. Και οι τρεις όψεις κόβονται με `object-fit: cover` — στο τετράγωνο χάνεται σχεδόν
 * όλο το πλάτος της παραλίας — άρα η μόνη επιφάνεια όπου φαίνεται η ΟΛΟΚΛΗΡΗ φωτογραφία
 * είναι αυτή εδώ: `object-contain`, χωρίς κόψιμο, στο μεγαλύτερο αρχείο που σερβίρει το
 * Commons για την οθόνη.
 *
 * ΤΟ CREDIT ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ ΤΗΣ. Η σελίδα τύπωνε τη γραμμή του δημιουργού μόνο για την
 * ΠΡΩΤΗ φωτογραφία (`getPhotoCredit(..., 0)`), γιατί μόνο η πρώτη ήταν σε μέγεθος που να
 * δικαιολογεί υπογραφή. Από τη στιγμή που ανοίγουν και οι υπόλοιπες σε πλήρες μέγεθος, η
 * άδεια (958 από τις 1.054 φωτογραφίες μας απαιτούν αναφορά δημιουργού) ζητά υπογραφή και
 * σε αυτές — γι' αυτό κάθε φωτογραφία εδώ φέρνει τη δική της.
 */

export interface LightboxPhoto {
  url: string;
  /** e.g. "Φωτογραφία: Sergey Rsavin / CC BY 3.0" — omitted when we have nothing on record. */
  creditLabel?: string | null;
  /** The file page. Empty for visitor photos: the permission lives in the form they filled in. */
  creditHref?: string | null;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  /** Index of the open photo, or null when the lightbox is closed. */
  index: number | null;
  beachName: string;
  language: LanguageCode;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

const copy = {
  close: { en: 'Close', gr: 'Κλείσιμο', de: 'Schließen', fr: 'Fermer', it: 'Chiudi' },
  previous: {
    en: 'Previous photo',
    gr: 'Προηγούμενη φωτογραφία',
    de: 'Vorheriges Foto',
    fr: 'Photo précédente',
    it: 'Foto precedente',
  },
  next: {
    en: 'Next photo',
    gr: 'Επόμενη φωτογραφία',
    de: 'Nächstes Foto',
    fr: 'Photo suivante',
    it: 'Foto successiva',
  },
};

/** aria-label for the thumbnail/photo that opens this lightbox. */
export const getOpenPhotoLabel = (
  language: LanguageCode,
  beachName: string,
  position: number,
  total: number,
): string => getLocalizedCopy(language, {
  en: `Open photo ${position} of ${total} of ${beachName} larger`,
  gr: `Άνοιγμα φωτογραφίας ${position} από ${total} της παραλίας ${beachName} σε μεγέθυνση`,
  de: `Foto ${position} von ${total} von ${beachName} vergrößern`,
  fr: `Agrandir la photo ${position} sur ${total} de ${beachName}`,
  it: `Ingrandisci la foto ${position} di ${total} di ${beachName}`,
});

/** Horizontal travel (px) that counts as a swipe rather than a tap or a vertical scroll. */
const SWIPE_THRESHOLD_PX = 44;

export const PhotoLightbox = ({
  photos,
  index,
  beachName,
  language,
  onClose,
  onIndexChange,
}: PhotoLightboxProps) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isOpen = index !== null && index >= 0 && index < photos.length;
  const total = photos.length;

  const goTo = useCallback((next: number) => {
    if (total === 0) return;
    // Wrap around: three photos and no way back to the first one is a dead end on a phone,
    // where the arrows are the only navigation.
    onIndexChange((next + total) % total);
  }, [onIndexChange, total]);

  useEffect(() => {
    if (!isOpen) return undefined;

    previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goTo((index as number) - 1);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goTo((index as number) + 1);
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href]'),
      ).filter(element => element.offsetParent !== null);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocusedElementRef.current?.focus();
    };
  }, [isOpen, index, goTo, onClose]);

  // Same scroll lock the account sheet uses: `overflow: hidden` alone does not hold on iOS,
  // so the body is pinned and the scroll position restored on close.
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return undefined;

    const body = document.body;
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
  }, [isOpen]);

  if (!isOpen) return null;

  const current = photos[index as number];
  const closeLabel = getLocalizedCopy(language, copy.close);
  const previousLabel = getLocalizedCopy(language, copy.previous);
  const nextLabel = getLocalizedCopy(language, copy.next);
  const hasMany = total > 1;

  const handleTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !hasMany) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

    goTo((index as number) + (dx < 0 ? 1 : -1));
  };

  return (
    <div className="fixed inset-0 z-[1300] flex animate-fade-in flex-col bg-slate-950/94 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={beachName}
        className="flex h-full w-full flex-col"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2">
          <p className="min-w-0 truncate text-sm font-bold text-white/90">
            {beachName}
            {hasMany && (
              <span className="ml-2 font-semibold text-white/60">{(index as number) + 1}/{total}</span>
            )}
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/12 text-white transition-colors hover:bg-white/22 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Πατάς δίπλα από τη φωτογραφία και κλείνει — αυτό περιμένει ο καθένας από μια
            μεγεθυμένη εικόνα. Ο έλεγχος `target === currentTarget` είναι που το κάνει σωστό:
            κλείνει ΜΟΝΟ το σκούρο κενό γύρω από το καρέ, όχι η ίδια η φωτογραφία και όχι τα
            βελάκια πάνω της. */}
        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-4"
          onClick={event => {
            if (event.target === event.currentTarget) onClose();
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* `object-contain`: this is the one surface that shows the whole frame, so nothing
              here may crop. */}
          <img
            key={current.url}
            src={sizedPhotoUrl(current.url, 1600)}
            srcSet={photoSrcSet(current.url, [800, 1200, 1600, 2000])}
            sizes="100vw"
            alt={beachName}
            className="max-h-full max-w-full animate-fade-in rounded-lg object-contain shadow-2xl"
            referrerPolicy="no-referrer"
            decoding="async"
          />

          {hasMany && (
            <>
              <button
                type="button"
                onClick={() => goTo((index as number) - 1)}
                aria-label={previousLabel}
                className="absolute left-1 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-slate-950/55 text-white transition-colors hover:bg-slate-950/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:left-3"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => goTo((index as number) + 1)}
                aria-label={nextLabel}
                className="absolute right-1 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-slate-950/55 text-white transition-colors hover:bg-slate-950/75 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:right-3"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        <div className="shrink-0 px-4 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-3 text-center">
          {current.creditLabel && (
            <p className="text-[11px] font-medium leading-snug text-white/70">
              {current.creditHref ? (
                <a
                  href={current.creditHref}
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-white/40 underline-offset-2 hover:text-white"
                >
                  {current.creditLabel}
                </a>
              ) : (
                current.creditLabel
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
