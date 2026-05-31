import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { UseCaseLanding, type UseCaseData } from "@/components/UseCaseLanding";
import { SITE_URL, buildUseCaseJsonLd } from "@/lib/seo";

const PAGE_URL = `${SITE_URL}/ai-triathlon-coach/`;
const DESCRIPTION =
  "Gritty is an AI triathlon coach app: one adaptive plan that balances swim, bike, run, and strength around your race date and benchmarks (CSS, FTP, threshold pace), tuned after every session. Free, on iOS and Android.";

export const metadata: Metadata = {
  title: "AI Triathlon Coach App — Swim, Bike, Run in One Plan | Gritty Fitness",
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "AI Triathlon Coach App that balances all three disciplines",
    description:
      "One adaptive triathlon plan across swim, bike, run, and strength — built around your race and tuned after every session.",
    type: "website",
    url: PAGE_URL,
  },
};

const faq = [
  {
    q: "What triathlon distances does it plan for?",
    a: "Sprint, Olympic, and long-course (70.3 / Ironman). You give Grit the race and date, and it sizes a periodized block — base, build, peak, taper — across all three disciplines to fit the weeks you have.",
  },
  {
    q: "Does it really handle all three disciplines in one plan?",
    a: "Yes — that's the core idea. Instead of stitching together a swim app, a bike app, and a run app, Grit holds swim, bike, run, plus supporting strength and mobility in a single program and balances the load across your week.",
  },
  {
    q: "Does it use FTP, CSS, and threshold pace?",
    a: "Yes. Grit asks for your discipline benchmarks during intake — FTP on the bike, CSS in the pool, threshold pace on the run — and prescribes each session in those terms, then recalibrates as your sessions come in.",
  },
  {
    q: "Can I import workouts from my bike computer or Garmin?",
    a: "Yes. Record open-water swims and rides in-app, or import from Apple Health, Health Connect (Garmin, Wahoo, Coros, Suunto, Wear OS), and GPX/TCX/FIT files — including cycling power and cadence — so Grit reviews each session in context.",
  },
  {
    q: "Do I still need a human coach?",
    a: "Grit covers the planning and day-to-day adjustment a coach does — periodization, balancing the three sports, reviewing sessions, and adapting load — at a fraction of the cost. It's a coach, not a medical professional, and every change is a proposal you approve.",
  },
  {
    q: "Is it free?",
    a: "Yes. The coach, a full triathlon program, recording, and imports are free. Premium (€7.99/month or €69/year) adds unlimited chat, a review on every session, parallel programs, and deeper analytics.",
  },
];

