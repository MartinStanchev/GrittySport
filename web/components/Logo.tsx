import Image from "next/image";

const ASPECT = 1280 / 567;

export function Logo({ height = 80 }: { height?: number }) {
  return (
    <Image
      src="/logo-mark.png"
      alt="Gritty Fitness"
      width={Math.round(height * ASPECT)}
      height={height}
      priority
      className="select-none"
    />
  );
}
