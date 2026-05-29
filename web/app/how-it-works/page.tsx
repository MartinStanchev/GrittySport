import type { Metadata } from "next";
import Link from "next/link";
import { AppShot } from "@/components/AppShot";
import { Eyebrow } from "@/components/Eyebrow";
import { JsonLd } from "@/components/JsonLd";

const SITE_URL = "https://grittyfitness.app";
const PAGE_URL = `${SITE_URL}/how-it-works/`;

export const metadata: Metadata = {
  title: "How it works — Gritty Fitness AI coach",
  description:
    "How Gritty's AI fitness coach builds a multi-sport program, adapts after every workout, and pulls in data from your phone, smartwatch, Apple Health or Health Connect.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "How Gritty's AI fitness coach works",
    description:
      "The deep version: program building, Grit's tools, imports, and the post-workout review loop.",
    type: "article",
    url: PAGE_URL,
  },
};

type Section = {
  id: string;
  title: string;
  body: React.ReactNode;
  visual?: React.ReactNode;
};

function ProgramBuildingVisual() {
  return (
    <div className="grid sm:grid-cols-2 gap-10 sm:gap-8 justify-items-center">
      <AppShot
        src="/app_screenshots/program-chat-light.png"
        alt="Chat with Grit drafting a 14-week half-marathon program, ending in a program proposal card."
        width={399}
        height={859}
        eyebrow="Step 1 · Tell Grit your goal"
        caption="Plain-language intake. Grit asks for benchmarks, then drafts the block."
      />
      <AppShot
        src="/app_screenshots/program-review-light.png"
        alt="Full-screen program review showing weeks, days per week, phases, and the base-phase week template."
        width={395}
        height={860}
        eyebrow="Step 2 · Review before saving"
        caption="The whole plan as one card. Edit any session, or send it back to Grit."
      />
    </div>
  );
}

function GritToolsVisual() {
  return (
    <div className="grid sm:grid-cols-3 gap-10 sm:gap-6 justify-items-center">
      <AppShot
        src="/app_screenshots/edit-proposal-light.png"
        alt="Grit's program-adjustment card bumping Tuesday's threshold reps 10s/km faster after a tempo run felt easy."
        width={397}
        height={860}
        eyebrow="Propose an edit"
        caption="Before/after on the affected sessions. Apply or discuss."
      />
      <AppShot
        src="/app_screenshots/post-workout-review-light.png"
        alt="Saturday long-run review from Grit summarising 18.4 km, splits, HR zones, with quick-reply chips."
        width={431}
        height={768}
        eyebrow="Review every workout"
        caption="Effort, splits, HR — and quick replies to keep the thread going."
      />
      <AppShot
        src="/app_screenshots/reminder-light.png"
        alt="Grit confirming a 15-minute mobility reminder for 8 PM tonight, with recurring options."
        width={434}
        height={768}
        eyebrow="Set reminders"
        caption="Ask in chat. Grit schedules a real push notification."
      />
    </div>
  );
}

