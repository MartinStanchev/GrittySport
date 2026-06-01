import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { UseCaseLanding, type UseCaseData } from "@/components/UseCaseLanding";
import { SITE_URL, buildUseCaseJsonLd } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/ai-running-coach/`;
const DESCRIPTION =
  "Gritty is an AI running coach app that builds your race plan from real benchmarks, reads your pace and heart rate after every run, and adapts the next session — with strength and mobility built in. Free, on iOS and Android.";

export const metadata: Metadata = {
  title: "AI Running Coach App — Adaptive Training Plans | Gritty Fitness",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "AI Running Coach App that adapts to every run",
    description:
      "Adaptive running plans from a coach that reads your pace and HR and adjusts after every session.",
    type: "website",
    url: PAGE_URL,
  },
};

const faq = [
  {
    q: "Is this a replacement for a human running coach?",
    a: "Grit handles the day-to-day work of a coach — building a periodized plan, setting paces from your benchmarks, reviewing each run, and adjusting what's next — for a fraction of the cost and available 24/7. It is a coach, not a medical professional, and it never silently changes your plan: every adjustment is a proposal you approve.",
  },
  {
    q: "What race distances does it plan for?",
    a: "Anything from a 5K to a marathon or ultra. You tell Grit the goal and date in plain language (\"sub-2 half in 14 weeks\"), and it sizes the block — base, build, peak, taper — to fit your weeks and current fitness.",
  },
  {
    q: "Do I need a Garmin or smartwatch?",
    a: "No. You can record runs with your phone's GPS and an optional Bluetooth heart-rate strap. If you do use a watch, import runs from Apple Health or Health Connect (Coros, Suunto, etc.) — or export a GPX/TCX/FIT file from Garmin Connect and upload it — so Grit reviews them in context.",
  },
  {
    q: "How does it set my paces?",
    a: "From your benchmarks. Grit asks for a recent race time or threshold effort during intake and derives your training paces and heart-rate zones from it, then recalibrates as your real sessions come in.",
  },
  {
    q: "Does it include strength training for runners?",
    a: "Yes — that's the point of a holistic plan. A running block includes supporting strength and mobility work to keep you healthy through the build, not just a list of runs.",
  },
  {
    q: "Is it free?",
    a: "Yes. The coach, a full running program, GPS recording, and imports are all free. Premium (€7.99/month or €69/year) adds unlimited chat, a review on every run, multiple programs, and deeper analytics.",
  },
];

const data: UseCaseData = {
  eyebrow: "AI running coach",
  h1: (
    <>
      An AI running coach that adapts to <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent">every run</span>.
    </>
  ),
  lede: "Grit builds your race plan from real benchmarks, reads your pace and heart rate after each run, and proposes the next adjustment in one tap — with strength and mobility built in so you get to the start line healthy.",
  intro: (
    <>
      <h2>Static running plans don&apos;t survive contact with real life</h2>
      <p>
        A printed marathon plan assumes every week goes perfectly. Miss a few
        runs to a head cold, a work trip, or a bad night&apos;s sleep and the
        targets for next week are already wrong. Progressing faster than the
        template expected? It can&apos;t push you. A plan that never changes
        can&apos;t coach you.
      </p>
      <p>
        Gritty is an <strong>AI running coach app</strong> built around a coach
        named Grit. Grit drafts a full periodized block from your goal, then
        watches what you actually do — pace, splits, heart-rate zones, how the
        session felt — and adjusts the rest of the plan after every run. You
        approve each change; nothing happens behind your back. Want to steer it
        yourself? Ask Grit for guidance any time, and track every run, metric,
        and trend in one place.
      </p>
    </>
  ),
  coachingHeading: "How Grit coaches your running",
  coaching: [
    {
      title: "Paces from your real benchmarks",
      body: "Grit derives your easy, tempo, threshold, and interval paces from a recent race time or threshold effort — not generic tables — then recalibrates as your fitness changes.",
    },
    {
      title: "A review after every run",
      body: "Grit reads your splits, HR distribution, and how the run lined up with the plan, then writes a short review. Ran the tempo too hard? It says so and adjusts.",
    },
    {
      title: "Strength and mobility built in",
      body: "Your block isn't just runs. Grit schedules supporting strength and mobility work to keep your hips, calves, and knees healthy through the build.",
    },
    {
      title: "Periodized to your race date",
      body: "Base, build, peak, and taper phases are sized to the weeks you actually have, with long runs, intervals, and recovery laid out across the cycle.",
    },
    {
      title: "You stay in control",
      body: "Going on vacation, fighting a cold, or feeling strong enough to push? Tell Grit and it reworks your block for you — shifting long runs, easing you back in, or adding load. Every change is a proposal you approve.",
    },
    {
      title: "Record or import any run",
      body: "Track outdoor runs with phone GPS and a Bluetooth HR strap, or import from Apple Health and Health Connect (Coros, Suunto), or GPX/TCX/FIT files exported from Garmin Connect and other watches.",
    },
  ],
  shots: [
    {
      src: "/app_screenshots/program-chat-light.png",
      alt: "Chat with Grit drafting a 14-week half-marathon running plan, ending in a program proposal card.",
      width: 399,
      height: 859,
      eyebrow: "Build your plan",
      caption: "Tell Grit your race and date. It drafts the full block.",
    },
    {
      src: "/app_screenshots/edit-proposal-light.png",
      alt: "Grit proposing a +10s/km bump on Tuesday's threshold intervals after a tempo run's heart rate showed it was too easy.",
      width: 397,
      height: 860,
      eyebrow: "Adapt after each run",
      caption: "Tempo felt easy? Grit checks the HR and proposes a faster session.",
    },
    {
      src: "/app_screenshots/post-workout-review-light.png",
      alt: "A Saturday long-run review from Grit summarising distance, splits, and HR zones with quick-reply chips.",
      width: 431,
      height: 768,
      eyebrow: "Review every session",
      caption: "Effort, splits, HR zones — plus quick replies to keep talking.",
    },
  ],
  highlightsHeading: "Everything a running app should do — plus the coach",
  highlights: [
    {
      title: "GPS + heart rate",
      body: "Route maps for every outdoor run and pairing to any Bluetooth HR strap — no watch required.",
    },
    {
      title: "Import your history",
      body: "Pull in past runs from Apple Health, Health Connect, or files so Grit knows your real training history.",
    },
    {
      title: "Benchmark-driven paces",
      body: "Training zones come from your numbers and update as you get faster.",
    },
    {
      title: "Race periodization",
      body: "Base → build → peak → taper, sized to the weeks before your event.",
    },
    {
      title: "Runner's strength work",
      body: "Supporting strength and mobility scheduled into the plan to keep you injury-free.",
    },
    {
      title: "Free to start",
      body: "Full coach, a complete program, recording, and imports cost nothing.",
    },
  ],
  faqHeading: "AI running coach — FAQ",
  faq,
  closingTitle: "Get a running coach that actually watches your training",
  closingBody:
    "Join the waitlist and be among the first to train with Grit when Gritty Fitness launches on iOS and Android.",
};

export default function AiRunningCoachPage() {
  return (
    <>
      <JsonLd
        data={buildUseCaseJsonLd({
          name: "Gritty Fitness — AI Running Coach",
          url: PAGE_URL,
          description: DESCRIPTION,
          breadcrumbName: "AI Running Coach",
          faq,
        })}
      />
      <UseCaseLanding data={data} />
    </>
  );
}
