import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
                  'utils/islandContextStrip.ts',
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
                  'services/beachPhotos.ts',
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
                  'components/WindInfo.tsx',
                  'components/photos/CuratedPhotoImage.tsx',
                  'components/photos/index.ts',
                ])) {
                  return 'beach-ui';
                }

                return undefined;
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
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
