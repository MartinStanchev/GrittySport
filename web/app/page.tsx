import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Features } from "@/components/sections/Features";
import { Premium } from "@/components/sections/Premium";
import { FAQ } from "@/components/sections/FAQ";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { JsonLd } from "@/components/JsonLd";
import { faqEntries } from "@/components/sections/faq-data";

const SITE_URL = "https://grittyfitness.app";

const softwareApplication = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Gritty Fitness",
  url: SITE_URL,
  operatingSystem: "iOS, Android",
  applicationCategory: "HealthApplication",
  description:
    "AI-powered, multi-sport training plans that adapt to every workout you log — running, cycling, swimming, strength, mobility, and recovery.",
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "EUR",
    },
    {
      "@type": "Offer",
      name: "Premium (monthly)",
      price: "7.99",
      priceCurrency: "EUR",
      billingDuration: "P1M",
    },
    {
      "@type": "Offer",
      name: "Premium (yearly)",
      price: "69",
      priceCurrency: "EUR",
      billingDuration: "P1Y",
    },
  ],
  publisher: { "@type": "Organization", name: "Gritty Fitness" },
};

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Gritty Fitness",
  legalName: "[Provider]",
  url: SITE_URL,
  logo: `${SITE_URL}/logo-mark.png`,
  email: "hello@grittyfitness.app",
  address: {
    "@type": "PostalAddress",
    streetAddress: "[Address]",
    addressLocality: "[City]",
    postalCode: "[PLZ]",
    addressCountry: "DE",
  },
};

const faqPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqEntries.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

export default function Home() {
  return (
    <>
      <JsonLd data={[softwareApplication, organization, faqPage]} />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <Premium />
      <FAQ />
      <FinalCTA />
    </>
  );
}
