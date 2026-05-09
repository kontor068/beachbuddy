import React, { useMemo, useState } from 'react';
import { ArrowRight, MapPin, Waves, Wind } from 'lucide-react';
import { mockBeaches, MockBeach, MockBeachType } from '../data/mockBeaches';
import {
  getTopMockBeachRecommendations,
  mockMarineConditions,
  mockWeatherConditions,
  MockBeachScoreResult,
} from '../services/mockBeachScoringService';
import { LanguageCode, UserPreferences } from '../types';

interface MvpTopRecommendationsProps {
  language: LanguageCode;
  selectedAreaName?: string;
  preferences?: Partial<UserPreferences>;
  userLocation?: { lat: number; lon: number };
  onExploreAll: () => void;
}

const beachTypeLabels: Record<MockBeachType, { en: string; gr: string }> = {
  sand: { en: 'Sand', gr: 'Άμμος' },
  pebbles: { en: 'Pebbles', gr: 'Βότσαλα' },
  mixed: { en: 'Mixed', gr: 'Μικτή' },
};

const waveLabels = {
  calm: { en: 'Calm sea', gr: 'Ήρεμη θάλασσα' },
  moderate: { en: 'Some waves', gr: 'Λίγος κυματισμός' },
  rough: { en: 'Rough sea', gr: 'Έντονος κυματισμός' },
};

const copy = {
  en: {
    eyebrow: 'MVP recommendation preview',
    title: 'Best beaches for today',
    subtitle: 'Top 3 mock recommendations based on wind, sea comfort, distance and your preferences.',
    status: 'Today in Greece',
    wind: 'Wind',
    waves: 'Waves',
    distance: 'Distance',
    type: 'Type',
    viewDetails: 'View details',
    hideDetails: 'Hide details',
    exploreAll: 'Explore all suitable beaches',
    whyReduced: 'Score reduced by',
    amenities: 'Amenities',
    access: 'Access',
    mockNote: 'Mock data for MVP testing',
  },
  gr: {
    eyebrow: 'Προεπισκόπηση προτάσεων',
    title: 'Καλύτερες παραλίες για σήμερα',
    subtitle: 'Οι 3 καλύτερες δοκιμαστικές προτάσεις βάσει ανέμου, θάλασσας, απόστασης και προτιμήσεων.',
    status: 'Σήμερα στην Ελλάδα',
    wind: 'Άνεμος',
    waves: 'Κύμα',
    distance: 'Απόσταση',
    type: 'Τύπος',
    viewDetails: 'Λεπτομέρειες',
    hideDetails: 'Απόκρυψη',
    exploreAll: 'Εξερεύνηση όλων των κατάλληλων παραλιών',
    whyReduced: 'Μειώσεις σκορ',
    amenities: 'Παροχές',
    access: 'Πρόσβαση',
    mockNote: 'Δοκιμαστικά δεδομένα για έλεγχο',
  },
};

const greekWindDirections: Record<string, string> = {
  North: 'βόρειο',
  Northeast: 'βορειοανατολικό',
  East: 'ανατολικό',
  Southeast: 'νοτιοανατολικό',
  South: 'νότιο',
  Southwest: 'νοτιοδυτικό',
  West: 'δυτικό',
  Northwest: 'βορειοδυτικό',
};

