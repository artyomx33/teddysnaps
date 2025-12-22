import { z } from 'zod';

/**
 * Environment validation - NO FALLBACKS
 * If env vars are missing, the app CRASHES so we can fix it.
 */

const envSchema = z.object({
  // Public - Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),

  // Public - App
  NEXT_PUBLIC_URL: z.string().url('NEXT_PUBLIC_URL must be a valid URL'),

  // Server-only - Supabase
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),

  // Server-only - Mollie Payments
  MOLLIE_API_KEY: z
    .string()
    .refine(
      (val) => val.startsWith('live_') || val.startsWith('test_'),
      'MOLLIE_API_KEY must start with "live_" or "test_"'
    ),

  // Optional but validated if present
  MOLLIE_PROFILE_ID: z.string().optional(),
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
});

// Type for the validated environment
export type Env = z.infer<typeof envSchema>;

// Validate and export
// This will CRASH if validation fails - NO FALLBACKS
function getEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.format());
    throw new Error(
      `Missing or invalid environment variables:\n${result.error.issues
        .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n')}`
    );
  }

  return result.data;
}

export const env = getEnv();
