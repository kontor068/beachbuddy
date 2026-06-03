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
                  'services/beachService.ts',
                ])) {
                  return 'beach-content';
                }

                if (isAnyProjectModule(id, [
                  'data/photoRegistry.ts',
                  'data/destinationPhotoAdapter.ts',
                  'hooks/useBeaches.ts',
                  'hooks/useLocation.ts',
                  'hooks/useWeather.ts',
                  'services/analyticsService.ts',
                  'services/beachDataLoader.ts',
                  'services/beachPhotos.ts',
                  'services/forecastVerificationService.ts',
                  'services/geospatialExposureService.ts',
                  'services/recommendationService.ts',
                  'services/weatherService.ts',
                  'utils/access.ts',
                  'utils/amenities.ts',
                  'utils/beachCopy.ts',
                  'utils/beachUrls.ts',
                  'utils/dateLabels.ts',
                  'utils/filterSummary.ts',
                  'utils/i18n.ts',
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
