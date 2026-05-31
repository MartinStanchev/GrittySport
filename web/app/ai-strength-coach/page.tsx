import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { UseCaseLanding, type UseCaseData } from "@/components/UseCaseLanding";
import { SITE_URL, buildUseCaseJsonLd } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/ai-strength-coach/`;
const DESCRIPTION =
  "Gritty is an AI strength coach and personal trainer app: it programs your lifts from your 1RMs, logs every set and RPE, and adjusts loads and volume based on how your sessions actually go. Free, on iOS and Android.";

export const metadata: Metadata = {
  title: "AI Personal Trainer & Strength Coach App | Gritty Fitness",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "AI Personal Trainer that programs and progresses your lifts",
    description:
      "An AI strength coach that builds your program from your 1RMs and adapts loads to your logged sessions.",
    type: "website",
    url: PAGE_URL,
  },
};

const faq = [
  {
    q: "Is this really an AI personal trainer?",
    a: "Grit does the programming a personal trainer does — sets your starting loads from your 1RMs, plans progression and deloads, reads how each session went, and adjusts what's next. It's a coach for your training, not a medical or physiotherapy service, and every program change is a proposal you approve.",
  },
  {
    q: "What kind of strength training does it program?",
    a: "General strength, hypertrophy, and powerlifting-style work. Tell Grit your goal — \"get stronger\", \"put on muscle, three lifts a week\", or a specific total — and it builds a progression around your schedule and available equipment.",
  },
  {
    q: "Does it track sets, reps, and RPE?",
    a: "Yes. You log sets in-app with pause/resume, and Grit factors completed sets and RPE into the next session's loads and volume. It can even use heart-rate spikes to detect when a new set starts.",
  },
  {
    q: "Can I combine lifting with running or other cardio?",
    a: "That's the whole idea. One Gritty program can hold your strength work plus conditioning, mobility, and recovery, so your lifting and cardio don't fight each other across the week.",
  },
  {
    q: "Does it remember my constraints?",
    a: "Yes. Tell Grit \"left knee is sensitive on impact\", \"no Tuesdays\", or \"only have dumbbells at home\" and it saves the constraint and plans around it. You can list and forget these anytime.",
  },
  {
    q: "Is it free?",
    a: "Yes. The coach, a full program, set logging, and imports are free. Premium (€7.99/month or €69/year) adds unlimited chat, a review on every session, multiple programs, and deeper analytics like PRs across every lift.",
  },
];

const data: UseCaseData = {
  eyebrow: "AI strength coach",
  h1: (
    <>
      An AI personal trainer that programs and progresses{" "}
      <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent">
        every lift
      </span>
      .
    </>
  ),
  lede: "Grit builds your strength program around your 1RMs and schedule, logs every set and RPE, and adjusts loads and volume based on how your sessions actually go — for free.",
  intro: (
    <>
      <h2>A spreadsheet tracks your lifts. It doesn&apos;t coach them.</h2>
      <p>
        Logging numbers in a notes app or a spreadsheet only helps if something
        acts on them. You still have to decide when to add weight, when to back
        off, and how to fit lifting around the rest of your week — and most
        people either push too hard or stall for months.
      </p>
      <p>
        Gritty is an <strong>AI personal trainer</strong> built around a coach
        named Grit. Grit programs your lifts from your training maxes, reads how
        each session actually went — completed sets, RPE, missed reps — and
        proposes the next progression or deload. You approve every change, and
        your strength work lives in the same plan as your conditioning and
        recovery instead of in five different apps. Ask for guidance whenever
        you want, and watch every set, PR, and trend in one place.
      </p>
    </>
  ),
  coachingHeading: "How Grit coaches your strength training",
  coaching: [
    {
      title: "Loads from your training maxes",
      body: "Grit sets your starting weights from your 1RMs or recent top sets, so the first session is already in the right ballpark — not a generic percentage guess.",
    },
    {
      title: "Progression tuned to your logs",
      body: "Hit all your reps at a low RPE and Grit banks the gain into next week. Grind through a session and it holds or backs off before you stall.",
    },
    {
      title: "Set logging that keeps up",
      body: "Log sets in-app with pause/resume between efforts. Wearing a heart-rate strap? Grit uses the spike at the start of a set to track your work.",
    },
    {
      title: "Deloads and recovery on purpose",
      body: "Grit plans recovery and deload weeks into the block instead of waiting for you to burn out, and reschedules when you miss sessions.",
    },
    {
      title: "Strength alongside everything else",
      body: "Running, riding, or a sport on the side? Grit balances lifting against your other training so the week adds up instead of overreaching.",
    },
    {
      title: "It remembers your constraints",
      body: "Bad knee, home gym only, no Tuesdays — tell Grit once and every future program respects it.",
    },
    {
      title: "You stay in control",
      body: "Travelling, run-down, or ready to add volume? Just ask Grit and it reshapes your lifting block for you — deload, pause, or push. Every change is a proposal you approve.",
    },
  ],
  shots: [
    {
      src: "/app_screenshots/program-review-light.png",
      alt: "Full-screen strength program review showing phases, days per week, and the week template before saving.",
      width: 395,
      height: 860,
      eyebrow: "See the whole block",
      caption: "Review the full program — edit any session before you save it.",
    },
    {
      src: "/app_screenshots/program-phases-light.png",
      alt: "Program phases view showing a strength block broken into base, build, and peak phases.",
      width: 399,
      height: 859,
      eyebrow: "Periodized progression",
      caption: "Phases and progression laid out across the whole training cycle.",
    },
    {
      src: "/app_screenshots/reminder-light.png",
      alt: "Grit confirming a recurring mobility reminder with a real push notification.",
      width: 434,
      height: 768,
      eyebrow: "Stay accountable",
      caption: "Ask Grit to remind you — it schedules a real push notification.",
    },
  ],
  highlightsHeading: "Built for lifting, not bolted on",
  highlights: [
    {
      title: "Set, rep & RPE logging",
      body: "Log every working set with pause/resume; Grit reads it into the next session.",
    },
    {
      title: "Benchmark-driven loads",
      body: "Starting weights come from your 1RMs and update as you get stronger.",
    },
    {
      title: "Planned deloads",
      body: "Recovery and deload weeks are built into the block, not an afterthought.",
    },
    {
      title: "Lifting + cardio in one plan",
      body: "Run multiple programs in parallel, or hold strength and conditioning together.",
    },
    {
      title: "PRs across every lift (Premium)",
      body: "Track personal records on each movement, not just one headline number.",
    },
    {
      title: "Free to start",
      body: "Full coach, a complete program, and set logging cost nothing.",
    },
  ],
  faqHeading: "AI personal trainer — FAQ",
  faq,
  closingTitle: "Train with a coach that adjusts to your lifts",
  closingBody:
    "Join the waitlist and be among the first to train with Grit when Gritty Fitness launches on iOS and Android.",
};

export default function AiStrengthCoachPage() {
  return (
    <>
      <JsonLd
        data={buildUseCaseJsonLd({
          name: "Gritty Fitness — AI Strength Coach & Personal Trainer",
          url: PAGE_URL,
          description: DESCRIPTION,
          breadcrumbName: "AI Strength Coach",
          faq,
        })}
      />
      <UseCaseLanding data={data} />
    </>
  );
}
