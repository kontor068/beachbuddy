import type { CapacitorConfig } from '@capacitor/cli';

// Native shell for the CalmBeach PWA. The web assets in `dist/` are BUNDLED into the
// app (we deliberately do NOT point at the live calmbeach.gr URL): the shell works
// offline and presents as a real native app, which also keeps us clear of Apple's
// "this is just a website" rejection (guideline 4.2) when the iOS build follows.
const config: CapacitorConfig = {
  appId: 'gr.calmbeach.app',
  appName: 'Calm Beach Greece',
  webDir: 'dist',
  android: {
    // `https` is Capacitor's default Android scheme; stated explicitly because it
    // matters here: a secure (https://localhost) origin is required for the
    // Geolocation API ("Κοντά μου") and avoids mixed-content with the https
    // open-meteo weather/marine endpoints the app fetches at runtime.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      // autoHide stays on as a safety net; the native bootstrap also calls hide()
      // as soon as the React shell mounts, so the splash is as short as possible
      // but can never get stuck if JS fails to boot.
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#0d9488',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
  },
};

export default config;
