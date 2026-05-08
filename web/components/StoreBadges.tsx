import Link from "next/link";

type Props = {
  variant?: "light" | "dark";
};

// NOTE: Replace the `href`s with your real App Store / Play Store URLs once published.
// Apple and Google require their official badge artwork in production — these are
// brand-styled stand-ins for the prelaunch landing page.
export function StoreBadges({ variant = "dark" }: Props) {
  const base =
    "flex items-center gap-3 px-5 py-3 rounded-2xl transition border";
  const styles =
    variant === "dark"
      ? "bg-white text-ink border-transparent hover:scale-[1.02]"
      : "bg-ink text-white border-transparent hover:scale-[1.02]";

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Link href="#" aria-label="Download on the App Store" className={`${base} ${styles}`}>
        <AppleIcon />
        <div className="text-left leading-tight">
          <div className="text-[10px] uppercase tracking-wider opacity-70">
            Download on the
          </div>
          <div className="font-display font-semibold text-base">App Store</div>
        </div>
      </Link>
      <Link href="#" aria-label="Get it on Google Play" className={`${base} ${styles}`}>
        <GoogleIcon />
        <div className="text-left leading-tight">
          <div className="text-[10px] uppercase tracking-wider opacity-70">
            Get it on
          </div>
          <div className="font-display font-semibold text-base">Google Play</div>
        </div>
      </Link>
    </div>
  );
}

function AppleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.21-1.12 3.02-.74.86-1.95 1.52-3.05 1.43-.13-1.11.42-2.27 1.1-3.04.78-.88 2.1-1.52 3.07-1.41zM20.5 17.36c-.55 1.27-.81 1.83-1.51 2.95-.99 1.56-2.39 3.51-4.13 3.52-1.55.02-1.95-1.01-4.05-1-2.1.01-2.55 1.02-4.1 1-1.74-.02-3.07-1.78-4.06-3.34C0.31 16.09-.05 11.4 1.91 8.85c1.39-1.81 3.59-2.87 5.65-2.87 2.1 0 3.42 1.04 5.16 1.04 1.69 0 2.72-1.04 5.15-1.04 1.83 0 3.78.99 5.16 2.71-4.55 2.5-3.81 8.99 1.47 8.67z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="22" height="24" viewBox="0 0 22 24" fill="currentColor" aria-hidden="true">
      <path d="M.5 1.84v20.32c0 .53.21 1.02.55 1.39l11.36-11.55L.5.45c-.34.37-.55.85-.55 1.39zM15.84 7.92L4.27.13l11.57 11.87 4.96-2.81c1.4-.79 1.4-2.79 0-3.58l-4.96-2.81-.34 5.12zm0 8.16l-.34-5.12-3.6 3.66 3.94 4 4.96-2.81c1.4-.79 1.4-2.79 0-3.58l-4.96-2.81zM4.27 23.87L15.84 12l-3.6-3.66L4.27 23.87z" />
    </svg>
  );
}
