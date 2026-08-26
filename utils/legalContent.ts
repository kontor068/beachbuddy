import legalMeta from '../data/legalMeta.json';
import { LanguageCode } from '../types';

// Single source of truth for the Terms of Use, Privacy Policy and Cookie Policy, in two
// files that never overlap:
//   data/legalMeta.json    — version, dates, operator identity. A few hundred bytes, and
//                            needed on every first paint (footer, consent record, landing).
//   data/legalContent.json — the three documents themselves. ~30 KB gzipped, and needed
//                            only when someone opens a modal — so it is loaded on demand,
//                            not shipped inside `beach-ui` to every visitor (it was, until
//                            26/08/2026: 27 KB of every first paint for text nobody read).
// The same two files feed the static crawlable pages (public/{terms,privacy,cookies}/
// index.html via scripts/buildLegalPages.mjs), so the two surfaces can never drift apart.
// Greek is authoritative; every non-Greek UI language shows the English courtesy translation.

export type LegalKind = 'terms' | 'privacy' | 'cookies';

export type LegalBlock =
  | { p: string }
  | { h: string }
  | { note: string }
  | { ul: string[] }
  | { table: { head: string[]; rows: string[][] } };

export interface LegalDoc {
  title: string;
  blocks: LegalBlock[];
}

interface LegalMeta {
  version: string;
  updated: { gr: string; en: string };
  history?: { version: string; date: string; summary: string }[];
  operator: {
    legalName: string;
    brandName: string;
    addressGr: string;
    addressEn: string;
    afm: string;
    doy: string;
    gemi: string;
    privacyEmail: string;
    contactEmail: string;
    phone: string;
    phoneTel: string;
    website: string;
    dpaUrl: string;
  };
}

type LegalDocs = Record<LegalKind, { gr: LegalDoc; en: LegalDoc }>;

const META = legalMeta as unknown as LegalMeta;

export const LEGAL_VERSION = META.version;
export const LEGAL_UPDATED = META.updated;
export const LEGAL_OPERATOR = META.operator;

/** All non-Greek UI languages fall back to the English (courtesy) translation. */
export const legalLang = (language: LanguageCode): 'gr' | 'en' => (language === 'gr' ? 'gr' : 'en');

let docsPromise: Promise<LegalDocs> | null = null;

/** The document bodies, fetched once per session on the first modal open. */
const loadLegalDocs = (): Promise<LegalDocs> => {
  if (!docsPromise) {
    docsPromise = import('../data/legalContent.json')
      .then(module => module.default as unknown as LegalDocs)
      .catch(error => {
        // Let the next click try again instead of caching the failure for the session.
        docsPromise = null;
        throw error;
      });
  }
  return docsPromise;
};

export const loadLegalDoc = (kind: LegalKind, language: LanguageCode): Promise<LegalDoc> =>
  loadLegalDocs().then(docs => docs[kind][legalLang(language)]);

export const legalLastUpdated = (language: LanguageCode): string =>
  language === 'gr' ? LEGAL_UPDATED.gr : LEGAL_UPDATED.en;

// ---- Inline link tokens ---------------------------------------------------
// Text may embed {privacy}/{cookies}/{terms} (open the sibling doc), {privacyEmail}/
// {contactEmail} (mailto) and {website}/{dpa} (external). The Terms→Privacy link that
// the operator's instructions require lives inside Terms §3 as {privacy}.

type LegalToken = { label: string; modal?: LegalKind; href?: string };

export const getLegalTokens = (language: LanguageCode): Record<string, LegalToken> => {
  const gr = language === 'gr';
  const op = LEGAL_OPERATOR;
  return {
    terms: { label: gr ? 'Όροι Χρήσης' : 'Terms of Use', modal: 'terms' },
    privacy: { label: gr ? 'Πολιτική Απορρήτου' : 'Privacy Policy', modal: 'privacy' },
    cookies: { label: gr ? 'Πολιτική Cookies' : 'Cookie Policy', modal: 'cookies' },
    privacyEmail: { label: op.privacyEmail, href: `mailto:${op.privacyEmail}` },
    contactEmail: { label: op.contactEmail, href: `mailto:${op.contactEmail}` },
    phone: { label: op.phone, href: `tel:${op.phoneTel}` },
    website: { label: op.website, href: `https://${op.website}/` },
    dpa: { label: op.dpaUrl, href: `https://${op.dpaUrl}` },
  };
};

export type LegalSegment =
  | { text: string }
  | { token: string; label: string; modal?: LegalKind; href?: string };

const TOKEN_RE = /\{(terms|privacy|cookies|privacyEmail|contactEmail|phone|website|dpa)\}/g;

/** Split legal text into plain-text and link segments the renderers can lay out. */
export const parseLegalText = (text: string, language: LanguageCode): LegalSegment[] => {
  const tokens = getLegalTokens(language);
  const segments: LegalSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index) });
    const token = tokens[match[1]];
    if (token) {
      segments.push({ token: match[1], label: token.label, modal: token.modal, href: token.href });
    } else {
      segments.push({ text: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) });
  return segments;
};
