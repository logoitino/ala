/**
 * Replaceable media transport for the current upload/playback/cleanup paths.
 * The configured Supabase client keeps the caller's session and server Storage policies authoritative.
 * Bucket/path choices, rights, private entitlement and database writes remain with each feature.
 * @sideEffects Storage upload/sign/list/remove; public URL construction performs no request.
 */
import { supabase } from '@/lib/supabase';

export type MediaStorageResult<T> = { data: T | null; error: { message: string } | null };
export type MediaStorageObject = { id: string | null; name: string };
export type MediaStorageUploadOptions = { contentType: string; upsert: boolean };
export type MediaStorageListOptions = {
  limit: number;
  offset: number;
  sortBy: { column: string; order: 'asc' | 'desc' };
};

/** Transport only: implementations must enforce the caller's existing access rules on their server. */
export interface MediaStorageAdapter {
  /** Empty string means no URL could be built; a public URL never grants private access. */
  publicUrl(bucket: string, path: string): string;
  upload(bucket: string, path: string, body: ArrayBuffer, options: MediaStorageUploadOptions): Promise<MediaStorageResult<null>>;
  sign(bucket: string, path: string, expiresIn: number): Promise<MediaStorageResult<string>>;
  list(bucket: string, prefix: string, options: MediaStorageListOptions): Promise<MediaStorageResult<MediaStorageObject[]>>;
  remove(bucket: string, paths: string[]): Promise<MediaStorageResult<null>>;
}

function result<T>(data: T | null, error: { message: string } | null): MediaStorageResult<T> {
  // No SDK error/status/metadata objects cross the boundary. Existing feature error handling owns the copy.
  return { data: error ? null : data, error: error ? { message: error.message } : null };
}

/** Bind one client without changing its authentication or creating a mutable global provider override. */
export function createSupabaseMediaStorage(client: Pick<typeof supabase, 'storage'>): MediaStorageAdapter {
  return {
    publicUrl(bucket, path) {
      try { return client.storage.from(bucket).getPublicUrl(path).data.publicUrl || ''; }
      catch { return ''; }
    },
    async upload(bucket, path, body, options) {
      const { error } = await client.storage.from(bucket).upload(path, body, options);
      return result(null, error);
    },
    async sign(bucket, path, expiresIn) {
      const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
      return result(data?.signedUrl || null, error);
    },
    async list(bucket, prefix, options) {
      const { data, error } = await client.storage.from(bucket).list(prefix, options);
      return result(Array.isArray(data) ? data.map((file) => ({ id: file.id ?? null, name: file.name })) : null, error);
    },
    async remove(bucket, paths) {
      const { error } = await client.storage.from(bucket).remove(paths);
      return result(null, error);
    },
  };
}

/** The current backend is selected here; features can bind another adapter through pure factories. */
export const mediaStorage: MediaStorageAdapter = createSupabaseMediaStorage(supabase);
