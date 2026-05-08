import { Eyebrow } from "@/components/Eyebrow";

const faqs = [
  {
    q: "What sports does Grit support?",
    a: "Running, cycling, swimming, strength training, mobility, and general fitness — with sport-specific guidance for each. Triathlon and powerlifting are first-class too.",
  },
  {
    q: "Do I need a smartwatch?",
    a: "No. You can record workouts directly in the app with phone GPS and any Bluetooth heart-rate strap, or import from Garmin / Apple Health if you do have a watch.",
  },
  {
    q: "Does it work offline?",
    a: "Yes. The app caches your program and recent workouts so it stays usable without signal. Your data syncs automatically when you reconnect.",
  },
  {
    q: "How is my data handled?",
    a: "Your training data is yours. We store it securely on EU infrastructure, never sell it, and you can export or delete your account at any time. See the Privacy Policy for full details.",
  },
  {
    q: "Can I cancel Premium?",
    a: "Anytime, directly from your app store subscription settings. You keep Premium features until the end of the billing period.",
  },
  {
    q: "What happens when I delete my account?",
    a: "All personal data, workouts, conversations, and program history are permanently deleted within 30 days. You can request an export beforehand.",
  },
];

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
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl bg-white border border-black/5 p-5 open:border-brand/20"
            >
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <span className="font-display font-semibold text-ink">
                  {f.q}
                </span>
                <span className="text-brand text-xl group-open:rotate-45 transition">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-soft leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
