import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt =
  "Gritty Fitness — One AI coach for every sport. AI-powered, multi-sport training plans.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Required when next.config.ts has `output: "export"` — emits at build time.
export const dynamic = "force-static";

export default async function Image() {
  const logoData = await readFile(
    join(process.cwd(), "public/logo-icon.png"),
    "base64",
  );
  const logoSrc = `data:image/png;base64,${logoData}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "linear-gradient(135deg, #0E0E1A 0%, #1A1A2E 50%, #5B3FE4 100%)",
          color: "white",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}
        >
          <img src={logoSrc} width={72} height={72} alt="" />
          Gritty Fitness
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: 980,
            }}
          >
            One AI coach for every sport.
          </div>
          <div
            style={{
              fontSize: 32,
              color: "rgba(255,255,255,0.75)",
              maxWidth: 900,
              lineHeight: 1.35,
            }}
          >
            AI-powered, multi-sport training plans that adapt to every workout
            you log.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            color: "rgba(255,255,255,0.65)",
          }}
        >
          <span>Running</span>
          <span>·</span>
          <span>Cycling</span>
          <span>·</span>
          <span>Swimming</span>
          <span>·</span>
          <span>Strength</span>
          <span>·</span>
          <span>Recovery</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
