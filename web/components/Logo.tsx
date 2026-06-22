import Image from "next/image";

const ASPECT = 901 / 351;

export function Logo({ height = 100 }: { height?: number }) {
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
