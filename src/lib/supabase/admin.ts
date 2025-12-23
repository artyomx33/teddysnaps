import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  // IMPORTANT: do not import env validation here. Vercel builds may fail if env vars
  // are missing/invalid during build steps. We validate lazily at runtime instead.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}


