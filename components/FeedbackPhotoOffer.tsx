import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, LoaderCircle } from 'lucide-react';
import type { LanguageCode } from '../types';
import type { ObservedTiming } from '../services/analyticsService';
import { trackEvent } from '../services/analyticsService';

// ─────────────────────────────────────────────────────────────────────────────
// «Στείλε μια φωτογραφία της θάλασσας» — the optional second half of a
// "more waves / more wind / calmer" comment on the beach page.
//
// One tap: the button IS the file input's label, so there is no dialog in between.
// When the visitor said «Τώρα είμαι εκεί» the phone opens the rear camera straight
// away (`capture`); otherwise the normal picker opens, because a morning visitor
// writing at night has the picture in their gallery, not in front of them.
//
// The photo is shrunk and re-encoded on the phone (which also strips the GPS tag)
// by the same code that prepares gallery uploads, then goes to
// netlify/functions/feedback-photo.mjs, which posts it to the owner's Telegram as a
// reply to the comment. It is never published — the copy below says so, because
// "a website wants my photo" reads as "a website will post my photo" otherwise.
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  /** The pass from feedback-email.mjs. Null until it arrives, and forever null if it never does. */
  photoToken: string | null;
  beachId: number;
  beachName: string;
  observedTiming?: ObservedTiming;
  language: LanguageCode;
};

type Status = 'idle' | 'working' | 'sent' | 'error';
type Problem = 'unreadable' | 'too-small' | 'expired' | 'failed';

/**
 * Plain `vite` on localhost runs no Netlify functions, so the comment never reaches Telegram
 * and no pass ever comes back — the button would simply never appear. In DEV only, the page
 * hands this stand-in instead: the whole flow runs (picker, camera, shrinking, thumbnail)
 * and the final send is skipped. `import.meta.env.DEV` is false in a production build, so
 * neither branch that reads it survives there.
 */
export const DEV_PREVIEW_PHOTO_TOKEN = 'dev-preview';

/** A file this fresh came out of the camera just now; a gallery pick carries its old date. */
const FRESH_PHOTO_MS = 5 * 60 * 1000;

const copy = {
  button: { en: 'Send a photo of the sea', gr: 'Στείλε μια φωτογραφία της θάλασσας', de: 'Foto vom Meer schicken', it: 'Invia una foto del mare', fr: 'Envoyer une photo de la mer' },
  hint: {
    en: 'Optional. Only we see it — it is never published. Point it at the sea, not at people.',
    gr: 'Προαιρετικό. Τη βλέπουμε μόνο εμείς, δεν δημοσιεύεται. Φωτογράφισε τη θάλασσα, όχι ανθρώπους.',
    de: 'Freiwillig. Nur wir sehen es, es wird nie veröffentlicht. Bitte das Meer fotografieren, nicht Menschen.',
    it: 'Facoltativo. La vediamo solo noi, non viene mai pubblicata. Inquadra il mare, non le persone.',
    fr: 'Facultatif. Nous seuls la voyons, elle n’est jamais publiée. Photographiez la mer, pas les gens.',
  },
  working: { en: 'Sending…', gr: 'Στέλνεται…', de: 'Wird gesendet…', it: 'Invio in corso…', fr: 'Envoi…' },
  sent: {
    en: 'Got it — thank you! We will look at it next to your comment.',
    gr: 'Τη λάβαμε — ευχαριστούμε! Θα τη δούμε μαζί με το σχόλιό σου.',
    de: 'Angekommen — danke! Wir schauen es uns zusammen mit deinem Kommentar an.',
    it: 'Ricevuta — grazie! La guarderemo insieme al tuo commento.',
    fr: 'Bien reçue — merci ! Nous la regarderons avec votre commentaire.',
  },
  unreadable: {
    en: 'We could not open that photo. Try another one.',
    gr: 'Δεν μπορέσαμε να ανοίξουμε αυτή τη φωτογραφία. Δοκίμασε άλλη.',
    de: 'Dieses Foto konnten wir nicht öffnen. Versuch ein anderes.',
    it: 'Non siamo riusciti ad aprire questa foto. Provane un’altra.',
    fr: 'Impossible d’ouvrir cette photo. Essayez-en une autre.',
  },
  'too-small': {
    en: 'That photo is too small to show the sea. Try another one.',
    gr: 'Η φωτογραφία είναι πολύ μικρή για να φαίνεται η θάλασσα. Δοκίμασε άλλη.',
    de: 'Das Foto ist zu klein, um das Meer zu erkennen. Versuch ein anderes.',
    it: 'La foto è troppo piccola per vedere il mare. Provane un’altra.',
    fr: 'La photo est trop petite pour voir la mer. Essayez-en une autre.',
  },
  expired: {
    en: 'Too much time has passed since your comment, so the photo can no longer be attached to it.',
    gr: 'Πέρασε πολλή ώρα από το σχόλιό σου, οπότε η φωτογραφία δεν μπορεί πια να μπει μαζί του.',
    de: 'Seit deinem Kommentar ist zu viel Zeit vergangen — das Foto lässt sich nicht mehr anhängen.',
    it: 'È passato troppo tempo dal tuo commento: la foto non si può più allegare.',
    fr: 'Trop de temps s’est écoulé depuis votre commentaire : la photo ne peut plus y être jointe.',
  },
  failed: {
    en: 'It did not go through. Try again in a moment.',
    gr: 'Δεν στάλθηκε. Δοκίμασε ξανά σε λίγο.',
    de: 'Das hat nicht geklappt. Versuch es gleich noch einmal.',
    it: 'Non è andata a buon fine. Riprova tra poco.',
    fr: 'L’envoi a échoué. Réessayez dans un instant.',
  },
} as const;

