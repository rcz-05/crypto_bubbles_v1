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
    provider: "vercel-postgres" | "memory";
  };
};

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function authSecretConfigured(): boolean {
  return (process.env.AUTH_SECRET?.length ?? 0) >= AUTH_SECRET_MIN_LENGTH;
}

export function postgresConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL) ||
    Boolean(process.env.POSTGRES_PRISMA_URL) ||
    Boolean(process.env.POSTGRES_USER);
}

export function authEnvironmentStatus(): AuthEnvironmentStatus {
  const production = isProductionRuntime();
  const authSecretReady = authSecretConfigured();
  const dbReady = postgresConfigured();

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
      provider: dbReady ? "vercel-postgres" : "memory",
    },
  };
}
