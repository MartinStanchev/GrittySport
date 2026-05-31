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
    title: "Going on vacation?",
    body: "Tell Grit the dates — it shifts your block and rebuilds the ramp back when you return.",
  },
  {
    title: "Caught a cold?",
    body: "Say the word and Grit pauses your plan, then eases you back in when you're ready.",
  },
  {
    title: "Want to push harder?",
    body: "Ask for more volume or intensity and Grit raises the load safely into next week.",
  },
  {
    title: "Week got busy?",
    body: "Drop to fewer days and Grit reshapes the week around the time you actually have.",
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
            Your plan, your call
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
          <p className="mt-8 text-center text-ink-soft leading-relaxed max-w-2xl mx-auto">
            Just ask — Grit does the rework, and every change is a proposal you
            approve. You stay in control of your own program, and can track every
            activity and your progress along the way.
          </p>
        </div>
      </div>
    </section>
  );
}
