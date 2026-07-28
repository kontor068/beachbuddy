# 09 · QA & Testing

**Κατάσταση:** 🟡 Μερικώς καλυμμένο · **Τελευταία ενημέρωση:** 28/07/2026 (πλήρης έλεγχος στον κώδικα)

## 1. Τι κοιτάει αυτός ο ρόλος
Τι σπάει, πώς το βρίσκουμε πριν το βρει ο χρήστης.

## 2. Τι ξέρουμε ήδη ✅

- ✅ **ΥΠΑΡΧΕΙ διαδικασία ελέγχου, και τρέχει αυτόματα.** *(Τα παλιά έγγραφα έλεγαν «καμία διαδικασία» — ήταν λάθος.)* `npm run quality:critical` → `scripts/runCriticalQualityChecks.mjs`, **13 έλεγχοι**:

  | # | Έλεγχος | Τι εγγυάται |
  |---|---|---|
  | 1 | beach-data | άκυρα/διπλά id, συντεταγμένες εκτός Ελλάδας, άκυρες τιμές, **κενά άδειας/απόδοσης φωτογραφιών** |
  | 2 | shorelines | οι αποθηκευμένες ακτογραμμές ταιριάζουν ακόμη με τις συντεταγμένες |
  | 3 | wind-exposure | **225 ισχυρισμοί** για shelter / fetch / βεβαιότητα |
  | 4 | marine-models | client και edge proxy συμφωνούν στα καρφωμένα μοντέλα |
  | 5 | recommendation-scenarios | **71 ισχυρισμοί** σε σταθερά σενάρια |
  | 6 | trip-query-parsing | αναγνώριση ερωτημάτων σε 5 γλώσσες |
  | 7 | planner-agreement («το δίχτυ») | ο planner δεν αντιφάσκει με την αρχική· 11 έλεγχοι |
  | 8 | content:audit | κόβει διατυπώσεις τύπου «εγγυημένα ασφαλής» |
  | 9 | athens-clock | απαγορεύει το ρολόι της συσκευής ως «τώρα» |
  | 10 | lint | `tsc --noEmit` |
  | 11 | build | πλήρες production build |
  | 12 | **bundle-secrets** | το `vite.config.ts` δεν μπορεί να περάσει μυστικό στο bundle· σάρωση όλου του `dist/` για κλειδιά *(νέο 28/07)* |
  | 13 | seo:audit | prerender, sitemap, robots, canonicals, hreflang, structured data, budgets |

- ✅ **Τρέχει στο CI σε κάθε pull request και κάθε push στο main** — `.github/workflows/quality.yml`, με `CONTEXT=production`.
- ✅ **Άλλα 9 εργαλεία ελέγχου εκτός πύλης** (report-only): `audit:beaches`, `audit:place-resolution`, `audit:wind-profile-evidence`, `validate:meltemi-matrix`, `validateWindExposureGroundTruth`, `validateGeospatialExposureProfiles`, `validateRegionMapStability`, `perf:audit`, `analytics:audit`.
- ✅ Υπάρχουν **δύο error boundaries** στο UI: `index.tsx:27-83` (ρίζα, με ανάκτηση από αποτυχία chunk) και `components/MapLoadBoundary.tsx`.

## 3. Τι μας λείπει ❓

| # | Ερώτηση | Απάντηση |
|---|---------|----------|
| 1 | ~~Υπάρχουν automated tests;~~ | ✅ Ναι — 13 έλεγχοι στο CI |
| 2 | Έχεις δοκιμάσει σε iPhone Safari / Android Chrome σε πραγματικό δίκτυο νησιού; | ❓ |
| 3 | Έχει αναφέρει χρήστης bug; Πού καταγράφηκε; | ❓ Βλ. 16 — έρχονται σε Telegram και δεν αποθηκεύονται πουθενά |

## 4. Ρίσκα / ανοιχτά θέματα

- ⚠️ **Δεν υπάρχει test runner και ούτε ένα `*.test.ts` / `*.spec.ts` σε όλο το repo.** Το `@playwright/test` είναι εγκατεστημένο αλλά χρησιμοποιείται μόνο σαν βιβλιοθήκη scripting (screenshots, σταθερότητα χάρτη) — **δεν υπάρχει e2e σουίτα**. Ό,τι ελέγχεται, ελέγχεται από τα 13 scripts πάνω σε δεδομένα και build, όχι πάνω σε πραγματικό browser με χρήστη.
- ⚠️ **Το «visual QA» δεν είναι visual regression.** Το `scripts/visualQa.mjs` βγάζει screenshots σε 2 αναλύσεις — **δεν συγκρίνει τίποτα με τίποτα** (μηδέν pixelmatch/snapshot). Αν χαλάσει η εμφάνιση, κανένας έλεγχος δεν κοκκινίζει. Επιπλέον ο φάκελος `reports/visual-qa/` είναι στο `.gitignore` (τα 29 που είναι στο git προϋπήρχαν του κανόνα).
- ⚠️ **Κανένα error tracking για πραγματικούς χρήστες.** Το boundary κάνει `console.error` και τίποτα άλλο· δεν υπάρχει `window.onerror`, δεν φεύγει τίποτα προς τα έξω. **Ένα crash στο κινητό ενός τουρίστα δεν το μαθαίνεις ποτέ.**
- 🟡 Το mobile ελέγχεται μόνο ως viewport 390px σε screenshot. Δεν υπάρχει δοκιμή σε αργό δίκτυο ή σε πραγματική συσκευή.

## 5. Επόμενα βήματα (πρόταση)

1. **Error tracking** (Sentry free tier αρκεί) συνδεδεμένο στο υπάρχον `RootErrorBoundary`. Είναι η μόνη κατηγορία σφάλματος που σήμερα είναι 100% αόρατη.
2. Μία φορά: άνοιξε το site σε πραγματικό κινητό με 4G σε νησί και πέρνα 5 οθόνες. Το κοινό σου είναι ακριβώς εκεί.

## 6. Ιστορικό
- 28/07/2026 — Δημιουργία εγγράφου
- 28/07/2026 — Έλεγχος στον κώδικα: **ανατράπηκε το «δεν υπάρχει καμία διαδικασία ελέγχου»** — βρέθηκαν 12 έλεγχοι σε CI· ταυτόχρονα επιβεβαιώθηκε ότι δεν υπάρχει e2e σουίτα, ούτε visual regression, ούτε error tracking
- 28/07/2026 — Προστέθηκε 13ος έλεγχος: `quality:bundle-secrets` (βλ. 15 · Security)
