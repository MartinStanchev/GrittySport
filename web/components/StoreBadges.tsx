/* eslint-disable @next/next/no-img-element -- official brand SVGs from /public; next/image adds no value for pre-sized vector badges */
import Link from "next/link";

// NOTE: Replace the `href`s with your real App Store / Play Store URLs once published.
export function StoreBadges() {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <Link
        href="#"
        aria-label="Download on the App Store"
        className="inline-block transition hover:scale-[1.02]"
      >
        <img
          src="/Download_on_the_App_Store_Badge_US-UK_RGB_blk_092917.svg"
          alt="Download on the App Store"
          className="h-14 w-auto"
        />
      </Link>
      <Link
        href="#"
        aria-label="Get it on Google Play"
        className="inline-block transition hover:scale-[1.02]"
      >
        <img
          src="/GetItOnGooglePlay_Badge_Web_color_English.svg"
          alt="Get it on Google Play"
          className="h-14 w-auto"
        />
      </Link>
    </div>
  );
}
