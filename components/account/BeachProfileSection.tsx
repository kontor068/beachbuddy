// "What I like in a beach" — the saved profile, inside the account panel.
//
// WHY IT LIVES HERE AND NOT NEXT TO THE FILTER CHIPS. The chips on a region page
// are about today: they are lit on screen, they explain the short list under
// them, and they are gone tomorrow. This is a standing answer that follows the
// person to islands they have not opened yet. Putting it in the account is what
// makes that difference legible — you set it where your saved beaches live, not
// where you search.
//
// THE COPY DOES THE HARDEST WORK IN THIS FILE. A saved preference that changes
// what the site recommends is exactly the kind of feature people distrust,
// because they cannot see it working. So the switch says what it does in one
// line, and says the two things it will NOT do: it never hides a beach, and it
// never puts a windier beach above a calmer one. Both are true (utils/
// beachProfile.ts enforces the second structurally) and both are the questions
// somebody would otherwise have to guess the answer to.
//
// No icons on the chips on purpose: at 320px, twelve iconned chips wrap into a
// wall. The words alone are short and already translated five ways.

import React from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import type { BeachProfile, UserPreferences } from '../../types';
import { getPreferenceFilterWord, QUICK_PREFERENCE_FILTERS } from '../../utils/preferenceFilterLabels';
import { getLocalizedCopy, type SupportedLanguage } from '../../utils/i18n';

export interface BeachProfileSectionProps {
  language: SupportedLanguage;
  profile: BeachProfile;
  onChange: (next: BeachProfile) => void;
}

type Copy = {
  title: string;
  intro: string;
  switchLabel: string;
  switchOnHint: string;
  switchOffHint: string;
  emptyHint: string;
  clear: string;
};

const COPY: Record<SupportedLanguage, Copy> = {
  gr: {
    title: 'Τι σου αρέσει σε μια παραλία',
    intro: 'Διάλεξε ό,τι μετράει για σένα. Το θυμόμαστε σε κάθε κινητό ή υπολογιστή που μπαίνεις.',
    switchLabel: 'Να τα λαμβάνουμε υπόψη στις προτάσεις',
    switchOnHint: 'Όσες ταιριάζουν έρχονται πρώτες. Καμία παραλία δεν κρύβεται, και ο άνεμος αποφασίζει πάντα πρώτος.',
    switchOffHint: 'Τώρα δεν αλλάζει τίποτα στις προτάσεις σου — τα κρατάμε μόνο αποθηκευμένα.',
    emptyHint: 'Διάλεξε τουλάχιστον ένα για να πιάσει.',
    clear: 'Καθάρισε τα',
  },
  en: {
    title: 'What you like in a beach',
    intro: 'Pick what matters to you. We remember it on every phone or computer you sign in from.',
    switchLabel: 'Use these in my recommendations',
    switchOnHint: 'Matching beaches come first. No beach is ever hidden, and the wind always decides first.',
    switchOffHint: 'Nothing changes in your recommendations right now — we just keep these saved.',
    emptyHint: 'Pick at least one for this to do anything.',
    clear: 'Clear them',
  },
  de: {
    title: 'Was dir an einem Strand gefällt',
    intro: 'Wähle, was dir wichtig ist. Wir merken es uns auf jedem Handy und Computer, an dem du dich anmeldest.',
    switchLabel: 'Bei meinen Empfehlungen berücksichtigen',
    switchOnHint: 'Passende Strände kommen zuerst. Kein Strand wird ausgeblendet, und der Wind entscheidet immer zuerst.',
    switchOffHint: 'An deinen Empfehlungen ändert sich gerade nichts — wir speichern das nur.',
    emptyHint: 'Wähle mindestens eines aus, damit es wirkt.',
    clear: 'Zurücksetzen',
  },
  fr: {
    title: 'Ce que vous aimez dans une plage',
    intro: 'Choisissez ce qui compte pour vous. Nous le retenons sur chaque téléphone ou ordinateur où vous vous connectez.',
    switchLabel: 'En tenir compte dans mes recommandations',
    switchOnHint: "Les plages correspondantes viennent en premier. Aucune plage n'est masquée, et le vent décide toujours en premier.",
    switchOffHint: 'Rien ne change dans vos recommandations pour le moment — nous les gardons simplement enregistrées.',
    emptyHint: 'Choisissez-en au moins un pour que cela agisse.',
    clear: 'Tout effacer',
  },
  it: {
    title: 'Cosa ti piace in una spiaggia',
    intro: 'Scegli quello che conta per te. Lo ricordiamo su ogni telefono o computer con cui accedi.',
    switchLabel: 'Tienine conto nei miei consigli',
    switchOnHint: 'Le spiagge che corrispondono vengono per prime. Nessuna spiaggia viene nascosta, e il vento decide sempre per primo.',
    switchOffHint: 'Nei tuoi consigli non cambia nulla in questo momento — le teniamo solo salvate.',
    emptyHint: 'Scegline almeno una perché abbia effetto.',
    clear: 'Cancella tutto',
  },
};

