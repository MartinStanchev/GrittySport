import { SectionHeader } from "@/components/SectionHeader";

const points = [
  {
    title: "Static plans don't change with you",
    body:
      "Pre-built training templates ignore what happens in your life. A week off or a busy weekend means your targets for next week will be off. Progress too quickly? Static plans can't increase your effort for the next session",
  },
  {
    title: "Single-sport apps miss the bigger picture",
    body:
      "Running apps don't know about your strength sessions. Lifting apps don't see your fatigue from yesterday's ride. Planning around your what you actually do is the key.",
  },
  {
    title: "Spreadsheets and notes don't learn",
    body:
      "Logging is only useful if something acts on the data. Tired of moving data from notes to calculator or your favourite chatbot for advice? Most tools just display numbers and don't act on them.",
  },
  {
    title: "AI advice is only as good as what you remember to type",
    body:
      "Chatbots can't see your last run, your heart rate trends over past months, or your previous lifts during similar sessions. You end up summarizing your own data instead of getting advice on it.",
  },
];

export function Problem() {
  return (
    <section className="bg-mesh-soft py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <SectionHeader
          eyebrow="The problem"
          heading="Training apps don't take into account your life."
        />
        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
