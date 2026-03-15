type FixtureHeadline = {
  title: string;
  source: string;
  publishedAt: string;
  url: string;
};

type FixtureLink = {
  label: string;
  url: string;
  kind: "market" | "official" | "research";
};

export type ContextFixture = {
  updatedAt: string;
  narratives: {
    positive: string;
    negative: string;
    neutral: string;
  };
  evidence: FixtureHeadline[];
  links: FixtureLink[];
};

export const CONTEXT_FIXTURES: Record<string, ContextFixture> = {
  btc: {
    updatedAt: "2026-03-15T14:30:00.000Z",
    narratives: {
      positive:
        "Bitcoin momentum usually becomes easier for beginners to trust when macro risk sentiment and ETF-flow coverage point in the same direction.",
      negative:
        "Bitcoin pullbacks are often driven by macro risk-off headlines, profit taking, and rapid sentiment shifts across the broader crypto market.",
      neutral:
        "Bitcoin often sets the tone for the rest of the board, so even a quieter session is worth reading as market leadership rather than a coin-specific story.",
    },
    evidence: [
      {
        title: "Macro and ETF-flow coverage remain the first signals to review when BTC stretches away from the rest of the market.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T19:00:00.000Z",
        url: "https://www.coingecko.com/en/coins/bitcoin",
      },
      {
        title: "Large-cap BTC moves can still reverse fast when the same narrative is crowded across social, news, and exchange flows.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T19:10:00.000Z",
        url: "https://bitcoin.org/en/",
      },
      {
        title: "Use BTC as a market anchor: if the rest of the board is moving without it, the move is usually thinner and riskier.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T19:20:00.000Z",
        url: "https://www.coingecko.com/en/coins/bitcoin",
      },
    ],
    links: [
      { label: "CoinGecko market page", url: "https://www.coingecko.com/en/coins/bitcoin", kind: "market" },
      { label: "Bitcoin.org", url: "https://bitcoin.org/en/", kind: "official" },
    ],
  },
  eth: {
    updatedAt: "2026-03-15T14:30:00.000Z",
    narratives: {
      positive:
        "Ethereum strength is usually easier to explain through a mix of network activity, staking demand, and policy headlines rather than a single trigger.",
      negative:
        "Ethereum weakness often appears when traders rotate away from higher-beta assets or when fee, staking, or ETF narratives cool all at once.",
      neutral:
        "Ethereum often trades like the bridge between Bitcoin leadership and altcoin risk appetite, so a flat session can still be informative.",
    },
    evidence: [
      {
        title: "ETH context is strongest when you compare price with network activity, staking demand, and policy headlines together.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T18:00:00.000Z",
        url: "https://www.coingecko.com/en/coins/ethereum",
      },
      {
        title: "For beginners, ETH is often the clearest example of why one headline rarely explains the whole move by itself.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T18:10:00.000Z",
        url: "https://ethereum.org/en/",
      },
      {
        title: "If ETH lags BTC during a green day, traders often read that as a sign that market confidence is still selective.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T18:20:00.000Z",
        url: "https://www.coingecko.com/en/coins/ethereum",
      },
    ],
    links: [
      { label: "CoinGecko market page", url: "https://www.coingecko.com/en/coins/ethereum", kind: "market" },
      { label: "Ethereum.org", url: "https://ethereum.org/en/", kind: "official" },
    ],
  },
  sol: {
    updatedAt: "2026-03-15T14:30:00.000Z",
    narratives: {
      positive:
        "Solana rallies usually accelerate when traders chase ecosystem activity and memecoin volume at the same time.",
      negative:
        "Solana drawdowns tend to sharpen quickly when risk appetite fades because the same fast-moving traders also leave quickly.",
      neutral:
        "Solana is often a risk-appetite thermometer: a mixed day here usually means traders are waiting for a stronger catalyst.",
    },
    evidence: [
      {
        title: "SOL momentum often reflects ecosystem activity and speculative volume faster than large-cap macro coins do.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T17:30:00.000Z",
        url: "https://www.coingecko.com/en/coins/solana",
      },
      {
        title: "When SOL runs hot, the next beginner check is whether that energy is broad ecosystem demand or just short-lived rotation.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T17:40:00.000Z",
        url: "https://solana.com/",
      },
      {
        title: "Reliability chatter matters more for SOL than for some peers because network confidence is part of the product story.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T17:50:00.000Z",
        url: "https://solana.com/",
      },
    ],
    links: [
      { label: "CoinGecko market page", url: "https://www.coingecko.com/en/coins/solana", kind: "market" },
      { label: "Solana", url: "https://solana.com/", kind: "official" },
    ],
  },
  xrp: {
    updatedAt: "2026-03-15T14:30:00.000Z",
    narratives: {
      positive:
        "XRP moves usually become credible when market momentum lines up with policy or ecosystem headlines instead of rumor alone.",
      negative:
        "XRP weakness often reflects headline sensitivity, so unclear narratives can unwind fast once traders stop seeing follow-through.",
      neutral:
        "XRP often trades on narrative intensity, which makes source checking more important than on a quieter large-cap asset.",
    },
    evidence: [
      {
        title: "XRP price action is especially sensitive to headline quality, so verified sources matter more than social repetition.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T17:00:00.000Z",
        url: "https://www.coingecko.com/en/coins/xrp",
      },
      {
        title: "For beginners, XRP is a reminder that a fast move can be real while the explanation is still only partially confirmed.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T17:10:00.000Z",
        url: "https://xrpl.org/",
      },
      {
        title: "If XRP is moving harder than BTC and ETH, check whether the move is broad market support or narrative-specific speculation.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T17:20:00.000Z",
        url: "https://www.coingecko.com/en/coins/xrp",
      },
    ],
    links: [
      { label: "CoinGecko market page", url: "https://www.coingecko.com/en/coins/xrp", kind: "market" },
      { label: "XRPL", url: "https://xrpl.org/", kind: "official" },
    ],
  },
  doge: {
    updatedAt: "2026-03-15T14:30:00.000Z",
    narratives: {
      positive:
        "Dogecoin strength is usually driven by social momentum and retail attention more than by a conventional fundamentals story.",
      negative:
        "Dogecoin reversals can be abrupt because the move is often sentiment-led and can cool faster than it started.",
      neutral:
        "Dogecoin often behaves like a retail-sentiment pulse check rather than a slow, information-rich trend.",
    },
    evidence: [
      {
        title: "DOGE is a sentiment coin first, so watch attention and follow-through before treating the move as durable.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T16:30:00.000Z",
        url: "https://www.coingecko.com/en/coins/dogecoin",
      },
      {
        title: "Retail-driven coins can feel easy to read because the narrative is simple, but they still need clear risk guardrails.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T16:40:00.000Z",
        url: "https://dogecoin.com/",
      },
      {
        title: "When DOGE leads the board, the right beginner question is usually 'is attention expanding or already peaking?'",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T16:50:00.000Z",
        url: "https://www.coingecko.com/en/coins/dogecoin",
      },
    ],
    links: [
      { label: "CoinGecko market page", url: "https://www.coingecko.com/en/coins/dogecoin", kind: "market" },
      { label: "Dogecoin", url: "https://dogecoin.com/", kind: "official" },
    ],
  },
  ada: {
    updatedAt: "2026-03-15T14:30:00.000Z",
    narratives: {
      positive:
        "Cardano strength usually needs a clearer roadmap or ecosystem catalyst than pure momentum coins do.",
      negative:
        "Cardano weakness often reflects patience leaving the trade rather than a single dramatic headline.",
      neutral:
        "Cardano moves can stay slower than the loudest part of the market, so the beginner read is often about conviction, not speed.",
    },
    evidence: [
      {
        title: "ADA context tends to be roadmap-driven, so traders often look for steady conviction rather than instant reaction.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T16:00:00.000Z",
        url: "https://www.coingecko.com/en/coins/cardano",
      },
      {
        title: "If ADA is moving without a broad market push, look for ecosystem or governance context before assuming pure momentum.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T16:10:00.000Z",
        url: "https://cardano.org/",
      },
      {
        title: "Cardano is useful in this prototype because it shows how some moves are slower to interpret but still actionable.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T16:20:00.000Z",
        url: "https://cardano.org/",
      },
    ],
    links: [
      { label: "CoinGecko market page", url: "https://www.coingecko.com/en/coins/cardano", kind: "market" },
      { label: "Cardano", url: "https://cardano.org/", kind: "official" },
    ],
  },
  bnb: {
    updatedAt: "2026-03-15T14:30:00.000Z",
    narratives: {
      positive:
        "BNB usually moves best when exchange activity, ecosystem participation, and broad market risk appetite all support each other.",
      negative:
        "BNB weakness often reflects exchange-linked sentiment cooling or a general rotation away from ecosystem-heavy trades.",
      neutral:
        "BNB can read like an ecosystem-health bar, so flat price action can still say something about participation quality.",
    },
    evidence: [
      {
        title: "BNB often blends exchange demand with ecosystem participation, which makes it more layered than a single headline move.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T15:30:00.000Z",
        url: "https://www.coingecko.com/en/coins/binancecoin",
      },
      {
        title: "For beginners, BNB is easiest to trust when the move is supported by both board momentum and exchange-ecosystem strength.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T15:40:00.000Z",
        url: "https://www.bnbchain.org/en",
      },
      {
        title: "If BNB lags the rest of a green market, that can be a signal that participation is narrowing instead of broadening.",
        source: "CoinCanvas research note",
        publishedAt: "2026-03-14T15:50:00.000Z",
        url: "https://www.coingecko.com/en/coins/binancecoin",
      },
    ],
    links: [
      { label: "CoinGecko market page", url: "https://www.coingecko.com/en/coins/binancecoin", kind: "market" },
      { label: "BNB Chain", url: "https://www.bnbchain.org/en", kind: "official" },
    ],
  },
};
