export type FavoriteCoin = {
  symbol: string;
  name: string;
  added_at?: string;
};

const STORAGE_KEY = "crypto-bubbles-favorites";

function safeParse(raw: string | null): FavoriteCoin[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as FavoriteCoin[];
    return [];
  } catch {
    return [];
  }
}

export function loadLocalFavorites(): FavoriteCoin[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function saveLocalFavorites(favs: FavoriteCoin[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

export async function fetchFavoritesFromApi(): Promise<FavoriteCoin[]> {
  const res = await fetch("/api/favorites", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Favorites API failed with ${res.status}`);
  }
  const data = (await res.json()) as FavoriteCoin[];
  return data;
}

export async function addFavoriteToApi(fav: FavoriteCoin) {
  await fetch("/api/favorites", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(fav),
  });
}

export async function removeFavoriteFromApi(symbol: string) {
  const url = `/api/favorites?symbol=${encodeURIComponent(symbol)}`;
  await fetch(url, { method: "DELETE" });
}
