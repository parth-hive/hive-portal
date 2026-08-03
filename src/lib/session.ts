import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
};

// Identity from the request's JWT, verified locally via getClaims — the
// project uses asymmetric signing keys, so unlike getUser this makes no
// auth-server round trip. cache() dedupes across the layout's session slots
// and the page within a single request.
//
// Use this for identity/access checks. Flows that need the fresh,
// server-confirmed user record (e.g. auth.updateUser) should still call
// supabase.auth.getUser().
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) return null;
  return {
    id: claims.sub,
    email: claims.email ?? null,
    user_metadata: claims.user_metadata ?? {},
  };
});
