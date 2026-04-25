export const ADMIN_COOKIE = "coincanvas-admin-auth";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

export function getAdminKey(): string | null {
  return process.env.ADMIN_KEY ?? null;
}

export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
