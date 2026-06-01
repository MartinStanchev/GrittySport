"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { WishlistForm } from "@/components/WishlistForm";

type Panel = {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
};

const GRADIENT_TEXT = "bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent";

const PANELS: Panel[] = [
  {
    eyebrow: "Now in early access",
    title: (
      <>
        One app.<br />
        Every sport.<br />
        <span className={GRADIENT_TEXT}>Built around you.</span>
      </>
    ),
    subtitle:
      "Meet Grit — your AI training partner. One app that allows you to track every sport you're doing. Grit helps adapt your workouts your way. Get started for free. ",
  },
  {
    eyebrow: "Your AI training partner",
    title: (
      <>
        Meet Grit.<br />
        Tracks every session.<br />
        <span className={GRADIENT_TEXT}>Adjusts if needed.</span>
      </>
    ),
    subtitle:
      "Tell Grit how today felt. He reads your pace, heart rate, and effort — then proposes the change you can accept in one tap.",
  },
  {
    eyebrow: "Every metric, every insight",
    title: (
      <>
        Real data.<br />
        Real progress.<br />
        <span className={GRADIENT_TEXT}>Grit notices.</span>
      </>
    ),
    subtitle:
      "Everything you log is charted and turned into smarter sessions next week. Your effort is what counts. Your recovery and progress aren't static. Real progress is not done with static programs.",
  },
];

type PanelTextProps = {
  panel: Panel;
  progress: number;
  index: number;
  containerClassName: string;
  titleClassName: string;
  subtitleClassName: string;
};

function PanelText({
  panel,
  progress,
  index,
  containerClassName,
  titleClassName,
  subtitleClassName,
}: PanelTextProps) {
  return (
    <div className={`absolute inset-0 ${containerClassName}`} style={panelStyle(progress, index)}>
      <EyebrowBadge text={panel.eyebrow} />
      <h1 className={titleClassName}>{panel.title}</h1>
      <p className={subtitleClassName}>{panel.subtitle}</p>
    </div>
  );
}

function EyebrowBadge({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/10 border border-white/15 mb-6">
      <span className="w-1.5 h-1.5 rounded-full bg-teal" />
      {text}
    </span>
  );
}

function PhoneGlowWrapper({ children, scale = 1 }: { children: ReactNode; scale?: number }) {
  const phone = (
    <div className="relative">
      <div className="absolute -inset-8 bg-gradient-to-br from-brand/30 to-teal/20 blur-3xl rounded-full" />
      <PhoneFrame>{children}</PhoneFrame>
    </div>
  );
  if (scale === 1) return phone;
  // Scale the 300×600 frame down (e.g. for mobile) while collapsing its layout
  // footprint to the scaled size so it stacks neatly under the title.
  return (
    <div className="relative" style={{ width: 300 * scale, height: 600 * scale }}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
        {phone}
      </div>
    </div>
  );
}

function DownloadBlock() {
  return (
    <div>
      <WishlistForm />
      <p className="mt-4 text-sm text-white/55">
        Launching soon · Be the first to know
      </p>
    </div>
  );
}

const SEGMENT = 1 / (PANELS.length - 1);
const SLIDE_PX = 36;
// How far the 300×600 phone mockup is scaled down in the mobile hero so the
// title, phone, and waitlist form all fit inside one pinned viewport.
const MOBILE_SCALE = 0.52;
// Width of the crossfade band, as a fraction of a segment. Smaller = sharper hand-off,
// less time spent visibly in-between two panels.
const FADE_BAND = 0.25;

function smoothstep(t: number) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function panelStyle(progress: number, i: number): React.CSSProperties {
  const offset = progress - i * SEGMENT;
  // |offset|/SEGMENT runs 0..1 across a segment. Stay fully opaque until the band edge,
  // then fade across FADE_BAND, then stay invisible.
  const dist = Math.abs(offset) / SEGMENT;
  const fadeStart = (1 - FADE_BAND) / 2; // when opacity starts dropping below 1
  const fadeEnd = fadeStart + FADE_BAND; // when opacity reaches 0
  const t = 1 - (dist - fadeStart) / FADE_BAND;
  const opacity = smoothstep(dist <= fadeStart ? 1 : dist >= fadeEnd ? 0 : t);
  return {
    opacity,
    transform: `translate3d(0, ${(-offset / SEGMENT) * SLIDE_PX}px, 0)`,
  };
}

