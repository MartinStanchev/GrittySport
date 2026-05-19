import { SectionHeader } from "@/components/SectionHeader";

type Item = { text: string; contrast?: string };
type Tier = { name: string; icon: string; items: Item[] };

const tiers: Tier[] = [
  {
    name: "See what's working",
    icon: "📊",
    items: [
      {
        text: "Know if your easy runs are actually getting easier — same pace, lower heart rate over time",
      },
      {
        text: "Track PRs across every distance, swim split, and lift — not just one number",
      },
      {
        text: "Tell a real trend from a bad week with structured week-over-week comparisons",
      },
      {
        text: "One weekly effort score that captures how hard you trained, not just hours logged",
      },
    ],
  },
  {
    name: "Coach without limits",
    icon: "🧠",
    items: [
      {
        text: "Talk to Grit whenever — no message cap mid-conversation",
        contrast: "Free: 60 messages / month",
      },
      {
        text: "AI review and adapt on every workout, not just the first few",
        contrast: "Free: 5 reviews / month",
      },
      {
        text: "Run multiple programs in parallel — marathon block + lifting, or in-season + off-season",
        contrast: "Free: 1 active program",
      },
      {
        text: "Build new programs whenever life or your goal changes",
        contrast: "Free: 2 new programs / month",
      },
    ],
  },
  {
    name: "Make it yours",
    icon: "🎛️",
    items: [
      {
        text: "Save every preference and constraint that matters — bad knee, no Tuesdays, target race",
        contrast: "Free: 5 saved preferences",
      },
      {
        text: "Set your own weekly effort target — Grit plans around your real life, not a default",
      },
      {
        text: "Keep unlimited program drafts so you can plan a block before committing",
        contrast: "Free: 3 drafts",
      },
    ],
  },
];

export function Premium() {
  return (
    <section
      id="premium"
      className="py-24 md:py-32 bg-gradient-to-b from-paper to-white"
    >
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeader
          eyebrow="Go further with Premium"
          heading="More signal. More control. Same coach, a deeper relationship."
          centered
        >
          <p className="mt-5 text-ink-soft text-lg">
            Gritty Fitness is fully usable for free. Premium unlocks the
            metrics, conversations, and customization you&apos;ll want once
            you&apos;re training seriously.
          </p>
        </SectionHeader>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <div
              key={t.name}
              className="rounded-3xl p-7 bg-white border border-brand/10 shadow-[0_1px_0_rgba(124,92,252,0.05)]"
            >
              <div className="text-3xl">{t.icon}</div>
              <h3 className="font-display font-semibold text-xl text-ink mt-3">
                {t.name}
              </h3>
              <ul className="mt-5 space-y-4">
                {t.items.map((item) => (
                  <li
                    key={item.text}
                    className="flex items-start gap-3 text-sm text-ink-soft"
                  >
                    <span className="mt-0.5 text-brand shrink-0">✓</span>
                    <div>
                      <p>{item.text}</p>
                      {item.contrast && (
                        <p className="mt-1 text-xs text-ink-soft/60">
                          {item.contrast}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 max-w-xl mx-auto">
          <div className="rounded-3xl p-8 bg-gradient-to-br from-ink to-[#2a2440] text-white text-center">
            <div className="font-display text-sm uppercase tracking-wider text-white/60">
              Premium
            </div>
            <div className="mt-2 flex items-baseline justify-center gap-2">
              <span className="font-display text-5xl font-bold">€7.99</span>
              <span className="text-white/60">/ month</span>
            </div>
            <p className="text-white/70 text-sm mt-2">
              Or €69 / year — save 28%
            </p>
            <a
              href="#download"
              className="inline-block mt-6 px-6 py-3 rounded-full bg-white text-ink font-medium hover:bg-brand-soft transition"
            >
              Join the waitlist
            </a>
            <p className="text-white/50 text-xs mt-4">
              Cancel anytime · Web checkout coming soon
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
