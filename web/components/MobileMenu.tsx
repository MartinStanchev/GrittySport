"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type NavLink = { href: string; label: string };

export function MobileMenu({
  productLinks,
  useCaseLinks,
  mainLinks,
}: {
  productLinks: NavLink[];
  useCaseLinks: NavLink[];
  mainLinks: NavLink[];
}) {
  const [open, setOpen] = useState(false);

  // Close on Escape and lock background scroll while the panel is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);
  const itemClass = "py-3 border-b border-black/5 hover:text-ink transition";

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="flex items-center justify-center w-10 h-10 -mr-2 text-ink"
      >
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {open ? (
            <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-x-0 top-16 bottom-0 z-40 bg-black/20"
            onClick={close}
            aria-hidden="true"
          />
          <div
            id="mobile-menu"
            className="fixed inset-x-0 top-16 z-50 max-h-[calc(100vh-4rem)] overflow-y-auto bg-white border-b border-black/5 shadow-lg"
          >
            <nav className="px-6 py-2 flex flex-col text-base text-ink-soft">
              {productLinks.map((l) => (
                <Link key={l.href} href={l.href} onClick={close} className={itemClass}>
                  {l.label}
                </Link>
              ))}

              <p className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-soft/70">
                Coaching
              </p>
              {useCaseLinks.map((l) => (
                <Link key={l.href} href={l.href} onClick={close} className={itemClass}>
                  {l.label}
                </Link>
              ))}

              <div className="pt-2 flex flex-col">
                {mainLinks.map((l) => (
                  <Link key={l.href} href={l.href} onClick={close} className={itemClass}>
                    {l.label}
                  </Link>
                ))}
              </div>

              <Link
                href="/#download"
                onClick={close}
                className="my-4 text-center text-sm font-medium px-4 py-3 rounded-full bg-ink text-white hover:bg-brand transition"
              >
                Join the waitlist
              </Link>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
