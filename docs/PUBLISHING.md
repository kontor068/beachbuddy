# Δημοσίευση του Calm Beach στα app stores

Η εφαρμογή «τυλίχτηκε» με **Capacitor** (native shell γύρω από το υπάρχον `dist/` web build).
Το ίδιο codebase πάει σε **Android (Google Play)** τώρα και σε **iOS (App Store)** αργότερα από Mac.

- `appId` (μόνιμο): **`gr.calmbeach.app`**
- App name: **Calm Beach Greece**
- Web origin μέσα στο app: `https://localhost` (bundled assets, δουλεύει offline)

---

## 0. Τι χρειάζεται ΠΡΙΝ τη δημοσίευση (blockers)

1. **Στοιχεία νομικού υπευθύνου** — συμπλήρωσε τα placeholders (`[...]`) σε:
   - `public/privacy/index.html`
   - `public/terms/index.html`
   - `components/LegalFooter.tsx` (το in-app modal — sections «Υπεύθυνος επεξεργασίας» + `ownerTodo`)

   Χρειάζονται: νομική επωνυμία/όνομα, public email επικοινωνίας, έδρα (αν χρειάζεται), εφαρμοστέο δίκαιο.
   Μετά: `npm run build` και push → οι σελίδες ζουν στο `calmbeach.gr/privacy` & `/terms`.
2. **Google Play developer account** (25$ εφάπαξ) — https://play.google.com/console (ταυτοποίηση 1–2 μέρες).
3. **Android Studio** εγκατεστημένο (φέρνει JDK 21 + Android SDK). Το build του `.aab` ΔΕΝ γίνεται χωρίς αυτό.

---

## 1. Εγκατάσταση Android Studio (μία φορά, σε Windows)

1. Κατέβασε & εγκατέστησε Android Studio: https://developer.android.com/studio
2. Στο πρώτο άνοιγμα: αποδοχή SDK licenses, εγκατάσταση **Android SDK Platform 35/36** + **Build-Tools**.
3. Επιβεβαίωσε ότι υπάρχει JDK (το Android Studio φέρνει JBR 21). Προαιρετικά set:
   - `ANDROID_HOME = C:\Users\<you>\AppData\Local\Android\Sdk`
4. (Για δοκιμή σε emulator) δημιούργησε ένα Virtual Device (Pixel, API 35).

---

## 2. Χτίσιμο & συγχρονισμός (κάθε φορά που αλλάζει ο κώδικας)

```bash
npm run cap:sync          # = npm run build + npx cap sync  (web → native)
npm run android:open      # ανοίγει το project στο Android Studio
```

Εναλλακτικά δοκιμή σε συσκευή/emulator απευθείας:
```bash
npx cap run android
```

### Smoke test (στο Android Studio / συσκευή)
- [ ] Δεν υπάρχει white screen· φορτώνει το shell.
- [ ] Airplane mode → η εφαρμογή ανοίγει (offline shell), τα δεδομένα ζητούν δίκτυο.
- [ ] «Κοντά μου» → εμφανίζεται native location prompt και δίνει αποτελέσματα.
- [ ] Χάρτης (Leaflet) renders· εξωτερικοί σύνδεσμοι (Google Maps, credits) ανοίγουν σε system browser.
- [ ] Android back button πλοηγεί σωστά και βγαίνει στο root.
- [ ] Status bar/splash σε σωστά χρώματα (teal). Αν το περιεχόμενο μπαίνει κάτω από το status bar (Android 15+ edge-to-edge), πες μου να προσθέσω safe-area insets.

---

## 3. Versioning

Σε `android/app/build.gradle` (`defaultConfig`):
- `versionCode` → **+1 σε ΚΑΘΕ upload** (ακέραιος: 1, 2, 3, …).
- `versionName` → ορατή έκδοση (π.χ. "1.0.0").

---

## 4. Υπογραφή & build του `.aab` (Android App Bundle)

**Συνιστώμενος τρόπος — Android Studio wizard (χωρίς επεξεργασία gradle):**

1. Android Studio → **Build → Generate Signed App Bundle / APK… → Android App Bundle**.
2. **Create new… keystore**:
   - Path: π.χ. `C:\Users\<you>\keys\calmbeach-upload.jks` (ΕΚΤΟΣ του repo — είναι ήδη στο `.gitignore`).
   - Δυνατό password· alias π.χ. `upload`. **Κράτα offline backup** — αν χαθεί, χάνεις τη δυνατότητα update.
