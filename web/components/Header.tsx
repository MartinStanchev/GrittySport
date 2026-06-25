import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MobileMenu } from "@/components/MobileMenu";

// Pages grouped under the "How it works" dropdown — the product-explanation
// content plus the per-sport landing pages (which otherwise only live in the
// footer). Shared with the mobile menu so the link set stays in one place.
export const PRODUCT_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/examples", label: "Examples" },
];

export const USE_CASE_LINKS = [
  { href: "/ai-running-coach", label: "AI running coach" },
  { href: "/ai-strength-coach", label: "AI strength coach" },
  { href: "/ai-triathlon-coach", label: "AI triathlon coach" },
];

export const MAIN_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#premium", label: "Premium" },
  { href: "/learn", label: "Learn" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/75 border-b border-black/5">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Gritty Fitness">
          <Logo height={60} />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-7 text-sm text-ink-soft">
          <div className="relative group">
            <Link
              href="/how-it-works"
              className="flex items-center gap-1 hover:text-ink transition"
              aria-haspopup="true"
            >
              How it works
              <svg
                className="w-3 h-3 mt-px transition-transform group-hover:rotate-180"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            {/* pt-2 bridges the gap so hover doesn't drop between trigger and menu */}
            <div className="absolute left-0 top-full pt-2 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 transition duration-150">
              <div className="min-w-[210px] rounded-xl border border-black/5 bg-white shadow-lg shadow-black/5 py-2">
                {PRODUCT_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block px-4 py-2 text-ink-soft hover:text-ink hover:bg-paper transition"
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="my-1.5 border-t border-black/5" />
                {USE_CASE_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block px-4 py-2 text-ink-soft hover:text-ink hover:bg-paper transition"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          {MAIN_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-ink transition">
              {l.label}
            </Link>
          ))}
        </div>

        {/* Right side: desktop CTA, or hamburger on mobile */}
        <div className="flex items-center gap-2">
          <Link
            href="/#download"
            className="hidden md:inline-block text-sm font-medium px-4 py-2 rounded-full bg-ink text-white hover:bg-brand transition"
          >
            Join the waitlist
          </Link>
          <MobileMenu
            productLinks={PRODUCT_LINKS}
            useCaseLinks={USE_CASE_LINKS}
            mainLinks={MAIN_LINKS}
          />
        </div>
      </nav>
    </header>
  );
}
