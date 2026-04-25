const TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 128;
const REQUEST_TIMEOUT_MS = 10_000;

export type CuratedLink = {
  url: string;
  label: string;
  kind: "primary" | "community" | "code" | "secondary";
  trust: "high" | "medium" | "community";
};

export type CoinDetailPayload = {
  links: CuratedLink[];
  community: {
    sentimentUpPct: number | null;
    twitterFollowers: number | null;
    redditSubscribers: number | null;
  };
  developer: {
    forks: number | null;
    stars: number | null;
    pullRequestsMerged: number | null;
  };
  isFallback: boolean;
};

type CacheEntry = {
  data: CoinDetailPayload;
  timestamp: number;
};

const cache = new Map<string, CacheEntry>();

function pruneCache(now: number) {
  for (const [k, v] of cache.entries()) {
    if (now - v.timestamp >= TTL_MS) cache.delete(k);
  }
  if (cache.size > MAX_ENTRIES) {
    const overflow = cache.size - MAX_ENTRIES;
    const keys = Array.from(cache.keys()).slice(0, overflow);
    for (const k of keys) cache.delete(k);
  }
}

type CoinGeckoLinks = {
  homepage?: string[];
  whitepaper?: string;
  subreddit_url?: string;
  twitter_screen_name?: string;
  repos_url?: { github?: string[] };
  blockchain_site?: string[];
};

type CoinGeckoCommunity = {
  twitter_followers?: number | null;
  reddit_subscribers?: number | null;
};

type CoinGeckoDeveloper = {
  forks?: number | null;
  stars?: number | null;
  pull_requests_merged?: number | null;
};

type CoinGeckoDetail = {
  links?: CoinGeckoLinks;
  community_data?: CoinGeckoCommunity;
  developer_data?: CoinGeckoDeveloper;
  sentiment_votes_up_percentage?: number | null;
};

function pickFirst(values?: string[]): string | null {
  if (!values || !values.length) return null;
  for (const v of values) {
    if (v && v.trim().length > 0) return v.trim();
  }
  return null;
}

function curateLinks(links: CoinGeckoLinks | undefined): CuratedLink[] {
  if (!links) return [];
  const out: CuratedLink[] = [];

  const homepage = pickFirst(links.homepage);
  if (homepage) {
    out.push({
      url: homepage,
      label: "Official site",
      kind: "primary",
      trust: "high",
    });
  }

  if (links.whitepaper && links.whitepaper.trim().length > 0) {
    out.push({
      url: links.whitepaper.trim(),
      label: "Whitepaper",
      kind: "primary",
      trust: "high",
    });
  }

  const github = pickFirst(links.repos_url?.github);
  if (github) {
    out.push({
      url: github,
      label: "GitHub repository",
      kind: "code",
      trust: "high",
    });
  }

  if (links.subreddit_url && links.subreddit_url.trim().length > 0) {
    out.push({
      url: links.subreddit_url.trim(),
      label: "Reddit community",
      kind: "community",
      trust: "community",
    });
  }

  if (links.twitter_screen_name) {
    out.push({
      url: `https://twitter.com/${links.twitter_screen_name}`,
      label: `@${links.twitter_screen_name}`,
      kind: "community",
      trust: "community",
    });
  }

  const explorer = pickFirst(links.blockchain_site);
  if (explorer && out.length < 5) {
    out.push({
      url: explorer,
      label: "Block explorer",
      kind: "secondary",
      trust: "medium",
    });
  }

  return out.slice(0, 5);
}

function fallbackPayload(coinId: string): CoinDetailPayload {
  return {
    links: [
      {
        url: `https://www.coingecko.com/en/coins/${coinId}`,
        label: "CoinGecko coin page",
        kind: "primary",
        trust: "medium",
      },
    ],
    community: {
      sentimentUpPct: null,
      twitterFollowers: null,
      redditSubscribers: null,
    },
    developer: {
      forks: null,
      stars: null,
      pullRequestsMerged: null,
    },
    isFallback: true,
  };
}

async function fetchDetailRaw(coinId: string): Promise<CoinDetailPayload> {
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&market_data=false&community_data=true&developer_data=true&sparkline=false`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "CoinCanvas/1.0 (+vercel.app)" },
      cache: "no-store",
    });

    if (!res.ok) return fallbackPayload(coinId);

    const data = (await res.json()) as CoinGeckoDetail;
    return {
      links: curateLinks(data.links),
      community: {
        sentimentUpPct:
          typeof data.sentiment_votes_up_percentage === "number"
            ? data.sentiment_votes_up_percentage
            : null,
        twitterFollowers: data.community_data?.twitter_followers ?? null,
        redditSubscribers: data.community_data?.reddit_subscribers ?? null,
      },
      developer: {
        forks: data.developer_data?.forks ?? null,
        stars: data.developer_data?.stars ?? null,
        pullRequestsMerged: data.developer_data?.pull_requests_merged ?? null,
      },
      isFallback: false,
    };
  } catch {
    return fallbackPayload(coinId);
  } finally {
    clearTimeout(timeout);
  }
}

export type FetchDetailResult = {
  data: CoinDetailPayload;
  cacheStatus: "hit" | "miss";
};

export async function getCoinDetail(coinId: string): Promise<FetchDetailResult> {
  const now = Date.now();
  pruneCache(now);

  const cached = cache.get(coinId);
  if (cached && now - cached.timestamp < TTL_MS) {
    return { data: cached.data, cacheStatus: "hit" };
  }

  const data = await fetchDetailRaw(coinId);
  cache.set(coinId, { data, timestamp: now });
  return { data, cacheStatus: "miss" };
}
