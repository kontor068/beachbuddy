import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, LoaderCircle, LogIn, Search, X } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { trackEvent } from '../../services/analyticsService';
import {
  type PhotoUploadFailure,
  type PreparedPhoto,
  prepareBeachPhoto,
  releasePreparedPhoto,
  uploadBeachPhoto,
} from '../../services/beachPhotoUpload';
import { photoUploadCopy } from './photoUploadCopy';

// The form that finally makes an account worth having.
//
// SHAPE — a bottom sheet on a phone, a centred card on a desktop, mirroring
// IslandSelectorModal so the app has one modal language and not two. 88% of the
// traffic is on a phone, which is also where the camera is, so the phone layout
// is the real one and the desktop card is the courtesy.
//
// THE ORDER OF THE FIELDS IS THE ARGUMENT. Beach first, then photo, then the
// rights line last, directly above the send button: the checkbox is the moment
// someone actually grants us a licence, so it belongs where it will be read,
// not buried under a preview they have already scrolled past.
//
// WHY IT DOES NOT SEARCH ON ITS OWN: the national beach index lives inside
// App.tsx (built once, ~2.850 entries, shared with the header search). Passing
// a search function in keeps one index in memory instead of two, and keeps this
// component ignorant of how beaches are stored.

export type PhotoBeachOption = {
  beachId: number;
  regionId: string;
  label: string;
  subtitle: string;
};

interface AddBeachPhotoSheetProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
  /** Null when signed out — the sheet then shows the sign-in reason instead of the form. */
  userId: string | null;
  isSignedIn: boolean;
  onSignIn: () => void;
  /** Set when opened from a beach page, so nobody has to search for where they are standing. */
  preselectedBeach?: PhotoBeachOption | null;
  onSearchBeaches: (query: string) => Promise<PhotoBeachOption[]>;
  /** Where the sheet was opened from — analytics only. */
  source: string;
}

type Stage = 'form' | 'preparing' | 'sending' | 'sent';

