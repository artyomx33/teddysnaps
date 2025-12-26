import "server-only";

/**
 * Returns the public base URL for building absolute redirect/webhook URLs.
 *
 * In production we MUST NOT fall back to localhost, because Mollie cannot
 * reach it (webhook) and users cannot be redirected back correctly.
 */
export function getBaseUrl(): string {
  const explicit =
    process.env.NEXT_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL;

  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel =
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL;

  if (vercel) return `https://${vercel}`.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing NEXT_PUBLIC_URL (or VERCEL_URL). Refusing to build Mollie redirect/webhook URLs with localhost in production."
    );
  }

  return "http://localhost:3000";
}



