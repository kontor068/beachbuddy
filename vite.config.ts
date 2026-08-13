import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    // ONLY VITE_-prefixed variables, deliberately.
    //
    // This used to be loadEnv(mode, '.', '') — an empty prefix, which loads EVERY variable
    // in the build environment, including server-only secrets. Combined with the `define`
    // block that used to sit at the bottom of this file, any value of GEMINI_API_KEY set in
    // the Netlify UI would have been written verbatim into the JavaScript every visitor
    // downloads. Nothing leaked only because the variable happened to be empty.
    //
    // Keep the prefix. A secret that is never loaded here cannot be inlined by accident.
    // If a build step genuinely needs a server-only value, read process.env inside that
    // step — never through `env` and never through `define`.
    // Guarded by: npm run quality:bundle-secrets (scripts/validateBundleSecrets.mjs).
    const env = loadEnv(mode, '.', 'VITE_');
    const normalizeId = (id: string) => id.split(path.sep).join('/');
    const isProjectModule = (id: string) => !normalizeId(id).includes('/node_modules/');
    const isAnyProjectModule = (id: string, modules: string[]) => {
      const normalizedId = normalizeId(id);
      return modules.some(modulePath => normalizedId.endsWith(modulePath) || normalizedId.includes(`/${modulePath}`));
    };

    return {
      server: {
        port: 3000,
        strictPort: true,
        host: '0.0.0.0',
        open: 'http://localhost:3000/',
        // Local stand-in for the netlify.toml rewrite `/api/forecast/* → /.netlify/
        // functions/forecast`. INERT unless VITE_FORECAST_PROXY_BASE is set (only then
        // does openMeteoProvider.ts emit `/api/forecast/...` URLs at all).
        //
        // WHY IT EXISTS: Open-Meteo's free quota is counted PER IP (~10k/day). A day of
        // dev browsing plus one national audit script exhausts it for this machine, and
        // every forecast then 429s — which is what the useWeather fallback banner reports.
        // Routing through the deployed function borrows Netlify's egress IP and its CDN
        // cache, so local work keeps running on real data instead of a fixture.
        //
        // Must be a SAME-ORIGIN vite proxy, not an absolute VITE_FORECAST_PROXY_BASE:
        // netlify/functions/forecast.mjs sends no CORS headers (deliberately — it must
        // not be usable as an open relay from other origins).
        proxy: {
          '/api/forecast': {
            target: env.VITE_FORECAST_PROXY_ORIGIN || 'https://calmbeach.gr',
            changeOrigin: true,
          },
        },
      },
      plugins: [react(), tailwindcss()],
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              const normalizedId = normalizeId(id);

              if (isProjectModule(id)) {
                if (normalizedId.endsWith('/translations.ts')) {
                  return 'app-i18n';
                }

                if (isAnyProjectModule(id, [
                  'data/beachPhotosById.generated.json',
                  'data/destinationPhotoAdapter.ts',
                  'data/destinationStripPhotos.generated.json',
                  'data/photoRegistry.ts',
                  'data/regionStripPhotos.generated.json',
                  'data/sourcedRegionStripPhotos.generated.json',
                  'services/beachImageService.ts',
                  'services/beachPhotos.ts',
                  'src/data/beachImages.milos.json',
                ])) {
                  return 'beach-media';
                }

                if (isAnyProjectModule(id, [
                  'services/beachService.ts',
                ])) {
                  return 'beach-content';
                }

                if (isAnyProjectModule(id, [
                  'hooks/useBeaches.ts',
                  'hooks/useLocation.ts',
                  'hooks/useWeather.ts',
                  'services/analyticsService.ts',
                  'services/beachDataLoader.ts',
                  'services/forecastVerificationService.ts',
                  'services/geospatialExposureService.ts',
                  'services/recommendationService.ts',
                  'services/topPickRanking.ts',
                  'services/weatherService.ts',
                  'utils/access.ts',
                  'utils/amenities.ts',
                  'utils/beachCopy.ts',
                  'utils/beachUrls.ts',
                  'utils/dateLabels.ts',
                  'utils/filterSummary.ts',
                  'utils/i18n.ts',
                  'utils/infoOnlyRegions.ts',
                  'utils/localization.ts',
                  'utils/mapExposure.ts',
                  'utils/navigation.ts',
                  'utils/preferenceFilterLabels.ts',
                  'utils/scroll.ts',
                  'utils/seaConditions.ts',
                  'utils/topPickTiming.ts',
                  'utils/touristPriority.ts',
                  'utils/weatherFixtures.ts',
                  'utils/weatherUtils.ts',
                  'utils/windExposureEngine.ts',
                  'utils/windProfileOverrides.ts',
                ])) {
                  return 'beach-logic';
                }

                if (isAnyProjectModule(id, [
                  'components/BeachCard.tsx',
                  'components/BeachConditionScore.tsx',
                  'components/BeachFilters.tsx',
                  'components/BeachList.tsx',
                  'components/BeachSearcherHome.tsx',
                  'components/ErrorDisplay.tsx',
                  'components/Forecast.tsx',
                  'components/Header.tsx',
                  'components/LegalFooter.tsx',
                  'components/MapLoadBoundary.tsx',
                  'components/MobileBottomNav.tsx',
                  'components/PreferenceFilters.tsx',
                  'components/PrivacyConsentBanner.tsx',
                  'components/RecommendationSection.tsx',
                  'components/SkeletonLoader.tsx',
                  'components/TodayScoreBadge.tsx',
                  'components/UnsafeConditionsMessage.tsx',
                  'components/WeatherSummary.tsx',
                  'components/photos/CuratedPhotoImage.tsx',
                  'components/photos/index.ts',
                ])) {
                  return 'beach-ui';
                }

                // Accounts. Kept in its own chunk so that signing in is the only
                // thing that ever downloads it — a visitor who never logs in (the
                // overwhelming majority) pays nothing for the feature existing.
                // Anything added here must stay off the import path of App.tsx.
                //
                // 13/08/2026 — that rule was being broken and the chunk was landing on
                // every first paint. App.tsx imports useAuth and useFavoritesSync
                // directly (it has to: they are hooks), which dragged the whole chunk in
                // — including the 27 KB account panel nobody sees until they click their
                // own avatar. The panel is now lazy-loaded from Header.tsx, so it is
                // deliberately NOT listed here: leaving it in this list would glue it
                // back to the eager modules and undo the split. The hooks below stay,
                // because they are genuinely needed on first paint to answer "is anyone
                // signed in?" — they never touch the Supabase SDK unless one is.
                if (isAnyProjectModule(id, [
                  'components/auth/AuthCallbackScreen.tsx',
                  'hooks/useAuth.ts',
                  'hooks/useFavoritesSync.ts',
                  'services/authService.ts',
                  'services/supabaseClient.ts',
                ])) {
                  return 'account-ui';
                }

                return undefined;
              }

              // The Supabase SDK is ~40-60 KB gzipped — bigger than the budget has
              // room for in the entry chunk (see scripts/auditBundlePerformance.mjs).
              // It is only ever reached through a dynamic import in
              // services/supabaseClient.ts, and this keeps it that way.
              if (normalizedId.includes('node_modules/@supabase')) {
                return 'supabase-vendor';
              }

              if (normalizedId.includes('node_modules/react/') || normalizedId.includes('node_modules/react-dom/') || normalizedId.includes('node_modules/scheduler/')) {
                return 'react-vendor';
              }

              if (normalizedId.includes('node_modules/motion') || normalizedId.includes('node_modules/framer-motion')) {
                return 'motion-vendor';
              }

              if (normalizedId.includes('node_modules/lucide-react')) {
                return 'icons-vendor';
              }

              if (normalizedId.includes('node_modules/leaflet') || normalizedId.includes('node_modules/react-leaflet')) {
                return 'map-vendor';
              }

              return undefined;
            },
          },
        },
      },
      // NO `define` BLOCK HERE, ON PURPOSE.
      //
      // There was one, injecting process.env.API_KEY and process.env.GEMINI_API_KEY from an
      // unprefixed GEMINI_API_KEY. Nothing in the app ever read either name (geminiService.ts
      // reads import.meta.env.VITE_GEMINI_API_KEY), so it bought us nothing and would have
      // published a real key the first time one was set in the Netlify build environment.
      //
      // `define` bypasses Vite's VITE_ safety prefix: whatever you put in it is substituted
      // into the client bundle as a literal. If you ever need it, only for values that are
      // already public.
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
