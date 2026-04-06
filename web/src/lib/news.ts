import type { Coin } from "@/lib/coingecko";

export type NewsProvider = "gnews" | "newsapi" | "alphavantage";

export type NewsArticle = {
  title: string;
  description: string;
  url: string;
  image: string | null;
  publishedAt: string;
  source: string;
  provider: NewsProvider;
};

export type CoinNews = {
  coin: Pick<Coin, "id" | "symbol" | "name">;
  provider: NewsProvider;
  query: string;
  fetchedAt: string;
  articles: NewsArticle[];
};

export type NewsSearchParams = {
  coin: Pick<Coin, "id" | "symbol" | "name">;
  provider?: NewsProvider;
  language?: string;
  limit?: number;
};

const DEFAULT_LANGUAGE = "en";
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const PROVIDER_ORDER: NewsProvider[] = ["gnews", "newsapi", "alphavantage"];

type GNewsArticle = {
  title?: string;
  description?: string;
  url?: string;
  image?: string | null;
  publishedAt?: string;
  source?: {
    name?: string;
    url?: string;
  };
};

type NewsApiArticle = {
  title?: string;
  description?: string;
  url?: string;
  urlToImage?: string | null;
  publishedAt?: string;
  source?: {
    name?: string;
  };
};

type AlphaVantageArticle = {
  title?: string;
  summary?: string;
  url?: string;
  banner_image?: string | null;
  time_published?: string;
  source?: string;
};

function normalizeLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(limit)));
}

function normalizeLanguage(language?: string) {
  if (!language?.trim()) return DEFAULT_LANGUAGE;
  return language.trim().toLowerCase();
}

function buildSearchQuery(coin: Pick<Coin, "name" | "symbol">) {
  const symbol = coin.symbol.trim().toUpperCase();
  const name = coin.name.trim();

  return `("${name}" OR "${symbol}") AND (crypto OR cryptocurrency OR blockchain)`;
}

function parseAlphaVantageTimestamp(value?: string) {
  if (!value) return new Date().toISOString();

  const match = value.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/,
  );

  if (!match) return new Date(value).toISOString();

  const [, year, month, day, hour, minute, second = "00"] = match;
  return new Date(
    `${year}-${month}-${day}T${hour}:${minute}:${second}Z`,
  ).toISOString();
}

function normalizeGNewsArticles(articles: GNewsArticle[]): NewsArticle[] {
  return articles
    .filter((article): article is Required<Pick<GNewsArticle, "title" | "url">> & GNewsArticle =>
      Boolean(article.title && article.url),
    )
    .map((article) => ({
      title: article.title!,
      description: article.description ?? "",
      url: article.url!,
      image: article.image ?? null,
      publishedAt: article.publishedAt ?? new Date().toISOString(),
      source: article.source?.name ?? "Unknown source",
      provider: "gnews" as const,
    }));
}

function normalizeNewsApiArticles(articles: NewsApiArticle[]): NewsArticle[] {
  return articles
    .filter((article): article is Required<Pick<NewsApiArticle, "title" | "url">> & NewsApiArticle =>
      Boolean(article.title && article.url),
    )
    .map((article) => ({
      title: article.title!,
      description: article.description ?? "",
      url: article.url!,
      image: article.urlToImage ?? null,
      publishedAt: article.publishedAt ?? new Date().toISOString(),
      source: article.source?.name ?? "Unknown source",
      provider: "newsapi" as const,
    }));
}

function normalizeAlphaVantageArticles(
  articles: AlphaVantageArticle[],
): NewsArticle[] {
  return articles
    .filter(
      (
        article,
      ): article is Required<Pick<AlphaVantageArticle, "title" | "url">> &
        AlphaVantageArticle => Boolean(article.title && article.url),
    )
    .map((article) => ({
      title: article.title!,
      description: article.summary ?? "",
      url: article.url!,
      image: article.banner_image ?? null,
      publishedAt: parseAlphaVantageTimestamp(article.time_published),
      source: article.source ?? "Unknown source",
      provider: "alphavantage" as const,
    }));
}

async function fetchJson(url: URL | string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`News provider failed with ${response.status}${body ? `: ${body}` : ""}`);
  }

  return response.json();
}

async function fetchFromGNews(params: {
  coin: Pick<Coin, "id" | "symbol" | "name">;
  language: string;
  limit: number;
  apiKey: string;
}): Promise<CoinNews> {
  const query = buildSearchQuery(params.coin);
  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("q", query);
  url.searchParams.set("lang", params.language);
  url.searchParams.set("max", String(params.limit));
  url.searchParams.set("apikey", params.apiKey);

  const payload = (await fetchJson(url)) as {
    articles?: GNewsArticle[];
  };

  return {
    coin: params.coin,
    provider: "gnews",
    query,
    fetchedAt: new Date().toISOString(),
    articles: normalizeGNewsArticles(payload.articles ?? []),
  };
}

