import { SectionHeader } from "@/components/SectionHeader";

const features = [
  {
    icon: "🏃",
    title: "Multi-sport programs",
    body: "Run, ride, swim, lift, mobility — one program, not five apps.",
  },
  {
    icon: "📍",
    title: "Built-in GPS + HR",
    body: "Track outdoor sessions with route maps and connect any Bluetooth heart-rate strap.",
  },
  {
    icon: "🔌",
    title: "Garmin & Apple Health",
    body: "Pull in workouts you've already logged on your watch or in Health.",
  },
  {
    icon: "📂",
    title: "File imports",
    body: "GPX, TCX, FIT, and CSV. Drop in old workouts so Grit knows your history.",
  },
  {
    icon: "💬",
    title: "Chat with Grit",
    body: "Ask questions, propose changes, request a deload — Grit listens and adjusts your plan.",
  },
  {
    icon: "🎯",
    title: "Post-workout reviews",
    body: "Every session gets feedback, not just a green checkmark.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeader
          eyebrow="Everything you need"
          heading="All the basics you'd expect — and a coach behind every screen."
        />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl bg-cream/60 hover:bg-cream transition border border-transparent hover:border-brand/15"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="font-display font-semibold text-lg text-ink mt-4">
                {f.title}
              </h3>
              <p className="mt-1 text-ink-soft leading-relaxed text-sm">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
