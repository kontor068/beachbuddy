import legalData from '../data/legalContent.json';
import { LanguageCode } from '../types';

// Single source of truth for the Terms of Use, Privacy Policy and Cookie Policy.
// The same JSON feeds the in-app modals (components/LegalFooter.tsx) AND the static
// crawlable pages (public/{terms,privacy,cookies}/index.html via scripts/buildLegalPages.mjs),
// so the two surfaces can never drift apart. Greek is authoritative; every non-Greek UI
// language shows the English courtesy translation.

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

interface LegalContent {
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
  docs: Record<LegalKind, { gr: LegalDoc; en: LegalDoc }>;
}

const LEGAL = legalData as unknown as LegalContent;

export const LEGAL_VERSION = LEGAL.version;
export const LEGAL_UPDATED = LEGAL.updated;
export const LEGAL_OPERATOR = LEGAL.operator;

/** All non-Greek UI languages fall back to the English (courtesy) translation. */
export const legalLang = (language: LanguageCode): 'gr' | 'en' => (language === 'gr' ? 'gr' : 'en');

export const getLegalDoc = (kind: LegalKind, language: LanguageCode): LegalDoc =>
  LEGAL.docs[kind][legalLang(language)];

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