async function fetchFromNewsApi(params: {
  coin: Pick<Coin, "id" | "symbol" | "name">;
  language: string;
  limit: number;
  apiKey: string;
}): Promise<CoinNews> {
  const query = buildSearchQuery(params.coin);
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", query);
  url.searchParams.set("language", params.language);
  url.searchParams.set("pageSize", String(params.limit));
  url.searchParams.set("sortBy", "publishedAt");

  const payload = (await fetchJson(url, {
    headers: {
      "X-Api-Key": params.apiKey,
    },
  })) as {
    articles?: NewsApiArticle[];
  };

  return {
    coin: params.coin,
    provider: "newsapi",
    query,
    fetchedAt: new Date().toISOString(),
    articles: normalizeNewsApiArticles(payload.articles ?? []),
  };
}

async function fetchFromAlphaVantage(params: {
  coin: Pick<Coin, "id" | "symbol" | "name">;
  limit: number;
  apiKey: string;
}): Promise<CoinNews> {
  const symbol = params.coin.symbol.trim().toUpperCase();
  const url = new URL("https://www.alphavantage.co/query");
  url.searchParams.set("function", "NEWS_SENTIMENT");
  url.searchParams.set("tickers", `CRYPTO:${symbol}`);
  url.searchParams.set("topics", "blockchain");
  url.searchParams.set("sort", "LATEST");
  url.searchParams.set("limit", String(params.limit));
  url.searchParams.set("apikey", params.apiKey);

  const payload = (await fetchJson(url)) as {
    feed?: AlphaVantageArticle[];
    Information?: string;
    Note?: string;
  };

  if (payload.Information || payload.Note) {
    throw new Error(payload.Information ?? payload.Note ?? "Alpha Vantage rejected the request");
  }

  return {
    coin: params.coin,
    provider: "alphavantage",
    query: `CRYPTO:${symbol} + blockchain`,
    fetchedAt: new Date().toISOString(),
    articles: normalizeAlphaVantageArticles(payload.feed ?? []),
  };
}

export function getAvailableNewsProviders(): NewsProvider[] {
  return PROVIDER_ORDER.filter((provider) => {
    switch (provider) {
      case "gnews":
        return Boolean(process.env.GNEWS_API_KEY);
      case "newsapi":
        return Boolean(process.env.NEWSAPI_API_KEY);
      case "alphavantage":
        return Boolean(process.env.ALPHAVANTAGE_API_KEY);
    }
  });
}

export function resolveNewsProvider(
  requestedProvider?: string | null,
): NewsProvider | null {
  const available = getAvailableNewsProviders();
  if (requestedProvider) {
    const normalized = requestedProvider.trim().toLowerCase();
    if (
      normalized === "gnews" ||
      normalized === "newsapi" ||
      normalized === "alphavantage"
    ) {
      return available.includes(normalized) ? normalized : null;
    }
    return null;
  }

  const envPreferred = process.env.NEWS_PROVIDER?.trim().toLowerCase();
  if (
    envPreferred &&
    (envPreferred === "gnews" ||
      envPreferred === "newsapi" ||
      envPreferred === "alphavantage") &&
    available.includes(envPreferred)
  ) {
    return envPreferred;
  }

  return available[0] ?? null;
}

export async function fetchRelevantNews(
  params: NewsSearchParams,
): Promise<CoinNews> {
  const provider = params.provider ?? resolveNewsProvider();
  const language = normalizeLanguage(params.language);
  const limit = normalizeLimit(params.limit);

  if (!provider) {
    throw new Error(
      "No news provider configured. Set GNEWS_API_KEY, NEWSAPI_API_KEY, or ALPHAVANTAGE_API_KEY.",
    );
  }

  switch (provider) {
    case "gnews": {
      const apiKey = process.env.GNEWS_API_KEY;
      if (!apiKey) {
        throw new Error("GNEWS_API_KEY is not configured.");
      }
      return fetchFromGNews({ coin: params.coin, language, limit, apiKey });
    }
    case "newsapi": {
      const apiKey = process.env.NEWSAPI_API_KEY;
      if (!apiKey) {
        throw new Error("NEWSAPI_API_KEY is not configured.");
      }
      return fetchFromNewsApi({ coin: params.coin, language, limit, apiKey });
    }
    case "alphavantage": {
      const apiKey = process.env.ALPHAVANTAGE_API_KEY;
      if (!apiKey) {
        throw new Error("ALPHAVANTAGE_API_KEY is not configured.");
      }
      return fetchFromAlphaVantage({ coin: params.coin, limit, apiKey });
    }
  }
}
