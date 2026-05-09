
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

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

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').then(registration => {
        console.log('SW registered: ', registration);
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
