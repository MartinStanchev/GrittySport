import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow } from "@/components/Eyebrow";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = "https://grittyfitness.app";
const PAGE_URL = `${SITE_URL}/examples/`;

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
  imageAlt?: string;
};

const EXAMPLES: Example[] = [
  {
    id: "program-proposal",
    eyebrow: "Example 1",
    title: "Grit proposes your first program",
    context:
      "A new user tells Grit they want to run their first half-marathon in 14 weeks. Grit asks a few questions about their schedule and recent runs, then drafts a complete, phased plan — and presents it as one editable card before anything is saved.",
    whatGritDid: [
      "Sized the block to 14 weeks across base, build, peak, and taper phases.",
      'Built in two strength sessions and weekly mobility, even though the user asked for a "running plan".',
      "Set training paces from the user's recent 5K time, not generic tables.",
      "Showed the whole program as an editable proposal — nothing saved until the user approved it.",
    ],
    image: "/app_screenshots/program-review-light.png",
    imageAlt:
      "Full-screen program proposal showing a 14-week half-marathon plan with phases and a weekly template.",
  },
  {
    id: "edit-proposal",
    eyebrow: "Example 2",
    title: "A one-tap workout adjustment",
    context:
      "After a tempo run, the user mentions it felt easy. Grit checks the recorded heart rate, agrees, and proposes bumping next week's threshold session — shown as a before/after card the user can apply in one tap.",
    whatGritDid: [
      "Cross-checked the user's note against the actual recorded HR zones.",
      "Proposed a +10s/km bump on the next threshold session only — not the whole plan.",
      "Rendered the change as a single before/after card with Apply or Discuss.",
    ],
    image: "/app_screenshots/edit-proposal-light.png",
    imageAlt:
      "Grit's program-adjustment card bumping Tuesday's threshold reps 10s/km faster, shown before and after.",
  },
  {
    id: "post-workout-review",
    eyebrow: "Example 3",
    title: "A review after every workout",
    context:
      "The morning after a long run, Grit posts an automated review — effort score, splits, heart-rate zones, and how the session lined up with the plan — with quick replies to keep the conversation going.",
    whatGritDid: [
      "Pulled context from the user's program and saved preferences.",
      "Flagged a negative-split pacing pattern as a positive trend.",
      "Offered three quick-reply chips plus continue-in-chat.",
    ],
    image: "/app_screenshots/post-workout-review-light.png",
    imageAlt:
      "A long-run review from Grit summarising distance, splits, and HR zones with quick-reply chips.",
  },
  {
    id: "missed-workout-checkin",
    eyebrow: "Example 4",
    title: "A check-in when you miss a session",
    context:
      "The user skips Tuesday's session. On Wednesday morning Grit checks in — no guilt-trip — with concrete options to get back on track.",
    whatGritDid: [
      "Detected the gap automatically at the scheduled review time.",
      "Sent a lockscreen notification that opens straight into the chat.",
      "Proposed three concrete reschedule options instead of just moving on.",
    ],
    image: null,
  },
  {
    id: "multi-sport-week",
    eyebrow: "Example 5",
    title: "A real multi-sport week",
    context:
      "A marathon block, mid-build. The week Grit actually builds isn't all runs — it's runs, supporting strength, mobility, and genuine recovery, balanced so the hard days have room to land.",
    whatGritDid: [
      "Balanced load across modalities, not just running volume.",
      "Placed mobility right after the hardest session of the week.",
      "Left recovery days actually empty — no junk filler to pad the calendar.",
    ],
    image: null,
  },
  {
    id: "hr-spike-set-detection",
    eyebrow: "Example 6",
    title: "Hands-free strength set detection",
    context:
      "During a strength session with a paired heart-rate strap, Grit advances to the next set on its own when it sees your HR spike — no tapping the screen with chalky hands.",
    whatGritDid: [
      "Read live HR from a paired Bluetooth strap.",
      "Detected the recovery-to-effort transition and advanced the set automatically.",
      "Let the user override with a single tap when needed.",
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
    name: ex.title,
    url: `${PAGE_URL}#${ex.id}`,
    description: ex.context,
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
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={example.image}
        alt={example.imageAlt ?? example.title}
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
            See the AI fitness coach in action.
          </h1>
          <p className="mt-4 text-ink-soft text-lg">
            Real interactions with Grit — program proposals, one-tap
            adjustments, post-workout reviews, missed-session check-ins, and the
            multi-sport weeks Grit actually builds.
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
                {ex.title}
              </h2>
              <p className="mt-4 text-ink-soft leading-relaxed">{ex.context}</p>
              <h3 className="mt-6 text-xs uppercase tracking-wider text-brand font-semibold">
                What Grit did
              </h3>
              <ul className="mt-2 list-disc pl-5 text-ink-soft space-y-1.5">
                {ex.whatGritDid.map((b, i) => (
                  <li key={i}>{b}</li>
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
