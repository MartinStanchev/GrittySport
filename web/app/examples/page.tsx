import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = "https://grittyfitness.app";
const PAGE_URL = `${SITE_URL}/examples`;

export const metadata: Metadata = {
  title: "Examples — Real conversations with the AI fitness coach",
  description:
    "See Grit in action: program proposals, edit-before-save cards, post-workout reviews, lockscreen check-ins, multi-sport adaptation. Real AI fitness coach interactions.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "Examples — Real conversations with Grit",
    description:
      "Concrete examples of how Gritty's AI coach plans, reviews, and adapts your training.",
    type: "website",
    url: PAGE_URL,
  },
};

type Example = {
  id: string;
  eyebrow: string;
  title: string;
  context: string;
  whatGritDid: string[];
  image: string | null;
};

// TODO content: each slot below is a placeholder we'll fill together. v1 plan
// is to drop static screenshots into `web/public/examples/<id>.png` (sourced
// from `frontend/src/marketing/scenes/` via the marketing-scene skill, or
// captured directly in the app) and write a 2-3 sentence prose intro per
// example. When `image` is null, the slot renders a labeled placeholder so the
// page still ships clean.
const EXAMPLES: Example[] = [
  {
    id: "program-proposal",
    eyebrow: "Example 1",
    title: "TODO — Grit proposes your first program",
    context:
      "TODO — short intro: user told Grit they want to run their first half-marathon in 14 weeks; Grit proposes a phased plan with strength + mobility built in.",
    whatGritDid: [
      "TODO — sized the block to 14 weeks with base / build / peak / taper phases.",
      "TODO — added 2 strength sessions per week even though the user asked for \"running plan\".",
      "TODO — surfaced the full proposal as an editable card before saving anything.",
    ],
    image: null,
  },
  {
    id: "edit-proposal",
    eyebrow: "Example 2",
    title: "TODO — One-tap workout adjustment",
    context:
      "TODO — user told Grit today's tempo run felt easy; Grit reviewed HR / pace and proposed bumping next week's threshold work.",
    whatGritDid: [
      "TODO — cross-checked the user's note against the actual recorded HR zones.",
      "TODO — proposed a +10s/km adjustment on the next threshold session only.",
      "TODO — rendered the before/after as a single Apply Changes card.",
    ],
    image: null,
  },
  {
    id: "post-workout-review",
    eyebrow: "Example 3",
    title: "TODO — Post-workout review",
    context:
      "TODO — Grit's automated review after a long run, with effort score, splits, and a quick reply prompt.",
    whatGritDid: [
      "TODO — pulled context from the user's program + memory.",
      "TODO — flagged a negative-split pacing pattern as a positive trend.",
      "TODO — offered three quick replies + continue-in-chat.",
    ],
    image: null,
  },
  {
    id: "missed-workout-checkin",
    eyebrow: "Example 4",
    title: "TODO — Missed workout check-in",
    context:
      "TODO — user skipped Tuesday's session; Grit checks in on Wednesday morning without judgment and offers options.",
    whatGritDid: [
      "TODO — detected the gap server-side at the scheduled review time.",
      "TODO — sent a lockscreen notification that opens straight into chat.",
      "TODO — proposed three concrete reschedule options.",
    ],
    image: null,
  },
  {
    id: "multi-sport-week",
    eyebrow: "Example 5",
    title: "TODO — One week of multi-sport training",
    context:
      "TODO — a real week in the Programs view: runs, dryland, mobility, recovery — color-coded.",
    whatGritDid: [
      "TODO — balanced load across modalities, not just runs.",
      "TODO — placed mobility after the hardest session.",
      "TODO — left recovery actually empty (no \"junk\" filler).",
    ],
    image: null,
  },
  {
    id: "hr-spike-set-detection",
    eyebrow: "Example 6",
    title: "TODO — Strength set detection from HR",
    context:
      "TODO — during a strength session, Grit auto-highlights the next set when HR spikes — no manual tapping.",
    whatGritDid: [
      "TODO — read live HR from a paired BLE strap.",
      "TODO — detected the recovery-to-effort transition and advanced the set.",
      "TODO — let the user override with one tap if needed.",
    ],
    image: null,
  },
];

const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Examples — Gritty Fitness",
  url: PAGE_URL,
  description: metadata.description,
  inLanguage: "en",
  isPartOf: { "@type": "WebSite", name: "Gritty Fitness", url: SITE_URL },
};

const itemListJsonLd = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  name: "Examples of Grit, the AI fitness coach, in action",
  itemListElement: EXAMPLES.map((ex, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: ex.title.replace(/^TODO\s*[—-]\s*/, ""),
    url: `${PAGE_URL}#${ex.id}`,
    description: ex.context.replace(/^TODO\s*[—-]\s*/, ""),
  })),
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Examples", item: PAGE_URL },
  ],
};

function ExampleScreenshot({ example }: { example: Example }) {
  if (example.image) {
    // TODO when shipping real screenshots, swap to next/image with explicit
    // width/height and meaningful alt text.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={example.image}
        alt={example.title}
        className="w-full rounded-2xl border border-black/5 shadow-sm bg-paper"
      />
    );
  }
  return (
    <div className="w-full aspect-[9/16] max-w-[280px] mx-auto md:mx-0 rounded-2xl border border-dashed border-black/15 bg-paper flex items-center justify-center text-ink-soft text-xs uppercase tracking-wider">
      <span className="placeholder">Screenshot · {example.id}</span>
    </div>
  );
}

export default function ExamplesPage() {
  return (
    <article className="bg-white">
      <JsonLd data={[webPageJsonLd, itemListJsonLd, breadcrumbJsonLd]} />

      <header className="bg-paper border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Eyebrow>Examples</Eyebrow>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink leading-tight">
            {/* TODO — keyword-rich H1. Working title below. */}
            See the AI fitness coach in action.
          </h1>
          <p className="mt-4 text-ink-soft text-lg">
            {/* TODO — replace dek. */}
            Real interactions with Grit — program proposals, one-tap
            adjustments, post-workout reviews, and the multi-sport weeks Grit
            actually builds.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-16 space-y-20">
        {EXAMPLES.map((ex) => (
          <section
            key={ex.id}
            id={ex.id}
            className="scroll-mt-24 grid md:grid-cols-[1fr_280px] gap-10 items-start"
          >
            <div>
              <Eyebrow>{ex.eyebrow}</Eyebrow>
              <h2 className="mt-2 font-display text-2xl md:text-3xl font-semibold text-ink tracking-tight">
                <span className="placeholder">{ex.title}</span>
              </h2>
              <p className="mt-4 text-ink-soft leading-relaxed">
                <span className="placeholder">{ex.context}</span>
              </p>
              <h3 className="mt-6 text-xs uppercase tracking-wider text-brand font-semibold">
                What Grit did
              </h3>
              <ul className="mt-2 list-disc pl-5 text-ink-soft space-y-1.5">
                {ex.whatGritDid.map((b, i) => (
                  <li key={i}>
                    <span className="placeholder">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
            <ExampleScreenshot example={ex} />
          </section>
        ))}

        <hr className="border-black/5" />

        <p className="text-ink-soft">
          Curious about the mechanics behind these examples? Read the deep
          version of{" "}
          <Link href="/how-it-works" className="text-brand hover:underline">
            how Grit works
          </Link>{" "}
          or browse the{" "}
          <Link href="/learn" className="text-brand hover:underline">
            Learn
          </Link>{" "}
          blog.
        </p>
      </div>
    </article>
  );
}
