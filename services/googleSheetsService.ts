
import { Island, WindDirection, Accessibility } from "../types";

const SHEET_ID = '1tzX2rrnxWzdf50Hpbbi70gT6DWtQbvil5q2785BUB4A';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

const parseWindDirections = (dirStr: string): WindDirection[] => {
    if (!dirStr) return [WindDirection.N, WindDirection.NE, WindDirection.NW];
    const directions: WindDirection[] = [];
    const lower = dirStr.toLowerCase();
    if (lower.includes('n') || lower.includes('β')) directions.push(WindDirection.N);
    if (lower.includes('s') || lower.includes('ν')) directions.push(WindDirection.S);
    if (lower.includes('e') || lower.includes('α')) directions.push(WindDirection.E);
    if (lower.includes('w') || lower.includes('δ')) directions.push(WindDirection.W);
    if (lower.includes('ne') || lower.includes('βα')) directions.push(WindDirection.NE);
    if (lower.includes('nw') || lower.includes('βδ')) directions.push(WindDirection.NW);
    if (lower.includes('se') || lower.includes('να')) directions.push(WindDirection.SE);
    if (lower.includes('sw') || lower.includes('νδ')) directions.push(WindDirection.SW);
    return directions.length > 0 ? directions : [WindDirection.N, WindDirection.NE, WindDirection.NW];
};

// Helper for deterministic values based on ID
const getDeterministicValue = (id: number | string, seed: string): number => {
    const str = `${id}-${seed}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 1000) / 1000;
};

export const fetchIslandsDirectlyFromSheets = async (): Promise<Island[]> => {
    try {
        const response = await fetch(CSV_URL, {
            mode: 'cors',
            credentials: 'omit',
            referrerPolicy: 'no-referrer'
        });
        
        if (!response.ok) throw new Error(`Sheet fetch failed: ${response.status}`);

        const csvData = await response.text();
        if (csvData.trim().startsWith('<!DOCTYPE html>')) throw new Error("CORS or Authentication error");

        const lines = csvData.split(/\r?\n/).slice(1).filter(line => line.trim().length > 0);
        const islandsMap: Record<string, Island> = {};

        lines.forEach((line, index) => {
            const columns = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
            const [region, subRegion, beachName, latStr, lonStr, protection] = columns;

            if (!region || !subRegion || !beachName || !latStr || !lonStr) return;

            const lat = parseFloat(latStr);
            const lon = parseFloat(lonStr);
            if (isNaN(lat) || isNaN(lon)) return;

            const islandId = subRegion.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

            if (!islandsMap[islandId]) {
                islandsMap[islandId] = {
                    id: islandId,
                    name: { en: subRegion, gr: subRegion, fr: subRegion, de: subRegion, it: subRegion },
                    group: region.toLowerCase() as any,
                    coordinates: { lat, lon },
                    beaches: []
                };
            }

            const beachId = 10000 + index;
            const isDeep = getDeterministicValue(beachId, 'depth') > 0.5;

            islandsMap[islandId].beaches.push({
                id: beachId,
                rating: 4.0 + (getDeterministicValue(beachId, 'rating') * 1.0),
                name: { en: beachName, gr: beachName, fr: beachName, de: beachName, it: beachName },
                description: { en: 'Coastal destination.', gr: 'Παραθαλάσσιος προορισμός.', fr: 'Destination plage.', de: 'Strandziel.', it: 'Destinazione mare.' },
                protectedFrom: parseWindDirections(protection),
                accessibility: Accessibility.EASY,
                beachType: getDeterministicValue(beachId, 'type') > 0.7 ? 'pebbles' : 'sandy',
                amenities: { 
                    organized: getDeterministicValue(beachId, 'organized') > 0.5, 
                    naturalShade: getDeterministicValue(beachId, 'shade') > 0.5, 
                    taverna: getDeterministicValue(beachId, 'taverna') > 0.5,
                    beachBar: getDeterministicValue(beachId, 'beachBar') > 0.5,
                    sunbeds: getDeterministicValue(beachId, 'sunbeds') > 0.5,
                    restaurant: getDeterministicValue(beachId, 'restaurant') > 0.5,
                    parking: getDeterministicValue(beachId, 'parking') > 0.5
                },
                characteristics: { deepWaters: isDeep, shallowWaters: !isDeep },
                waterDepth: isDeep ? 'deep' : 'shallow',
                activities: {
                    snorkeling: getDeterministicValue(beachId, 'snorkeling') > 0.5,
                    surfing: getDeterministicValue(beachId, 'surfing') > 0.8
                },
                environment: {
                    quiet: getDeterministicValue(beachId, 'quiet') > 0.5,
                    remote: getDeterministicValue(beachId, 'remote') > 0.7,
                    familyFriendly: getDeterministicValue(beachId, 'family') > 0.4
                },
                popularityScore: Math.floor(getDeterministicValue(beachId, 'popularity') * 100),
                coordinates: { lat, lon }
            });
        });

        return Object.values(islandsMap);
    } catch (e) {
        console.error("Sheets fetch failed:", e);
        throw e;
    }
};
