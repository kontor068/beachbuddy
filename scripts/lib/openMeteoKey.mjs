/**
 * ΤΟ ΚΛΕΙΔΙ OPEN-METEO, ΜΕ ΜΙΑ ΣΥΝΑΡΤΗΣΗ (12/09/2026).
 *
 * Τρία scripts χρειάζονται το πληρωμένο κλειδί (φύλακας σταθμών, αποσυμπίεση, εθνικό rollout) και
 * μόνο ο φύλακας ήξερε να το βρει χωρίς να του το δώσεις στο περιβάλλον — τα άλλα δύο σταματούσαν
 * με «θέλει OPEN_METEO_API_KEY», κι έτσι το εθνικό rollout δεν ξανατρέχτηκε μετά τις 24/08 (βίβλος
 * §Γ81, Δ4). Ίδια σειρά αναζήτησης με τον φύλακα (scripts/validateColourAgainstStations.mjs):
 *   1. process.env.OPEN_METEO_API_KEY
 *   2. το περιβάλλον του site στο Netlify, με το NETLIFY_AUTH_TOKEN του .env και το siteId του
 *      .netlify/state.json (μόνο στο κύριο μηχάνημα — ένα καθαρό clone γυρίζει null)
 * Δεν τυπώνει ποτέ την τιμή.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const resolveOpenMeteoKey = async () => {
  if (process.env.OPEN_METEO_API_KEY?.trim()) return process.env.OPEN_METEO_API_KEY.trim();
  const envFile = path.join(root, '.env');
  const stateFile = path.join(root, '.netlify/state.json');
  if (!existsSync(envFile) || !existsSync(stateFile)) return null;
  const token = (readFileSync(envFile, 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
  if (!token) return null;
  const siteId = JSON.parse(readFileSync(stateFile, 'utf8')).siteId;
  if (!siteId) return null;
  try {
    const res = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return ((await res.json()).values || []).map(v => v.value).find(Boolean) ?? null;
  } catch {
    return null;
  }
};
