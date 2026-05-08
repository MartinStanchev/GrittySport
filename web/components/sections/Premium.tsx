import { SectionHeader } from "@/components/SectionHeader";

const tiers = [
  {
    name: "Sharper insights",
    icon: "📊",
    items: [
      "Cardiac efficiency tracking",
      "Sport-specific PRs (distance, swim, strength)",
      "Structured weekly trends",
      "Effort scoring across the week",
    ],
  },
  {
    name: "More coaching",
    icon: "🧠",
    items: [
      "Unlimited chat with Grit",
      "Unlimited active programs",
      "Deeper memory of your preferences",
      "Save unlimited preferences and constraints",
    ],
  },
  {
    name: "Total control",
    icon: "🎛️",
    items: [
      "Configurable weekly effort goals",
      "Advanced workout analytics",
      "Priority for new features",
      "Everything in the free tier",
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
            Gritty Fitness is fully usable for free. Premium adds the metrics
            and customization athletes ask for once they&apos;re training
            seriously.
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
              <ul className="mt-5 space-y-3">
                {t.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 text-sm text-ink-soft"
                  >
                    <span className="mt-0.5 text-brand">✓</span>
                    <span>{item}</span>
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
              Start free, upgrade in-app
            </a>
            <p className="text-white/50 text-xs mt-4">
              Cancel anytime · 7-day free trial · Web checkout coming soon
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
