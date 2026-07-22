# Πραγματική κίνηση — first-party visitor counter

**Πρόβλημα:** το GA4 είναι consent-gated *και* το κόβουν τα ad-blockers, οπότε
υποεκτιμά τους πραγματικούς επισκέπτες κατά ~50%. Αλλαγή vendor (Cloudflare/Plausible
cloud) δεν βοηθά — τα beacons τους είναι στις ίδιες filter-lists.

**Λύση:** μετράμε στο **δικό μας** origin. Ο client πινγκάρει `/api/hit` (καθαρό
same-origin path, σε καμία adblock λίστα) και μια Netlify function μετράει. Νικάει και
τα δύο εμπόδια:

- **Ad-block** — first-party request στο δικό μας domain, δεν μπλοκάρεται.
- **Consent** — 0 cookies, 0 προσωπικά δεδομένα αποθηκευμένα → νόμιμο χωρίς banner.

## Πώς μένει ανώνυμο (γιατί δεν χρειάζεται consent)

Ο επισκέπτης ταυτοποιείται μόνο με μη-αναστρέψιμο **ημερήσιο** hash:

```
visitor   = sha256( dailySalt + "|" + ip + "|" + userAgent )
dailySalt = sha256( TRAFFIC_HASH_SECRET + "|" + utcDay )   # αλλάζει κάθε μέρα
```

Το salt δεν αποθηκεύεται ποτέ. Άρα το hash δεν αντιστρέφεται σε IP, και ο ίδιος
επισκέπτης παίρνει **διαφορετικό** hash αύριο → κανένα cross-day tracking, μηδέν
προσωπικά δεδομένα σε ηρεμία. (Το μοντέλο του Plausible.)

Η μοναδικότητα μετριέται **race-free**: κάθε μοναδικός επισκέπτης γράφει ένα blob
`d/<μέρα>/<hash>`· επανάληψη επίσκεψης απλώς ξαναγράφει το ίδιο key. Ο αριθμός των
keys μιας μέρας = ακριβής αριθμός μοναδικών.

## Setup (2 env vars στο Netlify → Site settings → Environment variables)

| Var | Τι | Αν λείπει |
|-----|-----|-----------|
| `TRAFFIC_HASH_SECRET` | Τυχαία μυστική συμβολοσειρά (π.χ. `openssl rand -hex 32`). Κάνει το hash πραγματικά μη-σπάσιμο. | Δουλεύει, αλλά με public fallback salt (λιγότερη ανωνυμία). **Βάλε το.** |
| `TRAFFIC_STATS_KEY` | Μυστικό για να δεις το dashboard. | Το `/api/traffic` επιστρέφει 403 (ποτέ δημόσιο). |

Χωρίς redeploy δεν ισχύουν — άλλαξε τα env vars και κάνε redeploy.

## Πού βλέπω τους αριθμούς

```
https://calmbeach.gr/api/traffic?key=ΤΟ_TRAFFIC_STATS_KEY
        &days=30            # παράθυρο (max 90)
        &format=json        # raw δεδομένα αντί για dashboard
```

Δείχνει: μοναδικοί σήμερα, μοναδικοί ανά μέρα, σύνολο προβολών, top πηγές.

## Αρχεία

- `netlify/functions/pageview.mjs` — δέκτης beacon + hashing + Netlify Blobs.
- `netlify/functions/traffic-stats.mjs` — προστατευμένο dashboard.
- `services/pageviewBeacon.ts` — ο client (τρέχει χωρίς consent gate, μόνο production).
- `netlify.toml` — τα `/api/hit` και `/api/traffic` redirects.

## Σημειώσεις

- Μετράει μόνο σε production build (`VITE_APP_ENV=production`). Preview/branch/local: off.
- Bots/crawlers κόβονται server-side (UA screen) ώστε «πραγματικοί» = πραγματικοί.
- Τα per-visitor blobs μένουν επ' αόριστον· σε πολύ μεγάλο όγκο, πρόσθεσε scheduled
  cleanup που σβήνει partitions `d/<μέρα>/…` παλιότερες από ~90 μέρες.
