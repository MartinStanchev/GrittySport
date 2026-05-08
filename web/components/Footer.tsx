import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-cream">
      <div className="max-w-6xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center">
            <Logo height={48} />
          </div>
          <p className="mt-3 text-sm text-ink-soft max-w-sm">
            One AI coach for every sport. Personalized training that adapts to
            every workout you log.
          </p>
        </div>

        <div>
          <h4 className="font-display font-semibold text-sm mb-3 text-ink">
            Product
          </h4>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>
              <Link href="/#how" className="hover:text-ink">
                How it works
              </Link>
            </li>
            <li>
              <Link href="/#features" className="hover:text-ink">
                Features
              </Link>
            </li>
            <li>
              <Link href="/#premium" className="hover:text-ink">
                Premium
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="hover:text-ink">
                FAQ
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-display font-semibold text-sm mb-3 text-ink">
            Legal
          </h4>
          <ul className="space-y-2 text-sm text-ink-soft">
            <li>
              <Link href="/impressum" className="hover:text-ink">
                Impressum
              </Link>
            </li>
            <li>
              <Link href="/datenschutz" className="hover:text-ink">
                Datenschutz
              </Link>
            </li>
            <li>
              <Link href="/agb" className="hover:text-ink">
                AGB
              </Link>
            </li>
            <li>
              <a href="mailto:hello@grittyfitness.app" className="hover:text-ink">
                Contact
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-black/5">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-ink-soft flex flex-col md:flex-row gap-2 md:justify-between">
          <span>© {new Date().getFullYear()} Gritty Fitness. All rights reserved.</span>
          <span>Made with care in Germany.</span>
        </div>
      </div>
    </footer>
  );
}
