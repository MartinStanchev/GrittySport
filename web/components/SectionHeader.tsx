import { Eyebrow } from "@/components/Eyebrow";

type Props = {
  eyebrow: string;
  heading: React.ReactNode;
  centered?: boolean;
  children?: React.ReactNode;
};

export function SectionHeader({ eyebrow, heading, centered = false, children }: Props) {
  return (
    <div className={centered ? "text-center max-w-2xl mx-auto" : "max-w-2xl"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-display text-3xl md:text-5xl font-bold mt-3 leading-tight">
        {heading}
      </h2>
      {children}
    </div>
  );
}
