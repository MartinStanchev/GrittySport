import { SectionHeader } from "@/components/SectionHeader";

const steps = [
  {
    n: "01",
    title: "Tell Grit your goal",
    body:
      "Marathon PR, first triathlon, getting stronger, staying healthy — Grit asks a few questions and listens.",
  },
  {
    n: "02",
    title: "Get a holistic plan",
    body:
      "One program covering your sport, supporting strength work, mobility, and recovery — sized to your week.",
  },
  {
    n: "03",
    title: "Train and log freely",
    body:
      "Use built-in GPS and HR tracking, import from Apple Health, or files (GPX, TCX, FIT, CSV).",
  },
  {
    n: "04",
    title: "Grit reviews and adapts",
    body:
      "After every workout, Grit checks how it went, asks what you felt, and tunes the next sessions to match.",
  },
];

const adaptations = [
  {
    title: "Missed a week?",
    body: "Grit resets your targets to get you back on track.",
  },
  {
    title: "Slept badly?",
    body: "Grit dials today's session to how you actually feel.",
  },
  {
    title: "Long Sunday hikes?",
    body: "Tell Grit which activities count — he'll plan around them.",
  },
  {
    title: "Feeling extra strong?",
    body: "Push it. Grit banks the gain into next week's progression.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-24 md:py-32 bg-paper">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeader
          eyebrow="How it works"
          heading="A coach that learns your training, not just tracks it."
        />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className="relative bg-white rounded-3xl p-6 border border-brand/10"
            >
              <div className="font-display font-bold text-5xl bg-gradient-to-br from-brand to-teal bg-clip-text text-transparent">
                {s.n}
              </div>
              <h3 className="font-display font-semibold text-lg text-ink mt-4">
                {s.title}
              </h3>
              <p className="mt-2 text-ink-soft leading-relaxed text-sm">
                {s.body}
              </p>
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-brand/30 text-2xl">
                  →
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand/70 text-center">
            And when life happens
          </p>
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {adaptations.map((a) => (
              <div
                key={a.title}
                className="rounded-2xl p-5 border border-brand/10 bg-white/40"
              >
                <h3 className="font-display font-semibold text-base text-ink">
                  {a.title}
                </h3>
                <p className="mt-2 text-ink-soft leading-relaxed text-sm">
                  {a.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
