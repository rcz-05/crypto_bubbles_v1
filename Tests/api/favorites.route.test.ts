import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadFavoritesRoute({
  hasDb = false,
  sqlMock,
}: {
  hasDb?: boolean;
  sqlMock?: ReturnType<typeof vi.fn>;
} = {}) {
  vi.resetModules();

  delete process.env.POSTGRES_URL;
  delete process.env.POSTGRES_PRISMA_URL;
  delete process.env.POSTGRES_USER;

  if (hasDb) {
    process.env.POSTGRES_URL = "postgres://test";
  }

  vi.doMock("@vercel/postgres", () => ({
    sql: sqlMock ?? vi.fn(async () => ({ rows: [] })),
  }));

  return import("../../web/src/app/api/favorites/route");
}

describe("/api/favorites", () => {
  afterEach(() => {
    delete process.env.POSTGRES_URL;
    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_USER;
  });

  beforeEach(() => {
    vi.resetModules();
  });

  it("supports CRUD in the in-memory fallback path", async () => {
    const { GET, POST, DELETE } = await loadFavoritesRoute();

    await expect((await GET()).json()).resolves.toEqual([]);

    const create = await POST(
      new Request("http://localhost/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "btc", name: "Bitcoin" }),
      }),
    );

    expect(create.status).toBe(201);
    await expect((await create.json()).ok).toBe(true);

    const listAfterCreate = await (await GET()).json();
    expect(listAfterCreate).toHaveLength(1);
    expect(listAfterCreate[0]).toMatchObject({
      symbol: "btc",
      name: "Bitcoin",
    });

    const deleteResponse = await DELETE(
      new Request("http://localhost/api/favorites?symbol=btc", {
        method: "DELETE",
      }),
    );
    expect(deleteResponse.status).toBe(200);
    await expect((await DELETE(new Request("http://localhost/api/favorites?symbol=btc"))).json()).resolves.toEqual({
      ok: true,
    });
    await expect((await GET()).json()).resolves.toEqual([]);
  });

  it("validates required request data", async () => {
    const { POST, DELETE } = await loadFavoritesRoute();

    const badPost = await POST(
      new Request("http://localhost/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "btc" }),
      }),
    );
    expect(badPost.status).toBe(400);
    await expect(badPost.json()).resolves.toEqual({
      error: "symbol and name required",
    });

    const badDelete = await DELETE(new Request("http://localhost/api/favorites"));
    expect(badDelete.status).toBe(400);
    await expect(badDelete.json()).resolves.toEqual({
      error: "symbol required",
    });
  });

  it("uses the Postgres path when connection env vars are present", async () => {
    const rows = [
      {
        symbol: "eth",
        name: "Ethereum",
        added_at: "2026-03-16T12:00:00.000Z",
      },
    ];

    const sqlMock = vi.fn(async (strings: TemplateStringsArray) => {
      const query = strings.join(" ");
      if (query.includes("SELECT")) {
        return { rows };
      }
      return { rows: [] };
    });

    const { GET, POST, DELETE } = await loadFavoritesRoute({ hasDb: true, sqlMock });

    const getResponse = await GET();
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual(rows);

    const postResponse = await POST(
      new Request("http://localhost/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "eth", name: "Ethereum" }),
      }),
    );
    expect(postResponse.status).toBe(201);

    const deleteResponse = await DELETE(
      new Request("http://localhost/api/favorites?symbol=eth", {
        method: "DELETE",
      }),
    );
    expect(deleteResponse.status).toBe(200);

    const queries = sqlMock.mock.calls.map(([strings]) => strings.join(" "));
    expect(queries.some((query) => query.includes("CREATE TABLE IF NOT EXISTS favorite_coins"))).toBe(true);
    expect(queries.some((query) => query.includes("SELECT symbol, name, added_at FROM favorite_coins"))).toBe(true);
    expect(queries.some((query) => query.includes("INSERT INTO favorite_coins"))).toBe(true);
    expect(queries.some((query) => query.includes("DELETE FROM favorite_coins"))).toBe(true);
  });
});
