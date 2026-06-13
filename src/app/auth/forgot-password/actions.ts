"use server";

import { createClient } from "@/lib/supabase/server";

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

  const supabase = await createClient();
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
