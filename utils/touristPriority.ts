import type { Beach } from '../types';

/**
 * Curated national recognition scores for iconic beaches (approved list, 2026-06-12).
 * Keyed by FROZEN beach id (ids are stable source fields since scripts/freezeBeachIds.mjs) —
 * id keying avoids the same-name trap of the old name-keyed map, where cross-island
 * namesakes (Kolymbithres, Mylos, Agios Pavlos...) would all inherit the recognition.
 *
 * Zones: 100-95 nationally emblematic · 90-80 strong icons · 75-65 well known.
 * Used ONLY as an ordering tiebreak (compareRecommendationPriority, trusted top picks,
 * home card ordering) — never in eligibility predicates: famous does not mean tourist-ready.
 *
 * popularityScore and rating are synthetic (deterministic hashes of the beach id, see
 * buildBeachRegionData.mjs) and must never influence ranking.
 */
const ICONIC_BEACH_RECOGNITION: Record<number, number> = {
  // — Nationally emblematic (100-95)
  1208: 100, // Navagio / Shipwreck (Zakynthos)
  1922: 100, // Sarakiniko (Milos)
  593: 99,   // Balos (Chania)
  3000: 98,  // Kleftiko (Milos)
  1171: 97,  // Porto Katsiki (Lefkada)
  1916: 96,  // Papafragkas (Milos)
  1113: 96,  // Myrtos (Kefalonia)
  1608: 96,  // Voidokilia (Messinia)
  2062: 95,  // Kokkini / Red beach (Santorini)
  576: 95,   // Seitan Limania (Chania)
  // — Strong icons (90-80)
  1927: 94,  // Fyriplaka (Milos)
  1925: 94,  // Tsigkrado (Milos)
  1915: 92,  // Palaiochori (Milos)
  1159: 90,  // Egkremni (Lefkada)
  2629: 90,  // Lalaria (Skiathos)
  1929: 90,  // Fyropotamos (Milos)
  1068: 88,  // Fteri (Kefalonia)
  1013: 88,  // Porto Timoni (Corfu)
  965: 88,   // Canal d'Amour (Corfu)
  3004: 88,  // Giola (Thassos)
  704: 88,   // Preveli (Rethymno)
  1901: 88,  // Agia Kyriaki (Milos)
  850: 86,   // Saliara / Marble beach (Thassos)
  1307: 86,  // Seychelles (Ikaria)
  1932: 86,  // Pollonia (Milos)
  604: 85,   // Kedrodasos (Chania)
  1888: 85,  // Kolona (Kythnos)
  1920: 85,  // Provatas (Milos)
  1692: 84,  // Achla (Andros)
  1725: 84,  // Tis Grias to Pidima (Andros)
  1657: 84,  // Agia Anna (Amorgos)
  1903: 84,  // Achivadolimni (Milos)
  1987: 82,  // Alyko (Naxos)
  621: 82,   // Agiofarango (Heraklion)
  1263: 82,  // Mavra Volia (Chios)
  2721: 82,  // Fakistra (Pelion)
  1302: 82,  // Nas (Ikaria)
  711: 82,   // Agios Pavlos / Finikidia (Rethymno)
  1167: 82,  // Mylos (Lefkada)
  1919: 82,  // Plathiena (Milos)
  311: 80,   // Chiliadou (Evia)
  1746: 80,  // Katergo (Folegandros)
  2019: 80,  // Hawaii (Naxos)
  1644: 80,  // Foneas (Mani/Messinia)
  1230: 80,  // Gidaki (Ithaca)
  2063: 80,  // Levki / White beach (Santorini)
  615: 80,   // Sarakiniko (Gavdos)
  1014: 80,  // Rovinia (Corfu)
  // — Well known (75-65)
  22: 75,    // Limanakia Vouliagmenis (Attica)
  1404: 75,  // Megalo Sitani (Samos)
  2189: 75,  // Kedros (Donousa)
  490: 75,   // Karydi (Halkidiki)
  1977: 72,  // Fokos (Mykonos)
  1407: 72,  // Mikro Sitani (Samos)
  2403: 72,  // Psili Ammos (Patmos)
  2134: 72,  // Grammata (Syros)
  1664: 72,  // Mouros (Amorgos)
  3002: 70,  // Gala (Koufonisia)
  3003: 70,  // Pisina (Koufonisia)
  2169: 70,  // Livada (Tinos)
  1684: 68,  // Roukounas (Anafi)
  2179: 68,  // Pachia Ammos (Tinos)
  687: 68,   // Mikri Triopetra (Rethymno)
  489: 68,   // Mikro Karydi (Halkidiki)
};

export const getBeachTouristRecognitionScore = (
  beach: Pick<Beach, 'id'>
): number => ICONIC_BEACH_RECOGNITION[beach.id] || 0;
