
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { App } from './App';
import './index.css';
import { initializeAnalytics } from './services/analyticsService';
import { recordPageview } from './services/pageviewBeacon';
import { initializeNativeApp } from './utils/nativeBootstrap';
import { isChunkLoadError, recoverFromChunkLoadError, registerChunkLoadErrorHandler } from './utils/chunkLoadRecovery';
import { installGlobalErrorReporting, reportClientError } from './services/errorReporter';

declare global {
  interface Window {
    __calmBeachFallbackTimer?: number;
  }
}

type RootErrorBoundaryProps = {
  children: React.ReactNode;
};

type RootErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class RootErrorBoundary extends React.Component<RootErrorBoundaryProps, RootErrorBoundaryState> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): RootErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unknown runtime error'
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('RootErrorBoundary', error, info);
    if (isChunkLoadError(error)) {
      // A stale chunk after a deploy is expected and self-healing — the recovery
      // reloads into the new build. Reporting it would fill the channel with an
      // event that means "we shipped", not "we broke".
      void recoverFromChunkLoadError(error, 'RootErrorBoundary');
      return;
    }
    // Everything that reaches here blanked the page for a real visitor.
    reportClientError(error, { source: 'RootErrorBoundary' });
  }

  private handleReset = () => {
    const keysToClear = [
      'favorites',
      'savedItineraries',
      'customIslands',
      'userPreferences',
      'selectedIslandId'
    ];
    keysToClear.forEach((key) => localStorage.removeItem(key));

    // The forecast caches are by far the biggest thing this app stores, and a FULL
    // localStorage is one of the reasons a visitor ends up looking at this button
    // in the first place (a quota error crashes any unguarded write). Clearing the
    // five keys above would not free a byte of it, so the button would "fix"
    // nothing and the next tap would crash again. These entries all refetch.
    try {
      Object.keys(localStorage)
        .filter((key) => key.startsWith('forecast_') || key.startsWith('marine_') || key.startsWith('weather_'))
        .forEach((key) => localStorage.removeItem(key));
    } catch {
      /* nothing else to try — reload anyway */
    }

    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px', background: '#f1f5f9', color: '#0f172a' }}>
          <div style={{ maxWidth: '720px', width: '100%', background: 'white', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px' }}>
            <h1 style={{ margin: 0, fontSize: '20px' }}>The app encountered an error.</h1>
            <p style={{ marginTop: '10px', marginBottom: '10px' }}>Runtime message:</p>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={this.handleReset}
              style={{ marginTop: '12px', background: '#0ea5e9', color: 'white', border: 0, borderRadius: '8px', padding: '10px 14px', cursor: 'pointer' }}
            >
              Clear local app data and reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

if (window.__calmBeachFallbackTimer) {
  window.clearTimeout(window.__calmBeachFallbackTimer);
  window.__calmBeachFallbackTimer = undefined;
}
document.documentElement.classList.add('app-mounted');

const root = ReactDOM.createRoot(rootElement);

// The OAuth return trip gets its own tiny screen instead of the whole app: it is
// on screen for about a second, it needs none of the beach data, and mounting App
// here would run the entire homepage boot for a page nobody looks at. Dynamically
// imported, so this costs zero bytes for every other visitor.
const isAuthCallback = window.location.pathname.replace(/\/+$/, '') === '/auth/callback';

if (isAuthCallback) {
  void import('./components/auth/AuthCallbackScreen')
    .then(({ mountAuthCallback }) => mountAuthCallback(root))
    .catch((error) => {
      // Never strand someone mid-sign-in on a blank page.
      console.error('Auth callback failed to load.', error);
      window.location.replace('/');
    });
} else {
  root.render(
    <React.StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </React.StrictMode>
  );
}

// Before anything else that can throw: the boundary only sees errors inside the
// React tree, and plenty of what breaks a page happens outside it.
installGlobalErrorReporting();
initializeAnalytics();
// First-party, consent-free real-visitor count for the initial load. SPA navigations
// are counted from App.tsx's page-view effect. See services/pageviewBeacon.ts.
recordPageview('load');
registerChunkLoadErrorHandler();
void initializeNativeApp();

// In the bundled native shell the web assets are already local, so the service worker
// adds nothing and its controllerchange->reload behaviour can misfire. Only register on
// the web build; the calmbeach.gr PWA behaviour is unchanged.
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  if (import.meta.env.PROD) {
    // Reload exactly once when a freshly deployed service worker takes control, so
    // an already-open tab starts running the new code without the user having to
    // hard-refresh. We only arm this when a controller already exists at load time:
    // on a first-ever visit the initial SW also fires `controllerchange` (null ->
    // active) and we must NOT reload then. The guard flag prevents a reload loop.
    let isReloadingForNewVersion = false;
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (isReloadingForNewVersion) return;
        isReloadingForNewVersion = true;
        window.location.reload();
      });
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').then(registration => {
        console.log('SW registered: ', registration);

        // A long-open SPA tab only navigates via pushState, so the browser may not
        // check for a new SW for hours. Poll for updates when the tab regains focus
        // and on a light interval; when one is found the SW skipWaiting/claims and
        // the controllerchange handler above reloads us into the new build.
        const checkForUpdate = () => { registration.update().catch(() => {}); };
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdate();
        });
        window.setInterval(checkForUpdate, 60 * 1000);
      }).catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
    });
  } else {
    // Prevent stale caching during local development.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    }).catch(() => {});
  }
}