const greekBeachContent: Record<string, {
  description: string;
  windProtectionNotes: string;
  amenities: string[];
}> = {
  'mock-milos-sarakiniko': {
    description: 'Εμβληματική παραλία της Μήλου με λευκά ηφαιστειακά βράχια. Είναι εντυπωσιακή για φωτογραφίες, αλλά όχι η πιο εύκολη επιλογή για οικογένειες.',
    windProtectionNotes: 'Συχνά επηρεάζεται από βόρειους ανέμους. Είναι καλύτερη επιλογή όταν ο καιρός είναι πιο ήρεμος.',
    amenities: ['χώρος στάθμευσης κοντά', 'σημείο για φωτογραφίες'],
  },
  'mock-milos-fyriplaka': {
    description: 'Μεγάλη αμμώδης παραλία στη νότια Μήλο, με χρωματιστά βράχια και πιο άνετες συνθήκες όταν φυσάει βοριάς.',
    windProtectionNotes: 'Καλή νότια επιλογή όταν οι βόρειοι άνεμοι επηρεάζουν το νησί.',
    amenities: ['ξαπλώστρες εποχικά', 'beach bar εποχικά', 'πάρκινγκ κοντά'],
  },
  'mock-milos-tsigrado': {
    description: 'Μικρός εντυπωσιακός όρμος με δύσκολη κατάβαση. Ταιριάζει περισσότερο σε επισκέπτες που θέλουν πιο άγρια εμπειρία.',
    windProtectionNotes: 'Συνήθως προστατεύεται καλύτερα από βοριάδες, αλλά η πρόσβαση είναι απαιτητική.',
    amenities: [],
  },
  'mock-paros-kolymbithres': {
    description: 'Γνωστή παραλία κοντά στη Νάουσα, με ιδιαίτερους βράχους και μικρούς αμμώδεις χώρους για μπάνιο.',
    windProtectionNotes: 'Μπορεί να επηρεαστεί από βόρειους και βορειοδυτικούς ανέμους. Θέλει έλεγχο ανά ημέρα.',
    amenities: ['ξαπλώστρες εποχικά', 'ταβέρνα κοντά', 'εποχική πρόσβαση με καΐκι από Νάουσα'],
  },
  'mock-paros-golden-beach': {
    description: 'Μεγάλη αμμώδης παραλία με πολλές παροχές και θαλάσσια σπορ. Είναι καλύτερη για ενεργή μέρα παρά για απόλυτη ηρεμία.',
    windProtectionNotes: 'Γνωστή για συνθήκες windsurf. Δεν είναι πάντα η πιο ήρεμη επιλογή όταν φυσάει.',
    amenities: ['θαλάσσια σπορ', 'beach bars', 'ξαπλώστρες εποχικά', 'πάρκινγκ κοντά'],
  },
  'mock-antiparos-soros': {
    description: 'Δημοφιλής παραλία της Αντιπάρου με καθαρά νερά, φαγητό κοντά και πρακτική πρόσβαση.',
    windProtectionNotes: 'Μπορεί να είναι πιο άνετη με δυτικούς ανέμους, αλλά η έκθεση θέλει επιβεβαίωση.',
    amenities: ['ταβέρνα κοντά', 'beach bar εποχικά', 'πάρκινγκ κοντά'],
  },
  'mock-naxos-agios-prokopios': {
    description: 'Από τις πιο γνωστές αμμώδεις παραλίες της Νάξου, εύκολη και οργανωμένη, αλλά όχι απομονωμένη.',
    windProtectionNotes: 'Μπορεί να επηρεαστεί από δυτικούς ανέμους, αλλά έχει εύκολη πρόσβαση και πολλές παροχές.',
    amenities: ['εστιατόρια κοντά', 'ξαπλώστρες εποχικά', 'κοντινή δημόσια συγκοινωνία'],
  },
  'mock-naxos-mikri-vigla': {
    description: 'Όμορφη αμμώδης παραλία της Νάξου, πολύ γνωστή για kite και windsurf.',
    windProtectionNotes: 'Συχνά φυσάει και δεν είναι ιδανική για χρήστες που ζητούν ήρεμα νερά.',
    amenities: ['σχολές kite και windsurf εποχικά', 'πάρκινγκ κοντά'],
  },
  'mock-mykonos-ornos': {
    description: 'Οργανωμένος αμμώδης κόλπος κοντά στη Χώρα, πρακτικός για οικογένειες και επισκέπτες που θέλουν παροχές.',
    windProtectionNotes: 'Νότιος κόλπος που μπορεί να βοηθήσει όταν στη Μύκονο φυσάει δυνατός βοριάς.',
    amenities: ['εστιατόρια κοντά', 'ξαπλώστρες εποχικά', 'θαλάσσιο ταξί εποχικά', 'πάρκινγκ κοντά'],
  },
  'mock-mykonos-agios-sostis': {
    description: 'Πιο ήσυχη και λιγότερο οργανωμένη παραλία της Μυκόνου, με πιο φυσικό χαρακτήρα.',
    windProtectionNotes: 'Βλέπει βόρεια και μπορεί να είναι εκτεθειμένη στο μελτέμι. Καλύτερη σε ήρεμες μέρες.',
    amenities: ['ταβέρνα κοντά'],
  },
  'mock-aegina-agia-marina': {
    description: 'Πρακτική οργανωμένη αμμώδης παραλία στην Αίγινα, καλή για οικογένειες και ημερήσια εκδρομή.',
    windProtectionNotes: 'Η άνεση εξαρτάται από την έκθεση της ανατολικής πλευράς και τον σημερινό άνεμο.',
    amenities: ['εστιατόρια κοντά', 'ξαπλώστρες εποχικά', 'κοντινή δημόσια συγκοινωνία'],
  },
  'mock-attica-kape': {
    description: 'Όμορφος μικρός όρμος κοντά στο Σούνιο με καθαρά νερά και πιο φυσική αίσθηση.',
    windProtectionNotes: 'Έχει κάποια φυσική προστασία, αλλά τα σκαλιά και οι περιορισμένες παροχές πρέπει να υπολογίζονται.',
    amenities: [],
  },
};