export const AddBeachPhotoSheet: React.FC<AddBeachPhotoSheetProps> = ({
  isOpen,
  onClose,
  language,
  userId,
  isSignedIn,
  onSignIn,
  preselectedBeach,
  onSearchBeaches,
  source,
}) => {
  const c = getLocalizedCopy(language, photoUploadCopy);

  const [beach, setBeach] = useState<PhotoBeachOption | null>(preselectedBeach || null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhotoBeachOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [caption, setCaption] = useState('');
  const [hasRights, setHasRights] = useState(false);
  // Default ON: attribution is what most contributors want, and it is the reward
  // the feature promises. What changed is that it is now a recorded choice.
  const [showCredit, setShowCredit] = useState(true);
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  // The prepared blob is held in a ref as well as in state, so the unmount
  // cleanup revokes the CURRENT object URL rather than the one captured when
  // the effect was created. Without it, replacing a photo leaks the first one.
  const photoRef = useRef<PreparedPhoto | null>(null);

  const setPreparedPhoto = useCallback((next: PreparedPhoto | null) => {
    releasePreparedPhoto(photoRef.current);
    photoRef.current = next;
    setPhoto(next);
  }, []);

  // A fresh sheet every time it opens: a half-filled form from three days ago is
  // never what someone wants to see, and a stale beach is actively wrong.
  useEffect(() => {
    if (!isOpen) return;
    setBeach(preselectedBeach || null);
    setQuery('');
    setResults([]);
    setCaption('');
    setHasRights(false);
    setShowCredit(true);
    setShowCredit(true);
    setStage('form');
    setError(null);
    setPreparedPhoto(null);
    trackEvent('photo_sheet_opened', undefined, { source, signed_in: isSignedIn ? 1 : 0 });
    // `isSignedIn` is read for the event only; re-running on a sign-in flip would
    // wipe a form someone is in the middle of filling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preselectedBeach, setPreparedPhoto, source]);

  useEffect(() => () => releasePreparedPhoto(photoRef.current), []);

  // `onClose` is an inline arrow at the call site, so it is a new function on
  // every parent render. Held in a ref rather than listed as a dependency: the
  // effect below restores focus in its CLEANUP, so re-running it on an unrelated
  // parent render would yank the caret out of the caption someone is typing.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Escape + focus trap + focus restoration, matching IslandSelectorModal.
  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
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
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  // Debounced beach search. Skipped entirely when a beach is already chosen —
  // the field is not even rendered then.
  useEffect(() => {
    if (!isOpen || beach) return undefined;
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      setIsSearching(false);
      return undefined;
    }

    let cancelled = false;
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      void onSearchBeaches(trimmed)
        .then(found => { if (!cancelled) setResults(found); })
        .catch(() => { if (!cancelled) setResults([]); })
        .finally(() => { if (!cancelled) setIsSearching(false); });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [beach, isOpen, onSearchBeaches, query]);

  const messageFor = (reason: PhotoUploadFailure): string => {
    switch (reason) {
      case 'unreadable': return c.errors.unreadable;
      case 'too-small': return c.errors.tooSmall;
      case 'not-signed-in': return c.errors.notSignedIn;
      case 'quota': return c.errors.quota;
      default: return c.errors.failed;
    }
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared immediately so picking the SAME file twice still fires a change
    // event — otherwise a failed attempt cannot be retried without switching
    // files, which reads as a dead button.
    event.target.value = '';
    if (!file) return;

    setError(null);
    setStage('preparing');
    const prepared = await prepareBeachPhoto(file);
    if (prepared.status === 'error') {
      setStage('form');
      setError(messageFor(prepared.reason));
      trackEvent('photo_prepare_failed', undefined, { reason: prepared.reason });
      return;
    }
    setPreparedPhoto(prepared.photo);
    setStage('form');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (stage === 'sending' || stage === 'preparing') return;

    if (!beach) { setError(c.errors.noBeach); return; }
    if (!photo) { setError(c.errors.unreadable); return; }
    if (!hasRights) { setError(c.errors.noRights); return; }
    if (!userId) { setError(c.errors.notSignedIn); return; }

    setError(null);
    setStage('sending');
    const result = await uploadBeachPhoto({
      userId,
      regionId: beach.regionId,
      beachId: beach.beachId,
      caption,
      showCredit,
      photo,
    });

    if (result.status === 'error') {
      setStage('form');
      setError(messageFor(result.reason));
      trackEvent('photo_upload_failed', undefined, { reason: result.reason, source });
      return;
    }

    setPreparedPhoto(null);
    setStage('sent');
    trackEvent('photo_upload_succeeded', undefined, { source, region: beach.regionId });
  };

  const startAnother = () => {
    setCaption('');
    setHasRights(false);
    setShowCredit(true);
    setError(null);
    setStage('form');
    setPreparedPhoto(null);
    if (!preselectedBeach) {
      setBeach(null);
      setQuery('');
      setResults([]);
    }
  };

  if (!isOpen) return null;

  const isBusy = stage === 'preparing' || stage === 'sending';
  const canSubmit = Boolean(beach && photo && hasRights) && !isBusy;

  return (
    <div
      className="fixed inset-0 z-[95] flex animate-fade-in items-end justify-center bg-slate-950/60 px-0 sm:items-center sm:px-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-photo-title"
        onClick={event => event.stopPropagation()}
        className="flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-[1.65rem] bg-[var(--color-background)] shadow-2xl ring-1 ring-white/30 sm:max-h-[86vh] sm:max-w-md sm:rounded-[1.65rem]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/70 bg-white/80 p-4 backdrop-blur-xl">
          <div className="min-w-0">
            <h2 id="add-photo-title" className="font-heading text-xl font-black leading-tight text-slate-950">
              {c.title}
            </h2>
            <p className="mt-1 text-[13px] font-medium leading-snug text-slate-600">{c.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={c.close}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4">
          {!isSignedIn ? (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 text-[#007a83]">
                <Camera className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-950">{c.signInTitle}</h3>
              <p className="mx-auto mt-2 max-w-xs text-[15px] font-medium leading-relaxed text-slate-600">
                {c.signInBody}
              </p>
              <button
                type="button"
                onClick={() => {
                  trackEvent('photo_sheet_sign_in_clicked', undefined, { source });
                  onSignIn();
                }}
                className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {c.signInCta}
              </button>
            </div>
          ) : stage === 'sent' ? (
            <div className="py-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Check className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-950">{c.successTitle}</h3>
              <p className="mx-auto mt-2 max-w-xs text-[15px] font-medium leading-relaxed text-slate-600">
                {c.successBody}
              </p>
              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={startAnother}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  <ImagePlus className="h-4 w-4" aria-hidden="true" />
                  {c.successAgain}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 rounded-full text-sm font-bold text-slate-600 transition hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  {c.successDone}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <fieldset className="min-w-0 border-0 p-0" disabled={isBusy}>
                <legend className="sr-only">{c.title}</legend>

                {/* 1 — the beach */}
                <p className="text-xs font-black uppercase tracking-[0.07em] text-slate-500">{c.beachLabel}</p>
                {beach ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/70 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold text-slate-900">{beach.label}</span>
                      <span className="block truncate text-[13px] font-medium text-slate-600">{beach.subtitle}</span>
                    </span>
                    {!preselectedBeach && (
                      <button
                        type="button"
                        onClick={() => { setBeach(null); setQuery(''); }}
                        className="min-h-11 shrink-0 rounded-full px-2 text-[13px] font-bold text-[#007a83] underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      >
                        {c.beachChange}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="mt-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                      <input
                        type="text"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder={c.beachPlaceholder}
                        aria-label={c.beachLabel}
                        autoComplete="off"
                        className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-[15px] font-medium text-slate-800 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      />
                    </div>

                    {isSearching && (
                      <p className="mt-2 px-1 text-[13px] font-semibold text-slate-500">{c.beachSearching}</p>
                    )}
                    {!isSearching && query.trim().length >= 3 && results.length === 0 && (
                      <p className="mt-2 px-1 text-[13px] font-semibold text-slate-500">{c.beachNoResults}</p>
                    )}
                    {results.length > 0 && (
                      <ul className="mt-2 max-h-56 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-1.5">
                        {results.map(option => (
                          <li key={`${option.regionId}-${option.beachId}`}>
                            <button
                              type="button"
                              onClick={() => { setBeach(option); setResults([]); setError(null); }}
                              className="flex min-h-12 w-full flex-col items-start justify-center rounded-xl px-3 text-left transition hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                            >
                              <span className="text-[15px] font-bold text-slate-900">{option.label}</span>
                              <span className="text-[13px] font-medium text-slate-600">{option.subtitle}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* 2 — the photo */}
                <div className="mt-6">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={event => { void handleFile(event); }}
                  />

                  {photo ? (
                    <div>
                      <img
                        src={photo.previewUrl}
                        alt=""
                        width={photo.width}
                        height={photo.height}
                        className="aspect-[4/3] w-full rounded-2xl object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 min-h-11 rounded-full px-2 text-[13px] font-bold text-[#007a83] underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      >
                        {c.pickFileAgain}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 px-4 py-6 text-center transition hover:border-cyan-400 hover:bg-cyan-50/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    >
                      {stage === 'preparing' ? (
                        <>
                          <LoaderCircle className="h-6 w-6 text-[#007a83] motion-safe:animate-spin" aria-hidden="true" />
                          <span className="text-[15px] font-bold text-slate-700">{c.preparing}</span>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-6 w-6 text-[#007a83]" aria-hidden="true" />
                          <span className="text-[15px] font-bold text-slate-800">{c.pickFile}</span>
                          <span className="text-[13px] font-medium leading-snug text-slate-600">{c.fileHint}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* 3 — the caption */}
                <label className="mt-6 block">
                  <span className="text-xs font-black uppercase tracking-[0.07em] text-slate-500">
                    {c.captionLabel} <span className="font-bold normal-case tracking-normal text-slate-400">({c.captionOptional})</span>
                  </span>
                  <input
                    type="text"
                    value={caption}
                    onChange={event => setCaption(event.target.value)}
                    maxLength={280}
                    placeholder={c.captionPlaceholder}
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] font-medium text-slate-800 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                </label>

                {/* 4 — the licence, last and unmissable */}
                <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-white/70 p-3.5">
                  <input
                    type="checkbox"
                    checked={hasRights}
                    onChange={event => { setHasRights(event.target.checked); setError(null); }}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-[#007a83] focus:ring-2 focus:ring-cyan-400"
                  />
                  <span className="text-[13px] font-semibold leading-snug text-slate-700">{c.rightsLabel}</span>
                </label>

                {/* 5 — whose name goes under it, ASKED rather than assumed.
                    Publishing the real name Google gave us, on a public page
                    that search engines index, is not something to infer from
                    silence. Default on, because attribution is what most people
                    sending a photo actually want and it is the reward the whole
                    feature is built on — but it is now a decision on the record,
                    and unticking it is honoured everywhere the photo appears,
                    including the baked static pages where a wrong credit cannot
                    be quietly corrected later. */}
                <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-2xl bg-white/70 p-3.5">
                  <input
                    type="checkbox"
                    checked={showCredit}
                    onChange={event => setShowCredit(event.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-[#007a83] focus:ring-2 focus:ring-cyan-400"
                  />
                  <span className="text-[13px] font-semibold leading-snug text-slate-700">
                    {c.creditLabel}
                    <span className="mt-0.5 block text-[12px] font-medium text-slate-500">
                      {showCredit ? c.creditOnHint : c.creditOffHint}
                    </span>
                  </span>
                </label>

                <p className="mt-2 px-1 text-[12px] font-medium leading-snug text-slate-500">{c.privacyNote}</p>

                {error && (
                  <p role="alert" className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-[13px] font-bold leading-snug text-orange-800">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  aria-busy={stage === 'sending'}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
                >
                  {stage === 'sending'
                    ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
                    : <Camera className="h-4 w-4" aria-hidden="true" />}
                  {stage === 'sending' ? c.submitting : c.submit}
                </button>
              </fieldset>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddBeachPhotoSheet;
