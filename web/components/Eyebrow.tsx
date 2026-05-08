type Props = {
  children: React.ReactNode;
};

export function Eyebrow({ children }: Props) {
  return (
    <span className="text-xs font-semibold uppercase tracking-wider text-brand">
      {children}
    </span>
  );
}
