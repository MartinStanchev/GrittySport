export const SITE_URL = "https://grittyfitness.app";

type FaqItem = { q: string; a: string };

type UseCaseJsonLdArgs = {
  name: string;
  url: string;
  description: string;
  breadcrumbName: string;
  faq: FaqItem[];
};

/**
 * Structured data for a use-case landing page: the product as a
 * SoftwareApplication, a breadcrumb, and the page's FAQ.
 */
export function buildUseCaseJsonLd({
  name,
  url,
  description,
  breadcrumbName,
  faq,
}: UseCaseJsonLdArgs): Record<string, unknown>[] {
  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    url,
    operatingSystem: "iOS, Android",
    applicationCategory: "HealthApplication",
    description,
    offers: [
      { "@type": "Offer", name: "Free", price: "0", priceCurrency: "EUR" },
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
    publisher: { "@type": "Organization", name: "Gritty Fitness", url: SITE_URL },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: breadcrumbName, item: url },
    ],
  };

  const faqPage = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return [softwareApplication, breadcrumb, faqPage];
}
