/**
 * Supabase/PostgREST is inconsistent about whether a foreign-key-joined relation
 * comes back as an object or a single-element array. This normalizes either to
 * the underlying object (or null).
 */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
