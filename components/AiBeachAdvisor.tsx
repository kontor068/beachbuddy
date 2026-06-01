import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, MapPin, Waves, Wind } from 'lucide-react';
import { Island, WeatherData, DailyForecast, LanguageCode } from '../types';
import { getBeachAdvice, AiAdviceResponse } from '../services/aiAdvisorService';
import { trackEvent } from '../services/analyticsService';

interface AiBeachAdvisorProps {
  allIslands: Island[];
  selectedIsland?: Island | null;
  weather: WeatherData | DailyForecast | null;
  userLocation?: { lat: number; lon: number };
  language: LanguageCode;
}

const greekNeuterPluralPlaces = new Set(['Κύθηρα', 'Αντικύθηρα', 'Κουφονήσια', 'Μέθανα']);

const greekFinalNuInitials = /^[ΑΕΗΙΟΩΥΆΈΉΊΌΏΎΚΠΤΞΨ]/;

const toGreekAccusativePlaceName = (name: string) => {
  if (greekNeuterPluralPlaces.has(name)) return name;
  if (name.endsWith('ος')) return `${name.slice(0, -2)}ο`;
  if (name.endsWith('ης') || name.endsWith('ας')) return name.slice(0, -1);
  return name;
};

const getGreekPlacePhrase = (island?: Island | null) => {
  if (!island) return 'στην περιοχή μου';

  const name = island.name.gr || island.name.en;
  if (greekNeuterPluralPlaces.has(name)) return `στα ${name}`;
  if (name.endsWith('ες')) return `στις ${name}`;
  if (name.endsWith('ι') || name.endsWith('ο')) return `στο ${name}`;

  const accusativeName = toGreekAccusativePlaceName(name);
  const preposition = greekFinalNuInitials.test(accusativeName) ? 'στην' : 'στη';

  return `${preposition} ${accusativeName}`;
};

export const AiBeachAdvisor: React.FC<AiBeachAdvisorProps> = ({
  allIslands,
  selectedIsland,
  weather,
  userLocation,
  language
}) => {
  const [question, setQuestion] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [advice, setAdvice] = useState<AiAdviceResponse | null>(null);

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault();
    const advisorIslands = selectedIsland ? [selectedIsland] : allIslands;
    if (!question.trim() || !weather || advisorIslands.length === 0) return;

    setIsAnalyzing(true);
    setAdvice(null);

    trackEvent('ai_advisor_question', undefined, { question });

    // Simulate a short delay for AI thinking effect
    setTimeout(() => {
      const result = getBeachAdvice(question, advisorIslands, weather, userLocation, language);
      setAdvice(result);
      setIsAnalyzing(false);
    }, 800);
  };

  const placeName = selectedIsland?.name[language] || selectedIsland?.name.en || (language === 'gr' ? 'την περιοχή μου' : 'my current area');
  const greekPlacePhrase = getGreekPlacePhrase(selectedIsland);
  const suggestions = language === 'gr' ? [
    `Ποια παραλία είναι ήρεμη σήμερα ${greekPlacePhrase};`,
    `Πού να πάω με παιδιά ${greekPlacePhrase};`,
    `Ήσυχες παραλίες ${greekPlacePhrase}`,
    `Καλύτερη αμμώδης παραλία ${greekPlacePhrase}`
  ] : [
    `Which beach is calm today in ${placeName}?`,
    `Where should I go with kids in ${placeName}?`,
    `Quiet beaches in ${placeName}`,
    `Best sandy beach in ${placeName}`
  ];
  const placeholder = language === 'gr'
    ? `π.χ., Καλύτερη παραλία ${greekPlacePhrase} σήμερα;`
    : `e.g., Best beach in ${placeName} today?`;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/60 bg-white/70 shadow-lg shadow-sky-900/10 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-900/70">
      <div className="bg-gradient-to-br from-cyan-500/90 via-sky-500/90 to-blue-600/90 p-5 text-white sm:p-6">
        <div className="flex items-center gap-3 mb-2">
          <h2 className="font-heading text-lg font-bold sm:text-xl">
            {language === 'gr' ? 'Ρώτα με οτιδήποτε για την περιοχή' : 'Ask me anything about the area'}
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-relaxed text-white/90">
          {language === 'gr'
            ? 'Πες μου τι ψάχνεις και θα σου προτείνω παραλία με βάση τον καιρό, τη θάλασσα και τις προτιμήσεις σου.'
            : "Ask me anything about beaches in Greece. I'll analyze current weather and beach data to find the perfect spot for you."}
        </p>
      </div>

      <div className="p-5 sm:p-6">
        <form onSubmit={handleAsk} className="relative mb-4">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-white/70 bg-white/70 py-3.5 pl-5 pr-14 text-sm shadow-inner shadow-sky-900/5 transition-all placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={!question.trim() || isAnalyzing || !weather}
            className="absolute bottom-2 right-2 top-2 flex aspect-square items-center justify-center rounded-xl bg-cyan-600 text-white shadow-sm transition-colors hover:bg-cyan-700 disabled:opacity-50 disabled:hover:bg-cyan-600"
          >
            {isAnalyzing ? (
              <Sparkles className="w-5 h-5 animate-pulse" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>

        <AnimatePresence mode="wait">
          {!advice && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-2 sm:flex sm:flex-wrap"
            >
              {suggestions.slice(0, 3).map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => setQuestion(suggestion)}
                  className="rounded-full bg-white/65 px-3.5 py-2 text-left text-xs font-medium text-slate-600 shadow-sm shadow-sky-900/5 transition-colors hover:bg-cyan-50 hover:text-cyan-600 sm:w-auto dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-cyan-900/30 dark:hover:text-cyan-400"
                >
                  {suggestion}
                </button>
              ))}
            </motion.div>
          )}

          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-8 text-slate-400"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 animate-spin text-cyan-500" />
                <span className="text-sm font-medium animate-pulse">{language === 'gr' ? 'Ανάλυση καιρού και δεδομένων παραλίας...' : 'Analyzing weather and beach data...'}</span>
              </div>
            </motion.div>
          )}

          {advice && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl border border-cyan-100 dark:border-cyan-800/30">
                <p className="text-sm text-cyan-900 dark:text-cyan-100 leading-relaxed">
                  {advice.answer}
                </p>
              </div>

              <div className="space-y-3">
                {advice.beaches.map((beach, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex flex-col sm:flex-row gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-cyan-200 dark:hover:border-cyan-800 transition-colors"
                  >
                    <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white font-bold text-lg shadow-sm">
                      {beach.score}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white mb-1">{beach.name}</h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        {beach.explanation}
                      </p>
                    </div>
                  </motion.div>
                ))}
                
                {advice.beaches.length === 0 && (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
                    {language === 'gr' ? 'Δεν βρέθηκαν παραλίες με τα συγκεκριμένα κριτήρια.' : 'No beaches matched your specific criteria.'}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