const SECTIONS: Section[] = [
  {
    id: "what-grit-is",
    title: "What Grit is",
    body: (
      <>
        <p>
          Gritty Fitness is an AI fitness coach app built around{" "}
          <strong>Grit</strong> — a coach who plans your training, watches every
          session you log, and adapts the plan after each one. Not a workout
          library. Not a generic tracker. A coach that owns your program across
          running, cycling, swimming, strength, mobility and recovery, and
          adjusts as your real performance comes in.
        </p>
      </>
    ),
  },
  {
    id: "building-your-program",
    title: "Building your program",
    body: (
      <>
        <p>
          You tell Grit what you&apos;re training for in plain language —{" "}
          <em>&ldquo;sub-2 half-marathon in 14 weeks&rdquo;</em>,{" "}
          <em>&ldquo;put on muscle, three lifts a week&rdquo;</em>,{" "}
          <em>&ldquo;Ironman 70.3 in September&rdquo;</em>. Grit asks a few
          targeted questions about your schedule, equipment, history and
          relevant benchmarks (1RM, recent race times, FTP, CSS), then drafts
          the full block.
        </p>
        <p>
          You see the whole program before anything is saved — phases,
          progressions, supporting work like dryland and mobility, recovery
          days. Edit any session inline, or ask Grit to rework a part. Nothing
          gets written to your plan until you tap Save.
        </p>
      </>
    ),
    visual: <ProgramBuildingVisual />,
  },
  {
    id: "what-grit-can-do",
    title: "What Grit can do, with examples",
    body: (
      <>
        <p>
          Grit acts through a small set of explicit tools so every change is
          visible and reversible.
        </p>
        <ul>
          <li>
            <strong>Propose a program.</strong> Full multi-sport block, presented
            as a single approve-or-edit card. Example: a 16-week marathon plan
            with two strength sessions and a weekly mobility block already built
            in.
          </li>
          <li>
            <strong>Propose an edit.</strong> One-tap adjustments to upcoming
            sessions. Example: you mention the tempo run felt easy → Grit checks
            the recorded HR and proposes a +10s/km bump on next week&apos;s
            threshold work, before/after shown side by side.
          </li>
          <li>
            <strong>Review every workout.</strong> After each session Grit reads
            effort, HR zones, splits and alignment with the plan, then writes a
            short review with quick replies you can tap to continue the
            conversation.
          </li>
          <li>
            <strong>Remember what matters.</strong> Tell Grit{" "}
            <em>&ldquo;I can&apos;t train Saturdays&rdquo;</em> or{" "}
            <em>&ldquo;left knee is sensitive on impact&rdquo;</em> and the
            preference is saved as a fact that shapes future proposals. You can
            list and forget them any time.
          </li>
          <li>
            <strong>Set reminders.</strong> Ask <em>&ldquo;remind me to do
            mobility tonight at 8&rdquo;</em> and Grit schedules a real push
            notification — no separate to-do app.
          </li>
        </ul>
      </>
    ),
    visual: <GritToolsVisual />,
  },
  {
    id: "connecting-your-workouts",
    title: "Connecting your workouts",
    body: (
      <>
        <p>
          A coach is only as good as the data it sees. Gritty doubles as a full
          AI fitness tracker — record in the app or import from anywhere.
        </p>
        <ul>
          <li>
            <strong>Record in-app.</strong> GPS recording for runs, rides, hikes
            and open-water swims, with optional pairing to any Bluetooth
            heart-rate strap. Manual logging for strength, mobility and indoor
            sessions, with pause/resume and HR-spike set detection.
          </li>
          <li>
            <strong>Apple Health (iOS).</strong> Pull workouts written by your
            watch or third-party apps. Preview each one, then save into Gritty
            with route, HR and splits intact.
          </li>
          <li>
            <strong>Health Connect (Android).</strong> One hub on the device
            collects workouts from Fitbit, Garmin, Samsung Health, Strava,
            Whoop, Wear OS and other Health-Connect-aware apps — Gritty reads
            them through the same import preview.
          </li>
          <li>
            <strong>File imports.</strong> GPX, TCX, FIT, CSV — and ZIP bundles.
            Useful for exports from Garmin Connect, Suunto, Coros, Polar Flow,
            or anywhere else.
          </li>
        </ul>
        <p>
          Every import goes through the same preview screen with route map,
          stats and HR chart, and you can link the import to a scheduled session
          before saving so Grit reviews it in context.
        </p>
      </>
    ),
  },
  {
    id: "adaptation",
    title: "How Grit adapts after each session",
    body: (
      <>
        <p>
          As soon as a workout is saved — recorded, imported, or logged
          manually — Grit runs a review. It compares effort, HR distribution,
          pacing and splits against what the session was supposed to be, weighs
          it against your recent history and the rest of the week, and pulls in
          relevant context Grit already remembers about you.
        </p>
        <p>
          If something needs to change, Grit proposes an edit. You see the
          before/after for the affected sessions, and one tap applies it. If
          you&apos;d rather talk it through first, the same review opens a chat
          thread. Missed a session? Grit checks in the next morning and offers
          concrete reschedule options.
        </p>
      </>
    ),
  },
  {
    id: "what-we-wont-do",
    title: "What we won't do",
    body: (
      <>
        <ul>
          <li>
            <strong>Auto-apply changes.</strong> Every program edit is a
            proposal you approve. You stay in control of your plan.
          </li>
          <li>
            <strong>Sell your data.</strong> Stored on EU infrastructure, never
            shared with ad networks. Export or delete everything at any time.
          </li>
          <li>
            <strong>Lock essentials behind Premium.</strong> Recording,
            importing, the AI coach itself and a full program all work on the
            free tier.
          </li>
          <li>
            <strong>Pretend to be a doctor.</strong> Grit is a coach, not a
            medical professional. We&apos;re explicit about it across the app.
          </li>
        </ul>
      </>
    ),
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How does the AI coach decide what workout to plan next?",
    a: "Grit weighs your goal, the phase you're in, what you've already done this week, how recent sessions actually went (effort, HR, alignment), and anything you've told it to remember — like time constraints or a tender knee. Every proposed change is shown as a before/after card you approve.",
  },
  {
    q: "Does Grit need a smartwatch?",
    a: "No. Phone GPS plus an optional Bluetooth HR strap covers most sessions, and you can import everything from Apple Health, Health Connect (Fitbit / Garmin / Samsung / Strava / Whoop / Wear OS), or GPX/TCX/FIT/CSV files.",
  },
  {
    q: "Can I train for more than one sport at the same time?",
    a: "Yes — that's the default. A marathon block includes strength and mobility. A triathlon block balances all three disciplines plus support work. You can also add ad-hoc activities (padel, hiking, football) and Grit factors them in.",
  },
  {
    q: "How long before Grit's adjustments feel personalised?",
    a: "After intake plus the first 1–2 weeks of recorded sessions. Benchmarks captured during intake set the initial paces and loads; the first few reviews calibrate them to how you actually train.",
  },
  {
    q: "Is this free?",
    a: "The full coach, program, recording and imports are free. Premium unlocks higher chat limits and deeper analytics — see Premium for details.",
  },
];

