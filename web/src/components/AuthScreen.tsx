"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

type Mode = "login" | "register";

const COPY = {
  login: {
    brand: "SIGN IN",
    kicker: "Welcome back",
    title: "Sign in to your CoinCanvas.",
    blurb:
      "Your saved coins follow you here — on this phone, your laptop, anywhere you sign in.",
    submit: "Sign in",
    altText: "New to CoinCanvas?",
    altLink: "/register",
    altLabel: "Create an account",
  },
  register: {
    brand: "SIGN UP",
    kicker: "Create your account",
    title: "Keep your favorites, on every device.",
    blurb:
      "It takes a few seconds. Anything you've already saved as a guest comes with you.",
    submit: "Create account",
    altText: "Already have an account?",
    altLink: "/login",
    altLabel: "Sign in instead",
  },
} as const;

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = COPY[mode];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const result =
      mode === "login"
        ? await login(email, password)
        : await register(
            email,
            password,
            displayName.trim() || undefined,
            "register_page",
          );
    setSubmitting(false);
    if (result.ok) {
      router.push("/");
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-dot" />
          {copy.brand}
        </Link>
        <div className="controls">
          <Link href="/" className="nav-link">
            Canvas
          </Link>
        </div>
      </header>

      <main className="page-wrap interior-page auth-wrap">
        <section className="hero-panel auth-card">
          <div className="auth-head">
            <p className="hero-kicker">{copy.kicker}</p>
            <h1>{copy.title}</h1>
            <p className="hero-copy">{copy.blurb}</p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === "register" ? (
              <div className="auth-field">
                <label className="section-label" htmlFor="auth-name">
                  Display name <span className="auth-optional">(optional)</span>
                </label>
                <input
                  id="auth-name"
                  className="auth-input"
                  type="text"
                  autoComplete="name"
                  enterKeyHint="next"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                />
              </div>
            ) : null}

            <div className="auth-field">
              <label className="section-label" htmlFor="auth-email">
                Email
              </label>
              <input
                id="auth-email"
                className="auth-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="auth-field">
              <label className="section-label" htmlFor="auth-password">
                Password
              </label>
              <div className="auth-password-wrap">
                <input
                  id="auth-password"
                  className="auth-input"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  enterKeyHint="go"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "register"
                      ? "At least 8 characters"
                      : "Your password"
                  }
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="refresh-btn auth-submit"
              disabled={submitting}
            >
              {submitting ? "One moment…" : copy.submit}
            </button>
          </form>

          <div className="auth-alt">
            <span>{copy.altText}</span>
            <Link href={copy.altLink} className="auth-alt-link">
              {copy.altLabel}
            </Link>
          </div>

          <Link href="/" className="auth-guest">
            Continue as guest
          </Link>
        </section>
      </main>
    </div>
  );
}
