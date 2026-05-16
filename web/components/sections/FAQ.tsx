import { Eyebrow } from "@/components/Eyebrow";
import { faqEntries } from "@/components/sections/faq-data";

export function FAQ() {
  return (
    <section id="faq" className="py-24 md:py-32 bg-cream">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="font-display text-3xl md:text-5xl font-bold mt-3 leading-tight">
            Things people ask before downloading.
          </h2>
        </div>
        <div className="mt-12 space-y-3">
          {faqEntries.map((f) => (
            <details
              key={f.question}
              className="group rounded-2xl bg-white border border-black/5 p-5 open:border-brand/20"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-display font-semibold text-ink">
                  {f.question}
                </span>
                <span className="text-brand text-xl group-open:rotate-45 transition">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-soft leading-relaxed">{f.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
