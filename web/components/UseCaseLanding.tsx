import Link from "next/link";
import type { ReactNode } from "react";
import { AppShot } from "@/components/AppShot";

export type UseCaseShot = {
  src: string;
  alt: string;
  width: number;
  height: number;
  eyebrow?: string;
  caption?: string;
};

export type UseCaseData = {
  eyebrow: string;
  h1: ReactNode;
  lede: string;
  intro: ReactNode;
  coachingHeading: string;
  coaching: { title: string; body: ReactNode }[];
  shots?: UseCaseShot[];
  highlightsHeading: string;
  highlights: { title: string; body: string }[];
  faqHeading: string;
  faq: { q: string; a: string }[];
  closingTitle: string;
  closingBody: string;
};

export function UseCaseLanding({ data }: { data: UseCaseData }) {
  return (
    <>
      {/* Hero */}
      <section className="bg-hero-gradient text-white">
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 md:pt-28 md:pb-24">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/10 border border-white/15 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal" />
            {data.eyebrow}
          </span>
          <h1 className="font-display text-4xl md:text-6xl font-bold leading-[1.05] tracking-tight max-w-3xl">
            {data.h1}
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/75 max-w-2xl leading-relaxed">
            {data.lede}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/#download"
              className="px-6 py-3 rounded-full bg-white text-ink font-medium hover:bg-brand-soft transition"
            >
              Join the waitlist
            </Link>
            <Link
              href="/how-it-works"
              className="px-6 py-3 rounded-full border border-white/25 text-white font-medium hover:bg-white/10 transition"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* Intro prose */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-6 py-20 prose-legal">{data.intro}</div>
      </section>

      {/* How Grit coaches X */}
      <section className="bg-paper">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-24">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-ink tracking-tight max-w-2xl">
            {data.coachingHeading}
          </h2>
          <div className="mt-12 grid sm:grid-cols-2 gap-x-10 gap-y-10">
            {data.coaching.map((c) => (
              <div key={c.title} className="border-l-2 border-brand/30 pl-5">
                <h3 className="font-display font-semibold text-lg text-ink">
                  {c.title}
                </h3>
                <div className="mt-2 text-ink-soft leading-relaxed">{c.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots */}
      {data.shots && data.shots.length > 0 && (
        <section className="bg-white">
          <div className="max-w-5xl mx-auto px-6 py-20 md:py-24">
            <div
              className={`grid gap-10 justify-items-center ${
                data.shots.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
              }`}
            >
              {data.shots.map((s) => (
                <AppShot key={s.src} {...s} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Highlights */}
      <section className="bg-cream">
        <div className="max-w-5xl mx-auto px-6 py-20 md:py-24">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-ink tracking-tight max-w-2xl">
            {data.highlightsHeading}
          </h2>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.highlights.map((h) => (
              <div
                key={h.title}
                className="p-6 rounded-2xl bg-white border border-brand/10"
              >
                <h3 className="font-display font-semibold text-lg text-ink">
                  {h.title}
                </h3>
                <p className="mt-2 text-ink-soft leading-relaxed text-sm">
                  {h.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-24">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
            {data.faqHeading}
          </h2>
          <dl className="mt-10 space-y-7">
            {data.faq.map((f) => (
              <div key={f.q}>
                <dt className="font-display text-lg font-semibold text-ink">
                  {f.q}
                </dt>
                <dd className="mt-2 text-ink-soft leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-paper">
        <div className="max-w-3xl mx-auto px-6 py-20 md:py-24 text-center">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-ink tracking-tight">
            {data.closingTitle}
          </h2>
          <p className="mt-4 text-ink-soft text-lg leading-relaxed">
            {data.closingBody}
          </p>
          <Link
            href="/#download"
            className="inline-block mt-8 px-7 py-3 rounded-full bg-ink text-white font-medium hover:bg-brand transition"
          >
            Join the waitlist
          </Link>
        </div>
      </section>
    </>
  );
}
