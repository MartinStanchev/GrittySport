import { StoreBadges } from "@/components/StoreBadges";

export function FinalCTA() {
  return (
    <section className="py-24 md:py-32 bg-hero-gradient text-white">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="font-display text-4xl md:text-6xl font-bold leading-tight">
          Ready to train smarter?
        </h2>
        <p className="mt-5 text-white/70 text-lg max-w-xl mx-auto">
          Download Gritty Fitness and meet Grit. Free to start, premium when
          you&apos;re ready for more.
        </p>
        <div className="mt-10 flex justify-center">
          <StoreBadges variant="dark" />
        </div>
        <p className="mt-8 text-white/50 text-sm">
          Questions?{" "}
          <a
            href="mailto:hello@grittyfitness.app"
            className="underline hover:text-white"
          >
            hello@grittyfitness.app
          </a>
        </p>
      </div>
    </section>
  );
}