3. Build variant: **release** → Finish.
4. Παράγεται το `app-release.aab` στο `android/app/release/`.

> **Play App Signing:** στην πρώτη ανέβασμα στο Play Console, η Google αναλαμβάνει το τελικό app signing key — εσύ ανεβάζεις πάντα με το **upload key** (το παραπάνω keystore). Κράτα το ίδιο keystore για όλα τα μελλοντικά updates.

**Εναλλακτικά μέσω CLI** (αφού στηθεί signing config):
```bash
cd android
./gradlew.bat bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

---

## 5. Google Play Console — δημιουργία & listing

1. **Create app**: όνομα «Calm Beach Greece», γλώσσα default, app (όχι game), free.
2. **Store listing**:
   - Short description (≤80): π.χ. *«Βρες ήρεμη παραλία σήμερα με βάση άνεμο, κύμα και καιρό.»*
   - Full description (≤4000): προσαρμογή από το meta του `index.html` / `App.tsx seoCopy` (GR + EN· πρόσθεσε locale Ελληνικά).
   - **App icon 512×512**: `store-assets/play-icon-512.png` (παράγεται με `npm run native:assets`).
   - **Feature graphic 1024×500**: `store-assets/feature-graphic-1024x500.png` (draft — βελτίωσέ το με κείμενο αν θες).
   - **Screenshots τηλεφώνου** (≥2, ~1080×1920+): τράβα φρέσκα σε store ανάλυση (τα `reports/visual-qa/*-mobile-390.png` είναι πολύ χαμηλά). Μπορώ να φτιάξω script αν θες.
   - Category: **Travel & Local** (ή Weather)· contact email· **Privacy Policy URL = `https://calmbeach.gr/privacy/`**.
3. **App content** (αριστερό μενού):
   - **Data safety**: Τοποθεσία → *συλλέγεται, on-device, ΔΕΝ μοιράζεται, App functionality, optional*. Analytics (Google Analytics) → app interactions / device identifiers, για analytics, βάσει συγκατάθεσης.
   - **Content rating** (IARC questionnaire) → πιθανό Everyone / PEGI 3.
   - **Target audience**: 13+ (όχι παιδιά).
   - **Ads**: όχι (δεν υπάρχουν διαφημίσεις).
   - **Government/financial/health**: όχι.
4. **Release**:
   - Ξεκίνα στο **Testing → Internal testing** → ανέβασε το `.aab` → πρόσθεσε τον εαυτό σου ως tester → εγκατάσταση μέσω του opt-in link → δοκιμή.
   - Όταν είσαι ΟΚ → **Production → Create release** → ανέβασε `.aab` → **Send for review**.
   - Πρώτη review: συνήθως 1–7 μέρες.

---

## 6. iOS (αργότερα, ΑΠΑΙΤΕΙ Mac)

Το `@capacitor/ios` είναι ήδη εγκατεστημένο. Σε **Mac με Xcode**:
```bash
npm install
npm run build
npx cap add ios          # δημιουργεί ios/ + pod install
npx cap sync ios
npx cap open ios         # Xcode
```
Στο Xcode: signing team (Apple Developer 99$/έτος), bundle id `gr.calmbeach.app`, στο `Info.plist`
πρόσθεσε **`NSLocationWhenInUseUsageDescription`** (π.χ. «Για να βρει κοντινές παραλίες με βάση την τοποθεσία σου.»),
μετά Product → Archive → Distribute → App Store Connect.

---

## 7. Σημείωση ασφαλείας (προϋπάρχουσα — προαιρετική βελτίωση)

Το AI chatbot (Gemini, `services/geminiService.ts`) καλεί το API client-side με κλειδί. Αυτό είναι **ήδη
εκτεθειμένο στο web bundle** στο calmbeach.gr — το APK δεν προσθέτει νέα έκθεση. Καλό είναι (κάποια στιγμή)
να περιοριστεί το κλειδί (HTTP referrer/quota) ή να μπει πίσω από serverless proxy. Δεν μπλοκάρει τη δημοσίευση.

---

## Γρήγορη αναφορά εντολών

| Σκοπός | Εντολή |
|---|---|
| Παραγωγή icons/splash sources | `npm run native:assets` |
| Build web + sync → native | `npm run cap:sync` |
| Άνοιγμα Android Studio | `npm run android:open` |
| Run σε συσκευή/emulator | `npx cap run android` |
| Έλεγχος setup | `npx cap doctor` |
