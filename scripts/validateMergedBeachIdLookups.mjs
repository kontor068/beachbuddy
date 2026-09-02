#!/usr/bin/env node
/**
 * ΤΟ ΣΥΝΘΕΤΙΚΟ ID ΤΟΥ «ΚΟΝΤΑ ΜΟΥ» ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΦΤΑΣΕΙ ΣΕ ΨΗΜΕΝΟ ΑΡΧΕΙΟ.
 *
 * Στο «Κοντά μου» η App.tsx χτίζει μια συγχωνευμένη περιοχή και δίνει σε κάθε παραλία
 * ΣΥΝΘΕΤΙΚΟ id (1, 2, 3…), κρατώντας το αληθινό στο `sourceBeachId`. Κάθε αναζήτηση σε
 * αρχείο κλειδωμένο στο ΑΛΗΘΙΝΟ id πρέπει να ρωτάει με `sourceBeachId ?? id`.
 *
 * Η ΙΣΤΟΡΙΑ, ΓΙΑΤΙ ΕΞΗΓΕΙ ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΠΥΛΗ. Ο κανόνας τηρήθηκε στη γεωμετρία,
 * στις ιστορίες, στο κλίμα και στα σχήματα ακτής — και ΞΕΧΑΣΤΗΚΕ στις φωτογραφίες. Στις
 * 02/09/2026 ο Μίλτος ανέβασε δύο δικές του φωτογραφίες στον Άριλα και στο «Κοντά μου» η
 * κάρτα δεν έδειχνε καμία, ενώ με αναζήτηση ονόματος φαίνονταν κανονικά. Μαζί τους έπεφταν
 * έξω και οι 1.097 παραλίες του beachPhotosById — και οκτώ αληθινές παραλίες με id ≤ 40
 * τύπωναν τη φωτογραφία τους σε ΞΕΝΗ παραλία, επειδή τα συνθετικά id ξεκινούν από το 1.
 *
 * Δεν μετράει συμπεριφορά — μετράει ότι καμία επιφάνεια δεν ρωτάει ΚΑΤΕΥΘΕΙΑΝ τον
 * κατάλογο φωτογραφιών με σκέτο id. Ο σωστός δρόμος είναι το
 * `getBeachPhotoLookupForBeach(beach, …)`, που ξέρει τον κανόνα και τον εφαρμόζει μία φορά.
 *
 * Self-proof (--prove): φυτεύει την απαγορευμένη κλήση σε κείμενο και απαιτεί να πιαστεί.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

/** Where visitor-facing surfaces live. The service itself is the one allowed caller. */
const SCAN_DIRS = ['components', 'pages', 'hooks', 'utils'];
const SCAN_FILES = ['App.tsx'];
const ALLOWED_FILES = new Set(['services/beachPhotos.ts']);

/** The raw entry points that take a bare beach id. */
const RAW_CALL = /\bgetBeachPhotoLookup\s*\(|\bgetBeachPhotos\s*\(/;

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|mjs)$/.test(entry)) out.push(full);
  }
  return out;
};

const collectFiles = () => {
  const files = [];
  for (const dir of SCAN_DIRS) {
    try {
      walk(join(ROOT, dir), files);
    } catch {
      // A directory that does not exist is not a finding.
    }
  }
  for (const file of SCAN_FILES) files.push(join(ROOT, file));
  return files;
};

const findViolations = (files, readFile = readFileSync) => {
  const violations = [];
  for (const file of files) {
    const rel = relative(ROOT, file);
    if (ALLOWED_FILES.has(rel)) continue;

    let source;
    try {
      source = readFile(file, 'utf8');
    } catch {
      continue;
    }

    source.split('\n').forEach((line, index) => {
      if (RAW_CALL.test(line)) violations.push({ file: rel, line: index + 1, text: line.trim() });
    });
  }
  return violations;
};

if (process.argv.includes('--prove')) {
  const planted = findViolations(['/fake/components/Planted.tsx'], () =>
    'const lookup = getBeachPhotoLookup(name.gr, name.en, beach.id, 3, islandName);');
  if (planted.length !== 1) {
    console.error('Self-proof failed: the planted raw call was not caught.');
    process.exit(1);
  }
  const clean = findViolations(['/fake/components/Clean.tsx'], () =>
    'const lookup = getBeachPhotoLookupForBeach(beach, 3, islandName);');
  if (clean.length !== 0) {
    console.error('Self-proof failed: the correct call was reported as a violation.');
    process.exit(1);
  }
  console.log('Self-proof passed: the guard catches a raw lookup and clears the correct one.');
}

const files = collectFiles();
const violations = findViolations(files);

console.log(`Merged-id photo lookup guard — scanned ${files.length} files.`);

if (violations.length > 0) {
  console.error('\nΑυτές οι κλήσεις ρωτάνε τον κατάλογο φωτογραφιών με σκέτο id:');
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.text}`);
  console.error(
    '\nΣτο «Κοντά μου» το id είναι συνθετικό — η κλήση χάνει τις φωτογραφίες της παραλίας ' +
    'και μπορεί να τραβήξει φωτογραφία ΑΛΛΗΣ. Χρησιμοποίησε getBeachPhotoLookupForBeach(beach, …).',
  );
  process.exit(1);
}

console.log('Καμία επιφάνεια δεν ρωτάει τον κατάλογο φωτογραφιών με σκέτο id.');