const data: UseCaseData = {
  eyebrow: "AI triathlon coach",
  h1: (
    <>
      An AI triathlon coach that balances{" "}
      <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent">
        swim, bike, and run
      </span>
      .
    </>
  ),
  lede: "One adaptive plan across all three disciplines plus strength — built around your race date and benchmarks (CSS, FTP, threshold pace), and tuned after every session.",
  intro: (
    <>
      <h2>Three sports, three apps, no one watching the whole picture</h2>
      <p>
        Most triathletes end up juggling a swim log, a cycling app, and a
        running tracker — none of which knows what the others did. Your bike app
        can&apos;t see that yesterday&apos;s run left your legs cooked, and your
        run app has no idea you swam 3km this morning. Balancing fatigue across
        three disciplines is exactly the part that&apos;s hard to do alone.
      </p>
      <p>
        Gritty is an <strong>AI triathlon coach app</strong> built around a coach
        named Grit. Grit holds swim, bike, run, and supporting strength in one
        periodized plan, prescribes each session in your own benchmarks (CSS,
        FTP, threshold pace), and rebalances the week after every session you
        log. You approve every change — Grit never reshuffles your plan silently.
        And it&apos;s yours to steer: ask Grit for guidance any time, and track
        every swim, ride, and run in one place.
      </p>
    </>
  ),
  coachingHeading: "How Grit coaches your triathlon",
  coaching: [
    {
      title: "One plan across all three disciplines",
      body: "Swim, bike, and run live in a single program with supporting strength and mobility, so the week's total load actually adds up instead of three apps each thinking they own your time.",
    },
    {
      title: "Prescribed in your own benchmarks",
      body: "Sessions are set in FTP on the bike, CSS in the pool, and threshold pace on the run — the numbers you already train by — and recalibrate as you progress.",
    },
    {
      title: "Periodized to your race",
      body: "Base, build, peak, and taper across all three sports, sized to your race date, with brick sessions and key workouts placed where they belong.",
    },
    {
      title: "Reads every session's data",
      body: "Bike power and HR, swim splits, run pace — Grit reviews each one against the plan and rebalances upcoming load when something runs hot or easy.",
    },
    {
      title: "Manages fatigue across sports",
      body: "A hard ride changes what tomorrow's run should be. Grit sees the whole week, so a big day in one discipline adjusts the others.",
    },
    {
      title: "Record or import any discipline",
      body: "Open-water swim and ride GPS in-app, or import rides with power from Garmin, Wahoo, and others via Health Connect, Apple Health, or files.",
    },
    {
      title: "You stay in control",
      body: "Race postponed, picked up a cold, or want a bigger week? Tell Grit and it rebalances all three disciplines for you. Every change is a proposal you approve before it touches your plan.",
    },
  ],
  shots: [
    {
      src: "/app_screenshots/program-chat-light.png",
      alt: "Chat with Grit drafting a triathlon training block, ending in a program proposal card.",
      width: 399,
      height: 859,
      eyebrow: "Build your plan",
      caption: "Tell Grit your race and benchmarks. It drafts all three disciplines.",
    },
    {
      src: "/app_screenshots/program-review-light.png",
      alt: "Full-screen triathlon program review showing phases, weekly structure across swim, bike, and run.",
      width: 395,
      height: 860,
      eyebrow: "See the whole block",
      caption: "The full multi-sport plan as one card — edit any session before saving.",
    },
    {
      src: "/app_screenshots/post-workout-review-light.png",
      alt: "A session review from Grit summarising distance, splits, and HR zones with quick-reply chips.",
      width: 431,
      height: 768,
      eyebrow: "Review every session",
      caption: "Each swim, ride, and run reviewed against the plan.",
    },
  ],
  highlightsHeading: "One coach for the whole triathlon",
  highlights: [
    {
      title: "Swim · bike · run · strength",
      body: "All three disciplines plus supporting work in a single adaptive program.",
    },
    {
      title: "FTP, CSS & threshold pace",
      body: "Sessions prescribed in the benchmarks you already train by.",
    },
    {
      title: "Power & HR imports",
      body: "Pull in rides with power and cadence from Garmin, Wahoo, Apple Health, or files.",
    },
    {
      title: "Race-date periodization",
      body: "Base → build → peak → taper across all three sports, with brick sessions.",
    },
    {
      title: "Whole-week balance",
      body: "Grit adapts each discipline based on the load from the others.",
    },
    {
      title: "Free to start",
      body: "Full coach, a complete triathlon program, recording, and imports cost nothing.",
    },
  ],
  faqHeading: "AI triathlon coach — FAQ",
  faq,
  closingTitle: "Get one coach for swim, bike, and run",
  closingBody:
    "Join the waitlist and be among the first to train with Grit when Gritty Fitness launches on iOS and Android.",
};

export default function AiTriathlonCoachPage() {
  return (
    <>
      <JsonLd
        data={buildUseCaseJsonLd({
          name: "Gritty Fitness — AI Triathlon Coach",
          url: PAGE_URL,
          description: DESCRIPTION,
          breadcrumbName: "AI Triathlon Coach",
          faq,
        })}
      />
      <UseCaseLanding data={data} />
    </>
  );
}