export const BeachProfileSection: React.FC<BeachProfileSectionProps> = ({ language, profile, onChange }) => {
  const copy = getLocalizedCopy(language, COPY);
  const chosen = QUICK_PREFERENCE_FILTERS.filter(key => profile.wishes[key]);

  const toggleWish = (key: keyof UserPreferences) => {
    onChange({ ...profile, wishes: { ...profile.wishes, [key]: !profile.wishes[key] } });
  };

  return (
    <section className="mt-2 rounded-2xl bg-white/62 px-4 py-3 shadow-sm ring-1 ring-white/55">
      <div className="flex min-w-0 items-center gap-3">
        <SlidersHorizontal className="h-5 w-5 shrink-0 text-[#007a83]" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-bold text-slate-800">{copy.title}</span>
      </div>
      <p className="mt-1.5 text-xs font-semibold leading-relaxed text-slate-600">{copy.intro}</p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {QUICK_PREFERENCE_FILTERS.map(key => {
          const isChosen = profile.wishes[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleWish(key)}
              aria-pressed={isChosen}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-extrabold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                isChosen
                  ? 'bg-[#007a83] text-white ring-1 ring-[#007a83]'
                  : 'bg-white/70 text-slate-600 ring-1 ring-slate-200 hover:bg-cyan-50 hover:text-cyan-800'
              }`}
            >
              {isChosen && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              {getPreferenceFilterWord(key, language)}
            </button>
          );
        })}
      </div>

      {chosen.length > 0 && (
        <button
          type="button"
          onClick={() => onChange({ ...profile, wishes: { ...profile.wishes, ...Object.fromEntries(chosen.map(key => [key, false])) } })}
          className="mt-2 text-xs font-extrabold text-slate-500 underline underline-offset-2 hover:text-rose-700"
        >
          {copy.clear}
        </button>
      )}

      {/* The switch sits BELOW the chips: you pick what you like, then decide
          whether it should change what the site shows you. Reversed, the switch
          is a promise about a list that does not exist yet. */}
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-sky-50/70 px-3 py-2.5 ring-1 ring-white/60">
        <input
          type="checkbox"
          checked={profile.enabled}
          onChange={event => onChange({ ...profile, enabled: event.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#007a83]"
        />
        <span className="min-w-0">
          <span className="block text-xs font-extrabold text-slate-800">{copy.switchLabel}</span>
          <span className="mt-0.5 block text-xs font-semibold leading-relaxed text-slate-600">
            {profile.enabled
              ? (chosen.length === 0 ? copy.emptyHint : copy.switchOnHint)
              : copy.switchOffHint}
          </span>
        </span>
      </label>
    </section>
  );
};

export default BeachProfileSection;
