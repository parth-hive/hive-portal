"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export type ForgotPasswordState = { error?: string; success?: string } | undefined;

export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { error: "Enter a valid email." };
  }

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://hive-portal-1485.vercel.app";

  // Deliberately use a stateless, implicit-flow client to send the reset email.
  // Our shared SSR client (@supabase/ssr) defaults to the PKCE flow, which makes
  // the recovery link redirect back with a `?code=` query param that requires a
  // device-bound code verifier — the reset page reads the hash instead, so PKCE
  // links surface as "missing session tokens" every time (and break entirely on
  // a different device). Implicit flow returns #access_token&refresh_token in the
  // URL hash, which /auth/reset-password already consumes.
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit", persistSession: false } },
  );
  // We deliberately ignore the result: never reveal whether an email is
  // registered, and silently swallow Supabase Auth's email rate limit so it
  // isn't surfaced to end users.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  return {
    success: "If that email has an account, a reset link is on its way.",
  };
}
