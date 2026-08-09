// What this person has actually given us — and what happened to it.
//
// WHY IT EXISTS. Someone sends a photo of a beach they love, and then nothing:
// no confirmation it arrived, no word when a human looks at it, no way to tell
// whether it was published or thrown away. The upload sheet says "a person
// checks it", which is a promise with no page behind it. This is that page.
//
// It is also the only honest way to show a rejection. Silence reads as "lost",
// and someone who thinks their photo was lost does not send a second one.
//
// READ-ONLY AND OWNER-SCOPED. Row Level Security ("photos: read own" in
// supabase/migrations/0001) already restricts this to the caller's own rows; the
// explicit user_id filter is belt-and-braces, not the boundary.

import { getSupabase, getSupabaseUrl } from './supabaseClient';

/** The public bucket approved copies are moved into — see supabase/migrations/0002. */
const PUBLIC_BUCKET = 'beach-photos-public';

const publicUrlFor = (storagePath: string): string | null => {
  const base = getSupabaseUrl();
  if (!base || !storagePath) return null;
  return `${base}/storage/v1/object/public/${PUBLIC_BUCKET}/${encodeURI(storagePath)}`;
};

export type ContributionStatus = 'pending' | 'approved' | 'rejected';

export interface MyPhoto {
  id: string;
  beachId: number;
  regionId: string;
  status: ContributionStatus;
  caption: string | null;
  /** Only ever set for an approved photo — pending files live in the private bucket. */
  publicUrl: string | null;
  createdAt: string;
}

export interface MyContributions {
  photos: MyPhoto[];
  pending: number;
  approved: number;
  rejected: number;
}

export const EMPTY_CONTRIBUTIONS: MyContributions = { photos: [], pending: 0, approved: 0, rejected: 0 };

export const getMyContributions = async (userId: string | null): Promise<MyContributions> => {
  if (!userId) return EMPTY_CONTRIBUTIONS;

  const client = await getSupabase();
  if (!client) return EMPTY_CONTRIBUTIONS;

  try {
    const { data, error } = await client
      .from('beach_photos')
      .select('id, beach_id, region_id, status, caption, public_path, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(24);

    if (error) {
      console.error('Could not read your photos.', error);
      return EMPTY_CONTRIBUTIONS;
    }

    const photos: MyPhoto[] = (data || []).map((row: {
      id: string;
      beach_id: number;
      region_id: string;
      status: ContributionStatus;
      caption: string | null;
      public_path: string | null;
      created_at: string;
    }) => ({
      id: row.id,
      beachId: Number(row.beach_id),
      regionId: row.region_id,
      status: row.status,
      caption: row.caption,
      publicUrl: row.status === 'approved' && row.public_path ? publicUrlFor(row.public_path) : null,
      createdAt: row.created_at,
    }));

    return {
      photos,
      pending: photos.filter(p => p.status === 'pending').length,
      approved: photos.filter(p => p.status === 'approved').length,
      rejected: photos.filter(p => p.status === 'rejected').length,
    };
  } catch (error) {
    console.error('Could not read your photos.', error);
    return EMPTY_CONTRIBUTIONS;
  }
};
