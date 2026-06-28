import { Capacitor } from '@capacitor/core';

// Native-only wiring for the Capacitor (Android/iOS) shell. Every call is a no-op on
// the web build: the function returns early unless running inside a native WebView, and
// the plugin modules are imported lazily so they never land in the web bundle's eager path.
export async function initializeNativeApp(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  const [{ StatusBar, Style }, { SplashScreen }, { App }, { Browser }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
    import('@capacitor/browser'),
  ]);

  // Status bar tinted to the brand teal with light icons. Best-effort: on Android 15+
  // edge-to-edge some of these are no-ops, which is harmless.
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setBackgroundColor({ color: '#0d9488' });
    await StatusBar.setStyle({ style: Style.Dark }); // light text/icons on the dark teal bar
  } catch {
    /* status bar styling is cosmetic; ignore on platforms that reject it */
  }

  // Android hardware back button: walk the in-app history, exit only at the root.
  App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      App.exitApp();
    }
  });

  // External http(s) links (map deep-links, photo credits, etc.) open in the system
  // browser instead of being trapped inside the app WebView. Internal navigation uses
  // relative paths / pushState (origin https://localhost) and is left untouched.
  document.addEventListener('click', (event) => {
    const anchor = (event.target as HTMLElement | null)?.closest?.('a');
    const href = anchor?.getAttribute('href');
    if (!href) return;
    const isExternal = /^https?:\/\//i.test(href) && !href.startsWith(window.location.origin);
    if (!isExternal) return;
    event.preventDefault();
    void Browser.open({ url: href });
  });

  // Hide the native splash now that the web shell has booted (autoHide in
  // capacitor.config.ts is the safety net if this never runs).
  try {
    await SplashScreen.hide();
  } catch {
    /* splash auto-hides anyway */
  }
}
