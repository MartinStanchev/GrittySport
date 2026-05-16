import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "About — Gritty Fitness",
  description:
    "The team behind Gritty Fitness — and why we're building an AI coach that respects the realities of training across multiple sports.",
  alternates: { canonical: "https://grittyfitness.app/about" },
  openGraph: {
    title: "About — Gritty Fitness",
    description:
      "The team behind Gritty Fitness and the training philosophy behind the AI coach.",
    type: "website",
    url: "https://grittyfitness.app/about",
  },
};

// IMPORTANT: Replace the [Founder Name], bio paragraph, and optional photo
// before going live. Used as the canonical author reference for future
// /learn/* articles, so E-E-A-T weight depends on it being concrete.
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "[Founder Name]",
  jobTitle: "Founder",
  url: "https://grittyfitness.app/about",
  email: "hello@grittyfitness.app",
  worksFor: {
    "@type": "Organization",
    name: "Gritty Fitness",
    url: "https://grittyfitness.app",
  },
};

const aboutPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: "About Gritty Fitness",
  url: "https://grittyfitness.app/about",
  inLanguage: "en",
  isPartOf: {
    "@type": "WebSite",
    name: "Gritty Fitness",
    url: "https://grittyfitness.app",
  },
  about: personJsonLd,
};

export default function AboutPage() {
  return (
    <article className="bg-white">
      <JsonLd data={[aboutPageJsonLd, personJsonLd]} />
      <header className="bg-paper border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Eyebrow>About</Eyebrow>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink leading-tight">
            The team behind Gritty Fitness.
          </h1>
          <p className="mt-4 text-ink-soft text-lg">
            Why we&apos;re building an AI coach that takes the realities of
            multi-sport training seriously.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="flex flex-col md:flex-row gap-10 items-start">
          <div
            aria-hidden
            className="shrink-0 w-32 h-32 rounded-full bg-gradient-to-br from-brand to-[#2a2440] text-white font-display text-4xl font-bold flex items-center justify-center"
          >
            <span className="placeholder">FN</span>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">
              <span className="placeholder">[Founder Name]</span>
            </h2>
            <p className="text-ink-soft mt-1">Founder</p>
            <p className="mt-4 text-ink leading-relaxed">
              <span className="placeholder">
                [One-paragraph bio: training background, why building Gritty,
                what perspective the founder brings to AI coaching across
                running, cycling, swimming, strength, and recovery. Keep it
                specific — generalities don&apos;t signal expertise to LLMs or
                Google.]
              </span>
            </p>
            <p className="mt-4 text-ink-soft">
              Contact:{" "}
              <a
                href="mailto:hello@grittyfitness.app"
                className="text-brand hover:underline"
              >
                hello@grittyfitness.app
              </a>
            </p>
          </div>
        </div>

        <hr className="my-12 border-black/5" />

        <div className="prose-legal">
          <h2>Our approach</h2>
          <p>
            Most coaching apps optimise for one sport. Real athletes don&apos;t
            train that way — a runner still lifts, a cyclist still mobilises,
            a swimmer still does dryland. Gritty Fitness was built around the
            idea that a holistic program should be the default, not an
            advanced configuration option.
          </p>
          <p>
            Grit, our AI coach, plans the full picture and adapts after every
            session. The training science behind those adjustments is laid
            out in our{" "}
            <Link href="/#how" className="text-brand hover:underline">
              how-it-works
            </Link>{" "}
            section, and the questions people ask before downloading live in
            our{" "}
            <Link href="/#faq" className="text-brand hover:underline">
              FAQ
            </Link>
            .
          </p>
        </div>
      </div>
    </article>
  );
}
