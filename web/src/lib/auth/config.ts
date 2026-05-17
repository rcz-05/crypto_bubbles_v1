export const AUTH_SECRET_MIN_LENGTH = 32;

export type AuthEnvironmentStatus = {
  production: boolean;
  ready: boolean;
  authSecret: {
    ready: boolean;
    requiredLength: number;
    configuredLength: number;
  };
  database: {
    ready: boolean;
    provider: "kv" | "memory";
  };
};

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function authSecretConfigured(): boolean {
  return (process.env.AUTH_SECRET?.length ?? 0) >= AUTH_SECRET_MIN_LENGTH;
}

/**
 * Accounts persist in the project's Upstash KV/Redis (the same store already
 * used for telemetry). Configured iff the REST credentials are present.
 */
export function kvConfigured(): boolean {
  return (
    Boolean(process.env.KV_REST_API_URL) &&
    Boolean(process.env.KV_REST_API_TOKEN)
  );
}

export function authEnvironmentStatus(): AuthEnvironmentStatus {
  const production = isProductionRuntime();
  const authSecretReady = authSecretConfigured();
  const dbReady = kvConfigured();

  return {
    production,
    ready: production ? authSecretReady && dbReady : true,
    authSecret: {
      ready: authSecretReady,
      requiredLength: AUTH_SECRET_MIN_LENGTH,
      configuredLength: process.env.AUTH_SECRET?.length ?? 0,
    },
    database: {
      ready: dbReady,
      provider: dbReady ? "kv" : "memory",
    },
  };
}