export function Hero() {
  const [progress, setProgress] = useState(0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      ticking = false;
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const scrolled = Math.max(0, Math.min(total, -rect.top));
      setProgress(scrolled / total);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const activeIdx = Math.min(
    PANELS.length - 1,
    Math.max(0, Math.round(progress * (PANELS.length - 1))),
  );

  // The cross-fading phone screens — shared between the desktop and mobile
  // layouts (only one of the two is ever visible at a given breakpoint).
  const phoneScreens = PANELS.map((_, i) => (
    <div key={i} className="absolute inset-0" style={panelStyle(progress, i)}>
      <PanelScreen index={i} />
    </div>
  ));

  return (
    <section id="download" className="bg-hero-gradient text-white relative overflow-x-clip">
      <div ref={wrapperRef} className="relative" style={{ height: "300vh" }}>
        {/* Snap targets so the page locks onto each panel's center on scroll-end */}
        {PANELS.map((_, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-x-0 h-1 snap-start pointer-events-none"
            style={{ top: `${i * 100}vh` }}
          />
        ))}

        <div className="sticky top-0 h-screen overflow-hidden">
          {/* Desktop: title + phone side by side */}
          <div className="hidden lg:flex h-full items-center pt-16">
            <div className="max-w-6xl mx-auto px-6 grid grid-cols-12 gap-12 items-center w-full">
              <div className="col-span-7">
                <div className="relative min-h-[460px]">
                  {PANELS.map((p, i) => (
                    <PanelText
                      key={i}
                      panel={p}
                      progress={progress}
                      index={i}
                      containerClassName=""
                      titleClassName="font-display text-5xl xl:text-7xl font-bold leading-[1.05] tracking-tight"
                      subtitleClassName="mt-6 text-lg xl:text-xl text-white/75 max-w-xl"
                    />
                  ))}
                </div>

                <div className="mt-8">
                  <DownloadBlock />
                </div>

                <StepDots activeIdx={activeIdx} className="mt-8" />
              </div>

              <div className="col-span-5 flex justify-end">
                <PhoneGlowWrapper>{phoneScreens}</PhoneGlowWrapper>
              </div>
            </div>
          </div>

          {/* Mobile: title above a scaled phone, both cross-fading on scroll */}
          <div className="flex lg:hidden h-full flex-col items-center justify-between px-6 pt-16 pb-6 text-center">
            <div className="relative w-full min-h-[168px]">
              {PANELS.map((p, i) => (
                <PanelText
                  key={i}
                  panel={p}
                  progress={progress}
                  index={i}
                  containerClassName="flex flex-col items-center"
                  titleClassName="font-display text-[1.75rem] sm:text-4xl font-bold leading-[1.1] tracking-tight"
                  subtitleClassName="mt-3 text-sm text-white/70 max-w-md line-clamp-2"
                />
              ))}
            </div>

            <PhoneGlowWrapper scale={MOBILE_SCALE}>{phoneScreens}</PhoneGlowWrapper>

            <div className="w-full flex flex-col items-center gap-4">
              <StepDots activeIdx={activeIdx} />
              <DownloadBlock />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StepDots({ activeIdx, className = "" }: { activeIdx: number; className?: string }) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {PANELS.map((_, i) => (
        <span
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ease-out ${
            activeIdx === i ? "w-8 bg-brand" : "w-1.5 bg-white/25"
          }`}
        />
      ))}
    </div>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[300px] h-[600px] rounded-[3rem] bg-gradient-to-b from-[#1f1e2a] to-[#12121d] border-[10px] border-[#0a0a14] shadow-2xl overflow-hidden">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full z-10" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

function PanelScreen({ index }: { index: number }) {
  if (index === 0) return <PhoneHome />;
  if (index === 1) return <PhoneChat />;
  return <PhoneSummary />;
}

// ─── Panel 1: Home screen ────────────────────────────────────────────

type UpcomingRow = {
  icon: string;
  colorClass: string;
  title: string;
  detail: string;
};

function UpcomingActivityRow({ icon, colorClass, title, detail }: UpcomingRow) {
  return (
    <div className="rounded-xl p-3 bg-white/5 border border-white/10 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg ${colorClass} flex items-center justify-center text-sm`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-white text-xs font-medium">{title}</div>
        <div className="text-white/50 text-[10px]">{detail}</div>
      </div>
    </div>
  );
}

function PhoneHome() {
  return (
    <div className="px-5 pt-12 pb-6 h-full flex flex-col gap-3">
      <div className="pt-2">
        <div className="text-[10px] uppercase tracking-[0.15em] text-brand font-semibold">
          Gritty Fitness
        </div>
        <div className="font-display text-white text-xl font-semibold mt-1">Good morning, Sam</div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-white/40 font-medium mt-0.5">
          Ready for the grind?
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
          <div className="text-white text-base font-semibold font-display">4</div>
          <div className="text-[9px] uppercase tracking-wider text-white/45">Workouts</div>
        </div>
        <div className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2">
          <div className="text-white text-base font-semibold font-display">4d</div>
          <div className="text-[9px] uppercase tracking-wider text-white/45">Streak</div>
        </div>
      </div>

      <div className="rounded-2xl p-4 bg-gradient-to-br from-brand/30 to-brand/5 border border-brand/30">
        <div className="text-[10px] uppercase tracking-wider text-brand font-semibold">
          Today · Run
        </div>
        <div className="font-display text-white text-lg font-semibold mt-1">5 × 1000m intervals</div>
        <div className="text-white/60 text-xs mt-1">Threshold pace · 28 min</div>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-brand to-teal" />
          </div>
          <span className="text-[10px] text-white/50">RPE 7</span>
        </div>
      </div>

      <UpcomingActivityRow
        icon="💪"
        colorClass="bg-orange/20 text-orange"
        title="Lower body strength"
        detail="Tomorrow · 45 min"
      />
      <UpcomingActivityRow
        icon="⚡"
        colorClass="bg-teal/20 text-teal"
        title="Mobility · 15 min"
        detail="Tomorrow · evening"
      />
    </div>
  );
}

// ─── Panel 2: Grit chat with edit proposal ──────────────────────────

function PhoneChat() {
  return (
    <div className="h-full flex flex-col">
      <div className="pt-3 px-4 pb-3 flex items-center gap-2.5 border-b border-white/5">
        <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center font-display font-semibold text-white text-sm">
          G
        </div>
        <div className="flex-1">
          <div className="font-display text-white text-sm font-semibold">Grit</div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-white/45">Online</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-3 py-3 flex flex-col gap-2">
        <div className="self-end max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-3 py-2">
          <div className="text-white text-[11px] leading-snug">
            Today&apos;s pace felt easy — could we bump up the speed for the next one?
          </div>
        </div>

        <div className="self-start max-w-[85%] rounded-2xl rounded-bl-sm bg-white/[0.06] border border-white/10 px-3 py-2">
          <div className="text-[9px] uppercase tracking-wider text-brand font-semibold mb-1">Grit</div>
          <div className="text-white/85 text-[11px] leading-snug">
            Good call — your HR averaged Z2 the whole way. I&apos;ll bump the threshold reps up 10s/km.
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 mt-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand/20 flex items-center justify-center text-brand text-xs">
              🛠
            </div>
            <div className="font-display text-white text-[11px] font-semibold">Program Adjustment</div>
          </div>

          <div className="text-white/70 text-[10px] mt-2 leading-snug">
            Bump threshold pace 10s/km faster on Tuesday&apos;s intervals.
          </div>

          <div className="mt-2 rounded-lg border border-white/10 p-2">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[8px] tracking-wider font-semibold text-amber-400">UPDATING</span>
              <span className="text-[8px] text-white/45 ml-auto">TUE</span>
            </div>
            <div className="flex items-center gap-2 opacity-55">
              <div className="w-5 h-5 rounded bg-rose-400/20 flex items-center justify-center text-[9px]">🏃</div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[10px] line-through truncate">Run · 5 × 1000m</div>
                <div className="text-white/50 text-[9px] line-through truncate">4:50/km · RPE 7</div>
              </div>
            </div>
            <div className="text-center text-white/40 text-[10px] my-0.5">↓</div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-emerald-400/20 flex items-center justify-center text-[9px]">🏃</div>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[10px] truncate">Run · 5 × 1000m</div>
                <div className="text-white/65 text-[9px] truncate">4:40/km · RPE 8</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2.5">
            <button className="flex-1 rounded-lg bg-brand text-white text-[10px] font-semibold py-2">
              Apply Changes
            </button>
            <button className="flex-1 text-white/55 text-[10px] font-medium py-2">
              Let&apos;s Discuss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel 3: Workout summary with metrics ──────────────────────────

function PhoneSummary() {
  return (
    <div className="px-5 pt-12 pb-6 h-full flex flex-col gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-teal font-semibold">
          Tuesday · Morning Run
        </div>
        <div className="font-display text-white text-lg font-semibold mt-0.5">5 × 1000m intervals</div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat value="8.4" unit="km" label="Distance" />
        <Stat value="42:18" unit="" label="Time" />
        <Stat value="5:02" unit="/km" label="Avg pace" />
      </div>

      <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0e1220] h-20 relative">
        <svg viewBox="0 0 240 80" className="w-full h-full">
          <defs>
            <linearGradient id="route" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7C5CFC" />
              <stop offset="100%" stopColor="#0EA5B0" />
            </linearGradient>
          </defs>
          <path
            d="M10 60 Q 40 20 70 40 T 130 30 T 180 50 T 230 25"
            fill="none"
            stroke="url(#route)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="10" cy="60" r="3" fill="#7C5CFC" />
          <circle cx="230" cy="25" r="3" fill="#0EA5B0" />
        </svg>
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-white/55 font-semibold">
            Effort score
          </span>
          <span className="text-white font-display font-semibold text-sm">82 / 100</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full w-[82%] bg-gradient-to-r from-teal via-brand to-orange" />
        </div>
        <div className="text-white/55 text-[10px] mt-1.5">
          Strong session — held threshold across all reps.
        </div>
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-3">
        <div className="text-[10px] uppercase tracking-wider text-white/55 font-semibold mb-2">
          HR zones
        </div>
        <div className="flex h-3 rounded overflow-hidden gap-px">
          <div className="bg-sky-400/70" style={{ width: "8%" }} />
          <div className="bg-emerald-400/70" style={{ width: "22%" }} />
          <div className="bg-amber-400/80" style={{ width: "38%" }} />
          <div className="bg-orange/80" style={{ width: "26%" }} />
          <div className="bg-rose-500/80" style={{ width: "6%" }} />
        </div>
        <div className="flex justify-between text-[9px] text-white/45 mt-1.5">
          <span>Z1</span><span>Z2</span><span>Z3</span><span>Z4</span><span>Z5</span>
        </div>
      </div>

      <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
        <div className="text-[10px] uppercase tracking-wider text-white/55 font-semibold mb-1.5">
          Splits
        </div>
        <div className="space-y-0.5">
          {[
            { km: 1, pace: "5:14" },
            { km: 2, pace: "4:58" },
            { km: 3, pace: "4:51" },
          ].map((s) => (
            <div key={s.km} className="flex items-center gap-2 text-[10px]">
              <span className="text-white/55 w-6">km {s.km}</span>
              <span className="text-white flex-1 font-medium">{s.pace}</span>
              <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-brand to-teal" style={{ width: `${50 + s.km * 12}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 text-center">
      <div className="font-display text-white text-base font-semibold leading-tight">
        {value}
        {unit && <span className="text-white/55 text-[10px] font-medium ml-0.5">{unit}</span>}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-white/45 mt-0.5">{label}</div>
    </div>
  );
}