const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    const result = String(reader.result || '');
    resolve(result.slice(result.indexOf(',') + 1));
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

export const FeedbackPhotoOffer: React.FC<Props> = ({ photoToken, beachId, beachName, observedTiming, language }) => {
  const [status, setStatus] = useState<Status>('idle');
  const [problem, setProblem] = useState<Problem>('failed');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const opensCamera = observedTiming === 'now';

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  if (!photoToken) return null;

  const fail = (reason: Problem) => {
    setProblem(reason);
    setStatus('error');
    trackEvent('condition_feedback_photo', beachId, { step: 'failed', reason });
  };

  const handleFile = async (file: File | undefined) => {
    // Let the same file be picked again after an error — without this the input sees
    // "no change" and the second tap does nothing.
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;

    setStatus('working');
    // athens-clock-exempt: the age of a file (instant minus instant), never a time of day.
    const fromCamera = opensCamera && Date.now() - file.lastModified < FRESH_PHOTO_MS;

    let prepared;
    try {
      // Loaded on the tap, not with the page: most visitors never send a photo.
      const { prepareBeachPhoto } = await import('../services/beachPhotoUpload');
      prepared = await prepareBeachPhoto(file);
    } catch {
      fail('failed');
      return;
    }
    if (prepared.status === 'error') {
      fail(prepared.reason === 'too-small' ? 'too-small' : 'unreadable');
      return;
    }

    if (import.meta.env.DEV && photoToken === DEV_PREVIEW_PHOTO_TOKEN) {
      console.info(`[FeedbackPhoto] localhost preview — not sent. ${prepared.photo.width}×${prepared.photo.height}, ${Math.round(prepared.photo.blob.size / 1024)} KB, fromCamera=${fromCamera}`);
      setPreviewUrl(prepared.photo.previewUrl);
      setStatus('sent');
      return;
    }

    try {
      const response = await fetch('/.netlify/functions/feedback-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoToken,
          beachId,
          beachName,
          observedTiming,
          fromCamera,
          image: await blobToBase64(prepared.photo.blob),
        }),
      });
      if (!response.ok) {
        URL.revokeObjectURL(prepared.photo.previewUrl);
        fail(response.status === 401 ? 'expired' : 'failed');
        return;
      }
    } catch {
      URL.revokeObjectURL(prepared.photo.previewUrl);
      fail('failed');
      return;
    }

    setPreviewUrl(prepared.photo.previewUrl);
    setStatus('sent');
    trackEvent('condition_feedback_photo', beachId, { step: 'sent', from_camera: fromCamera });
  };

  if (status === 'sent') {
    return (
      <div className="flex items-center gap-3 rounded-control border border-emerald-100 bg-white px-3 py-2 text-sm text-emerald-800" role="status">
        {previewUrl && <img src={previewUrl} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />}
        <p className="leading-snug">{copy.sent[language]}</p>
      </div>
    );
  }

  // Retrying cannot help once the pass has run out — offer nothing but the reason.
  if (status === 'error' && problem === 'expired') {
    return <p className="text-center text-xs font-semibold text-slate-600" role="status">{copy.expired[language]}</p>;
  }

  const working = status === 'working';
  return (
    <div className="space-y-1.5">
      <label
        className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-control border border-sky-200 bg-white px-3 text-sm font-bold text-sky-800 transition-all focus-within:ring-2 focus-within:ring-sky-500 ${working ? 'cursor-wait opacity-70' : 'cursor-pointer hover:bg-sky-50 active:scale-95'}`}
      >
        {working ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        {working ? copy.working[language] : copy.button[language]}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          {...(opensCamera ? { capture: 'environment' as const } : {})}
          disabled={working}
          className="sr-only"
          onChange={event => { void handleFile(event.target.files?.[0]); }}
        />
      </label>
      {status === 'error' ? (
        <p className="text-center text-xs font-semibold text-rose-700" role="alert">{copy[problem][language]}</p>
      ) : (
        <p className="text-center text-xs leading-snug text-slate-500">{copy.hint[language]}</p>
      )}
    </div>
  );
};

export default FeedbackPhotoOffer;