const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "How it works — Gritty Fitness",
  url: PAGE_URL,
  description: metadata.description,
  inLanguage: "en",
  isPartOf: { "@type": "WebSite", name: "Gritty Fitness", url: SITE_URL },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "How it works", item: PAGE_URL },
  ],
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function HowItWorksPage() {
  return (
    <article className="bg-white">
      <JsonLd data={[webPageJsonLd, breadcrumbJsonLd, faqJsonLd]} />

      <header className="bg-paper border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <Eyebrow>How it works</Eyebrow>
          <h1 className="mt-3 font-display text-4xl md:text-5xl font-bold text-ink leading-tight">
            How Gritty&apos;s AI fitness coach plans and adapts your training.
          </h1>
          <p className="mt-4 text-ink-soft text-lg">
            Program building, the tools Grit uses on your behalf, importing
            workouts from your watch or other apps, and the review loop that
            keeps your plan honest.
          </p>
          <nav className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-soft">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="hover:text-brand">
                {s.title}
              </a>
            ))}
            <a href="#faq" className="hover:text-brand">
              FAQ
            </a>
          </nav>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-16 prose-legal">
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} className="mb-12 scroll-mt-24">
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-ink mt-12 mb-3 tracking-tight">
              {s.title}
            </h2>
            {s.body}
            {s.visual && (
              <div className="mt-12 lg:-mx-24 xl:-mx-32">{s.visual}</div>
            )}
          </section>
        ))}

        <section id="faq" className="mt-16 pt-12 border-t border-black/10">
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-ink mb-6 tracking-tight">
            Frequently asked
          </h2>
          <dl className="space-y-6">
            {FAQ.map((f) => (
              <div key={f.q}>
                <dt className="font-display text-lg font-semibold text-ink">
                  {f.q}
                </dt>
                <dd className="mt-2 text-ink-soft leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <hr className="my-12 border-black/5" />

        <p className="text-ink-soft">
          Want to see Grit in real conversations? Browse the{" "}
          <Link href="/examples" className="text-brand hover:underline">
            examples gallery
          </Link>{" "}
          or read more on the{" "}
          <Link href="/learn" className="text-brand hover:underline">
            Learn
          </Link>{" "}
          blog.
        </p>
      </div>
    </article>
  );
}
