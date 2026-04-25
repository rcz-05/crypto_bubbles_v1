/**
 * Same Upstash REST client used by the web app, vendored here so admin/
 * can deploy as an independent Vercel project.
 */

type RedisCommand = string | number;

const REQUEST_TIMEOUT_MS = 4_000;

function getCreds() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

async function execute(command: RedisCommand[]): Promise<unknown> {
  const creds = getCreds();
  if (!creds) {
    throw new Error("KV_REST_API_URL or KV_REST_API_TOKEN missing");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(creds.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`KV ${command[0]} failed: HTTP ${res.status}`);
    }

    const json = (await res.json()) as { result: unknown; error?: string };
    if (json.error) throw new Error(`KV ${command[0]} error: ${json.error}`);
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function lpush(key: string, ...values: string[]): Promise<number> {
  const result = await execute(["LPUSH", key, ...values]);
  return typeof result === "number" ? result : 0;
}

export async function ltrim(
  key: string,
  start: number,
  stop: number,
): Promise<void> {
  await execute(["LTRIM", key, start, stop]);
}

export async function lrange(
  key: string,
  start: number,
  stop: number,
): Promise<string[]> {
  const result = await execute(["LRANGE", key, start, stop]);
  return Array.isArray(result) ? (result as string[]) : [];
}

export async function llen(key: string): Promise<number> {
  const result = await execute(["LLEN", key]);
  return typeof result === "number" ? result : 0;
}

export async function del(...keys: string[]): Promise<number> {
  const result = await execute(["DEL", ...keys]);
  return typeof result === "number" ? result : 0;
}

export async function set(key: string, value: string): Promise<void> {
  await execute(["SET", key, value]);
}

export async function get(key: string): Promise<string | null> {
  const result = await execute(["GET", key]);
  return typeof result === "string" ? result : null;
}

export function kvAvailable(): boolean {
  return getCreds() != null;
}
