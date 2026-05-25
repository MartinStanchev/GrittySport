import Image from "next/image";

type AppShotProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  eyebrow?: string;
  priority?: boolean;
};

export function AppShot({
  src,
  alt,
  width,
  height,
  caption,
  eyebrow,
  priority,
}: AppShotProps) {
  return (
    <figure className="flex flex-col items-center">
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-6 bg-gradient-to-br from-brand/15 via-transparent to-teal/10 blur-2xl rounded-[3rem]"
        />
        <div className="relative rounded-[2rem] border border-black/5 bg-paper shadow-[0_18px_40px_-18px_rgba(26,26,46,0.25)] overflow-hidden">
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            className="block w-full h-auto select-none"
          />
        </div>
      </div>
      {(eyebrow || caption) && (
        <figcaption className="mt-4 text-center max-w-[260px]">
          {eyebrow && (
            <div className="text-[10px] uppercase tracking-[0.18em] text-brand font-semibold">
              {eyebrow}
            </div>
          )}
          {caption && (
            <div className="mt-1 text-sm text-ink-soft leading-snug">
              {caption}
            </div>
          )}
        </figcaption>
      )}
    </figure>
  );
}
