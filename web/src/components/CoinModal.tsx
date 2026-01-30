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
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div className="pill" style={{ marginBottom: 8 }}>
              <strong style={{ letterSpacing: "0.06em" }}>
                {coin.symbol.toUpperCase()}
              </strong>{" "}
              • {coin.name}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>
              ${coin.current_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </div>
            <div className={`pill ${positive ? "green" : "red"}`}>
              {positive ? "▲" : "▼"} {Math.abs(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
              (24h)
            </div>
          </div>
          <button className="refresh-btn secondary" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-actions">
          <button
            className="refresh-btn"
            onClick={() => onToggleFavorite(coin)}
            type="button"
          >
            {fav ? "Remove Favorite" : "Add to Favorites"}
          </button>
        </div>
      </div>
    </div>
  );
}
