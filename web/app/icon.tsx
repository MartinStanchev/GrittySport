import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";
// Required when next.config.ts has `output: "export"` — emits at build time.
export const dynamic = "force-static";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7C5CFC, #0EA5B0)",
          color: "white",
          fontSize: 22,
          fontWeight: 900,
          fontFamily: "system-ui, sans-serif",
          letterSpacing: "-0.02em",
          borderRadius: 6,
        }}
      >
        G
      </div>
    ),
    { ...size },
  );
}