const normalizeArea = (value?: string) =>
  (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const matchesSelectedArea = (beach: MockBeach, selectedAreaName?: string) => {
  const selected = normalizeArea(selectedAreaName);
  if (!selected) return false;

  const candidates = [
    beach.islandOrMainlandArea,
    beach.location.island,
    beach.location.region,
    beach.region,
  ].map(normalizeArea);

  return candidates.includes(selected);
};

const getLocalizedBeachContent = (beach: MockBeach, language: LanguageCode) => {
  if (language !== 'gr') {
    return {
      description: beach.description,
      windProtectionNotes: beach.windProtectionNotes,
      amenities: beach.amenities,
    };
  }

  return greekBeachContent[beach.id] || {
    description: beach.description,
    windProtectionNotes: beach.windProtectionNotes,
    amenities: beach.amenities,
  };
};

const getPrimaryExplanation = (result: MockBeachScoreResult, beach: MockBeach, language: LanguageCode) => {
  if (language !== 'gr') return result.explanationBullets[0] || beach.description;

  const wind = greekWindDirections[mockWeatherConditions.windDirection] || 'σημερινό';
  if (beach.orientation.protectedFrom.includes(mockWeatherConditions.windDirection)) {
    return `Προστατευμένη από τον σημερινό ${wind} άνεμο.`;
  }
  if (beach.orientation.faces.includes(mockWeatherConditions.windDirection)) {
    return `Είναι πιο εκτεθειμένη στον σημερινό ${wind} άνεμο.`;
  }
  return 'Καλή επιλογή για σήμερα με βάση άνεμο, θάλασσα και προτιμήσεις.';
};

const localizeReducedReason = (reason: string, language: LanguageCode) => {
  if (language !== 'gr') return reason;
  if (reason.includes('Long distance')) return 'Μεγάλη απόσταση από την τοποθεσία σου.';
  if (reason.includes('Further away')) return 'Πιο μακριά από κοντινότερες επιλογές.';
  if (reason.includes('Difficult access')) return 'Η πρόσβαση είναι πιο δύσκολη.';
  if (reason.includes('Misses')) return 'Δεν ταιριάζει με όλες τις επιλεγμένες προτιμήσεις.';
  if (reason.includes('Exposed')) return 'Είναι πιο εκτεθειμένη στον σημερινό άνεμο.';
  if (reason.includes('Sea comfort')) return 'Οι συνθήκες στη θάλασσα δεν είναι ιδανικές.';
  if (reason.includes('Rain risk')) return 'Η πιθανότητα βροχής μειώνει την πρόταση.';
  if (reason.includes('Temperature')) return 'Η θερμοκρασία δεν είναι τόσο άνετη για παραλία.';
  return reason;
};

const formatDistance = (distanceKm?: number) => {
  if (distanceKm === undefined) return '—';
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
};

const getScoreTone = (score: number) => {
  if (score >= 85) return 'bg-emerald-500 text-white';
  if (score >= 70) return 'bg-cyan-500 text-white';
  return 'bg-amber-400 text-slate-900';
};

const RecommendationCard: React.FC<{
  rank: number;
  result: MockBeachScoreResult;
  beach: MockBeach;
  language: LanguageCode;
  isExpanded: boolean;
  onToggleDetails: () => void;
}> = ({ rank, result, beach, language, isExpanded, onToggleDetails }) => {
  const c = copy[language === 'gr' ? 'gr' : 'en'];
  const typeLabel = beachTypeLabels[beach.beachType][language === 'gr' ? 'gr' : 'en'];
  const waveLabel = waveLabels[mockMarineConditions.waveCondition][language === 'gr' ? 'gr' : 'en'];
  const localizedContent = getLocalizedBeachContent(beach, language);
  const primaryExplanation = getPrimaryExplanation(result, beach, language);

  return (
    <article className="bg-white/88 dark:bg-slate-900/85 backdrop-blur-md border border-white/70 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg shadow-slate-900/5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center">
              {rank}
            </span>
            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
              {beach.islandOrMainlandArea}
            </span>
          </div>
          <h3 className="text-2xl font-heading font-bold text-slate-900 dark:text-white leading-tight">
            {beach.name}
          </h3>
        </div>
        <div className={`px-3 py-2 rounded-2xl text-sm font-black ${getScoreTone(result.total)}`}>
          {result.total}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        {primaryExplanation}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 rounded-2xl bg-sky-50 dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200">
          <Wind className="w-4 h-4 text-cyan-500" />
          <span>{c.wind}: {mockWeatherConditions.windSpeedKmh} km/h</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-sky-50 dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200">
          <Waves className="w-4 h-4 text-cyan-500" />
          <span>{waveLabel}</span>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200">
          <MapPin className="w-4 h-4 text-slate-400" />
          <span>{c.distance}: {formatDistance(result.distanceKm)}</span>
        </div>
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800 px-3 py-2 text-slate-700 dark:text-slate-200">
          {c.type}: {typeLabel}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700 p-4 space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">{localizedContent.description}</p>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{c.amenities}</p>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {localizedContent.amenities.length > 0 ? localizedContent.amenities.join(', ') : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{c.access}</p>
            <p className="text-sm text-slate-700 dark:text-slate-200">{localizedContent.windProtectionNotes}</p>
          </div>
          {result.reducedBy.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{c.whyReduced}</p>
              <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {result.reducedBy.slice(0, 2).map(reason => (
                  <li key={reason}>• {localizeReducedReason(reason, language)}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onToggleDetails}
        className="mt-4 w-full min-h-[44px] rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-cyan-600 transition-colors"
      >
        {isExpanded ? c.hideDetails : c.viewDetails}
      </button>
    </article>
  );
};

export const MvpTopRecommendations: React.FC<MvpTopRecommendationsProps> = ({
  language,
  selectedAreaName,
  preferences,
  userLocation,
  onExploreAll,
}) => {
  const [expandedBeachId, setExpandedBeachId] = useState<string | null>(null);
  const c = copy[language === 'gr' ? 'gr' : 'en'];
  const windDirectionLabel = language === 'gr'
    ? (greekWindDirections[mockWeatherConditions.windDirection] || mockWeatherConditions.windDirection)
    : mockWeatherConditions.windDirection;
  const localMockBeaches = useMemo(
    () => mockBeaches.filter(beach => matchesSelectedArea(beach, selectedAreaName)),
    [selectedAreaName],
  );
  const topRecommendations = useMemo(
    () => getTopMockBeachRecommendations(3, localMockBeaches, undefined, undefined, preferences, userLocation),
    [localMockBeaches, preferences, userLocation],
  );

  if (localMockBeaches.length === 0 || topRecommendations.length === 0) return null;

  return (
    <section className="space-y-5 sm:space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-sm font-bold text-cyan-700 dark:text-cyan-300">{c.eyebrow}</p>
          <h2 className="section-title">{c.title}</h2>
          <p className="section-subtitle">{c.subtitle}</p>
        </div>
        <div className="rounded-3xl bg-white/80 dark:bg-slate-900/80 border border-white/70 dark:border-slate-800 px-4 py-3 shadow-sm">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{c.status}</p>
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            {windDirectionLabel} · {mockWeatherConditions.windSpeedKmh} km/h · {waveLabels[mockMarineConditions.waveCondition][language === 'gr' ? 'gr' : 'en']}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.mockNote}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {topRecommendations.map((result, index) => {
          const beach = localMockBeaches.find(item => item.id === result.beachId);
          if (!beach) return null;

          return (
            <RecommendationCard
              key={result.beachId}
              rank={index + 1}
              result={result}
              beach={beach}
              language={language}
              isExpanded={expandedBeachId === result.beachId}
              onToggleDetails={() => setExpandedBeachId(prev => prev === result.beachId ? null : result.beachId)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onExploreAll}
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-3 rounded-2xl bg-white/85 dark:bg-slate-900/85 border border-white/70 dark:border-slate-800 text-slate-900 dark:text-white font-bold shadow-sm hover:border-cyan-200 hover:text-cyan-700 transition-colors"
      >
        {c.exploreAll}
        <ArrowRight className="w-4 h-4" />
      </button>
    </section>
  );
};
