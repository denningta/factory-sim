import { z } from 'zod';

// Must match .env.example: shipping with this value would make sessions forgeable.
const SECRET_PLACEHOLDER = 'change-me-to-a-long-random-string';

const envSchema = z.object({
  // Unset means "use the default"; an empty or non-numeric value is a misconfiguration.
  PORT: z
    .string()
    .regex(/^\d+$/, 'must be a whole number')
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535))
    .default(8080),
  DATABASE_URL: z.string().min(1, 'is required'),
  SESSION_SECRET: z
    .string()
    .min(1, 'is required')
    .refine((v) => v !== SECRET_PLACEHOLDER, 'is still the .env.example placeholder; set a long random value'),
});

export interface AppEnv {
  port: number;
  databaseUrl: string;
  sessionSecret: string;
}

/** Validates the process environment, throwing one readable message listing every problem. */
export function loadEnv(env: Record<string, string | undefined>): AppEnv {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  ${String(i.path[0])}: ${i.message}`);
    throw new Error(`Invalid configuration:\n${problems.join('\n')}`);
  }
  const { PORT, DATABASE_URL, SESSION_SECRET } = result.data;
  return { port: PORT, databaseUrl: DATABASE_URL, sessionSecret: SESSION_SECRET };
}
