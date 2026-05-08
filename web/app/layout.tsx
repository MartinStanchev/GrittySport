import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gritty Fitness — One AI coach for every sport",
  description:
    "Gritty Fitness is the AI fitness companion that builds and adapts a holistic training plan around you — across running, cycling, swimming, strength, and recovery.",
  metadataBase: new URL("https://grittyfitness.app"),
  openGraph: {
    title: "Gritty Fitness — One AI coach for every sport",
    description:
      "AI-powered, multi-sport training plans that adapt to every workout you log.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
