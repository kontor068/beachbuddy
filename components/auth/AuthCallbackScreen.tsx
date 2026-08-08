// The page Google sends the visitor back to.
//
// It exists for about a second. supabase-js exchanges the ?code= in the URL while
// its client is being created, so all this screen does is wait for that, then put
// the visitor back exactly where they were when they pressed "sign in".
//
// It is mounted from index.tsx through a dynamic import, so none of this — and
// none of the Supabase library behind it — is in the bundle anybody else loads.
//
// WHY IT IS ITS OWN ROUTE AND NOT A FLAG ON AN EXISTING PAGE: the prerender strips
// the JavaScript out of several page types (SEO landing pages, the guides hub,
// island-intent pages). React never boots there. An OAuth redirect that landed on
// one of those would hang forever with no error — see scripts/prerenderBeachPages.mjs.

import React, { useEffect, useState } from 'react';
import type { Root } from 'react-dom/client';
import { completeOAuthRedirect, takeReturnTo } from '../../services/authService';

type Phase = 'working' | 'failed';

// Deliberately not wired to the i18n system: pulling the translation chunk in for
// a screen that shows for one second would be the most expensive string in the app.
const COPY: Record<string, { working: string; failed: string; back: string }> = {
  el: { working: 'Σε συνδέουμε…', failed: 'Η σύνδεση δεν ολοκληρώθηκε.', back: 'Επιστροφή στην αρχική' },
  en: { working: 'Signing you in…', failed: "That sign-in didn't complete.", back: 'Back to the homepage' },
  de: { working: 'Anmeldung läuft…', failed: 'Die Anmeldung wurde nicht abgeschlossen.', back: 'Zurück zur Startseite' },
  fr: { working: 'Connexion en cours…', failed: "La connexion n'a pas abouti.", back: "Retour à l'accueil" },
  it: { working: 'Accesso in corso…', failed: "L'accesso non è andato a buon fine.", back: 'Torna alla home' },
};

const pickCopy = () => {
  try {
    const stored = window.localStorage.getItem('calmBeachLanguage') || '';
    // The app stores Greek as 'gr'; every other code matches.
    const key = stored === 'gr' ? 'el' : stored;
    if (COPY[key]) return COPY[key];
  } catch {
    /* ignore */
  }
  return COPY.en;
};

const AuthCallbackScreen: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('working');
  const [reason, setReason] = useState<string>('');
  const copy = pickCopy();

  useEffect(() => {
    let cancelled = false;

    // Backing out of Google's consent screen is a DECISION, not a failure: send
    // the visitor straight back where they were, with no error to read.
    const params = new URLSearchParams(window.location.search);
    if (params.get('error') === 'access_denied') {
      window.location.replace(takeReturnTo());
      return () => { cancelled = true; };
    }

    void completeOAuthRedirect().then((result) => {
      if (cancelled) return;
      if (!result.user) {
        setReason(result.reason || '');
        setPhase('failed');
        return;
      }
      // replace(), not assign(): the callback URL still carries the auth code and
      // must not survive in the back-button history.
      window.location.replace(takeReturnTo());
    });

    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f0f9ff', color: '#0f172a', fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <img src="/calmbeach-mark.svg" alt="CalmBeach" width={56} height={56} style={{ marginBottom: 16 }} />
        <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
          {phase === 'working' ? copy.working : copy.failed}
        </p>
        {phase === 'failed' && (
          <>
            {reason && (
              <p style={{ marginTop: 10, fontSize: 13, color: '#475569', wordBreak: 'break-word' }}>
                {reason}
              </p>
            )}
            <p style={{ marginTop: 14 }}>
              <a href="/" style={{ color: '#007a83', fontWeight: 700 }}>{copy.back}</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

/** Mounted by index.tsx instead of <App /> when the path is the callback. */
export const mountAuthCallback = (root: Root): void => {
  root.render(<AuthCallbackScreen />);
};

export default AuthCallbackScreen;
