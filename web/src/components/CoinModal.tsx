"use client";

import { Coin } from "@/lib/coingecko";

type Props = {
  coin: Coin | null;
  onClose: () => void;
  onToggleFavorite: (coin: Coin) => void;
  isFavorite: (symbol: string) => boolean;
};

export function CoinModal({ coin, onClose, onToggleFavorite, isFavorite }: Props) {
  if (!coin) return null;
  const positive = (coin.price_change_percentage_24h ?? 0) >= 0;
  const fav = isFavorite(coin.symbol);

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
      {/* Click outside to close */}
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {coin.image && (
              <img
                src={coin.image}
                alt={coin.symbol}
                width={48}
                height={48}
                style={{ borderRadius: "50%" }}
              />
            )}
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1 }}>
                {coin.name}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: 14, fontWeight: 500, marginTop: 4 }}>
                {coin.symbol.toUpperCase()}
              </div>
            </div>
          </div>

          <button
            className="refresh-btn secondary"
            onClick={onClose}
            style={{ padding: "8px 12px", borderRadius: 99 }}
          >
            ✕
          </button>
        </div>

        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "16px 0",
          borderBottom: "1px solid var(--border)",
          borderTop: "1px solid var(--border)",
          margin: "8px 0"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>Price</span>
            <span style={{ fontSize: 28, fontWeight: 700 }}>
              ${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>24h Change</span>
            <div className={`pill ${positive ? "green" : "red"}`} style={{ fontSize: 16 }}>
              {positive ? "▲" : "▼"} {Math.abs(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--muted)", fontSize: 14 }}>Market Cap</span>
            <span style={{ fontSize: 16, fontWeight: 500 }}>
              ${(coin.market_cap / 1e9).toFixed(2)}B
            </span>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className={`refresh-btn ${fav ? "secondary" : ""}`}
            onClick={() => onToggleFavorite(coin)}
            type="button"
            style={{
              height: 48, // Taller touch target
              fontSize: 16,
              justifyContent: "center",
              background: fav ? "transparent" : "var(--accent)",
              color: fav ? "var(--text)" : "#000",
              borderColor: fav ? "var(--border)" : "transparent"
            }}
          >
            {fav ? "Remove from Favorites" : "Add to Favorites"}
          </button>
        </div>
      </div>
    </div>
  );
}
