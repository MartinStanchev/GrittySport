import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/75 border-b border-black/5">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center" aria-label="Gritty Fitness">
          <Logo height={60} />
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-ink-soft">
          <Link href="/#how" className="hover:text-ink transition">
            How it works
          </Link>
          <Link href="/#features" className="hover:text-ink transition">
            Features
          </Link>
          <Link href="/#premium" className="hover:text-ink transition">
            Premium
          </Link>
          <Link href="/#faq" className="hover:text-ink transition">
            FAQ
          </Link>
        </div>
        <Link
          href="/#download"
          className="text-sm font-medium px-4 py-2 rounded-full bg-ink text-white hover:bg-brand transition"
        >
          Get the app
        </Link>
      </nav>
    </header>
  );
}
