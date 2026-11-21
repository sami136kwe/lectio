import { z } from "zod";

/**
 * Environment variables, validated with Zod. Public values are inlined by
 * Next.js at build time; server values must never be imported from client code.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
  LECTIO_WRITER_MODEL: z.string().min(3).default("claude-sonnet-5-5"),
  LECTIO_CHECKER_MODEL: z.string().min(3).default("claude-sonnet-5-5"),
  MAX_BUDGET_USD: z.coerce.number().positive().default(10),
  EMBEDDING_FUNCTION_URL: z.url().optional(),
  /** Local Kokoro TTS server (npm run tts:kokoro), e.g. http://127.0.0.1:8788 */
  KOKORO_URL: z.url().optional(),
  EMBEDDING_FUNCTION_SECRET: z.string().min(8).optional(),
  ADMIN_EMAILS: z.string().default(""),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema> & PublicEnv;

export function publicEnv(): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
  });
}

let cachedServerEnv: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  if (cachedServerEnv) return cachedServerEnv;
  const raw = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  cachedServerEnv = { ...publicEnv(), ...serverSchema.parse(raw) };
  return cachedServerEnv;
}

export function adminEmails(): string[] {
  return serverEnv()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
