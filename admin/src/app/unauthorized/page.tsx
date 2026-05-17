export default function UnauthorizedPage() {
  return (
    <div className="unauth">
      <div className="unauth-card">
        <span className="brand-dot" aria-hidden style={{ display: "inline-block" }} />
        <h1>CoinCanvas · Ops</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.92rem" }}>
          Restricted dashboard. Append <code>?key=…</code> to authenticate.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: 16 }}>
          Operations-only access for the CoinCanvas production app.
        </p>
      </div>
    </div>
  );
}
