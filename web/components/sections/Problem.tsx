import { SectionHeader } from "@/components/SectionHeader";

const points = [
  {
    title: "Generic plans don't fit you",
    body:
      "Pre-built training templates ignore your schedule, your recovery, and how today's session actually went.",
  },
  {
    title: "Single-sport apps miss the bigger picture",
    body:
      "Running apps don't know about your strength sessions. Lifting apps don't see your fatigue from yesterday's ride.",
  },
  {
    title: "Spreadsheets and notes don't learn",
    body:
      "Logging is only useful if something acts on the data. Most tools just display numbers and leave the thinking to you.",
  },
];

export function Problem() {
  return (
    <section className="bg-mesh-soft py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeader
          eyebrow="The problem"
          heading="Training apps weren't built for the way you actually train."
        />
        <div className="mt-14 grid md:grid-cols-3 gap-8">
          {points.map((p) => (
            <div key={p.title} className="border-l-2 border-brand/30 pl-5">
              <h3 className="font-display font-semibold text-lg text-ink">
                {p.title}
              </h3>
              <p className="mt-2 text-ink-soft leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
