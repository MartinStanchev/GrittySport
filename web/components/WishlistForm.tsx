"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

// Public marketing-site endpoint on the Go backend. Configurable per
// environment via NEXT_PUBLIC_API_URL (baked in at build time because the
// site is statically exported).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.grittyfitness.app";

type Status = "idle" | "submitting" | "success" | "error";

export function WishlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const trimmed = email.trim();
    if (!trimmed) {
      setStatus("error");
      setErrorMessage("Please enter your email.");
      return;
    }

    setStatus("submitting");
    setErrorMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/wishlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
        return;
      }

      if (res.status === 422) {
        setStatus("error");
        setErrorMessage("That email address doesn't look right.");
        return;
      }
      if (res.status === 429) {
        setStatus("error");
        setErrorMessage("Too many requests — please try again in a moment.");
        return;
      }
      setStatus("error");
      setErrorMessage("Something went wrong. Please try again.");
    } catch {
      setStatus("error");
      setErrorMessage("Couldn't reach the server. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-emerald-100 max-w-md">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-base">✓</span>
          You&apos;re on the list — we&apos;ll email you when Gritty Fitness launches.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md" noValidate>
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-0 sm:items-stretch sm:rounded-full sm:border sm:border-white/15 sm:bg-white/5 sm:p-1 sm:backdrop-blur">
        <input
          type="email"
          autoComplete="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          aria-label="Email address"
          className="flex-1 min-w-0 rounded-full sm:rounded-full bg-white/5 sm:bg-transparent border border-white/15 sm:border-0 px-5 py-3 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-brand/60 transition"
          disabled={status === "submitting"}
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="rounded-full bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-3 transition shadow-lg shadow-brand/20 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === "submitting" ? "Joining…" : "Join the waitlist"}
        </button>
      </div>

      {errorMessage && (
        <p className="mt-2 text-sm text-rose-300" role="alert">
          {errorMessage}
        </p>
      )}

      <p className="mt-3 text-xs text-white/45 leading-relaxed">
        One email when the app goes live. No spam.{" "}
        <Link href="/privacy" className="underline hover:text-white/70">
          Privacy policy
        </Link>
        .
      </p>
    </form>
  );
}
