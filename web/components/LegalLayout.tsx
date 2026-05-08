import { ReactNode } from "react";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function LegalLayout({ title, subtitle, children }: Props) {
  return (
    <article className="bg-white">
      <header className="bg-paper border-b border-black/5">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <h1 className="font-display text-4xl md:text-5xl font-bold text-ink leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-ink-soft">{subtitle}</p>
          )}
        </div>
      </header>
      <div className="max-w-3xl mx-auto px-6 py-16 prose-legal">
        {children}
      </div>
    </article>
  );
}
