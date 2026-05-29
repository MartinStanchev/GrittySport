import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Terms of Service — Gritty Fitness",
  description:
    "Terms of Service governing use of the Gritty Fitness app, the AI coaching features, and the Premium subscription.",
  alternates: { canonical: "https://grittyfitness.app/terms/" },
  openGraph: {
    title: "Terms of Service — Gritty Fitness",
    description:
      "Terms governing use of the Gritty Fitness app and Premium subscription.",
    type: "website",
    url: "https://grittyfitness.app/terms/",
  },
};

const termsJsonLd = {
  "@context": "https://schema.org",
  "@type": "TermsOfService",
  name: "Gritty Fitness Terms of Service",
  url: "https://grittyfitness.app/terms/",
  inLanguage: "en",
  isPartOf: {
    "@type": "WebSite",
    name: "Gritty Fitness",
    url: "https://grittyfitness.app",
  },
  description:
    "Conditions governing the use of the Gritty Fitness app and Premium subscription.",
};

// IMPORTANT: This is a placeholder skeleton. Once you sell Premium via the web
// (Stripe), have these terms reviewed by a lawyer for B2C compliance — in the
// EU this includes the Right of Withdrawal and the "Buy now" labelling rule.
export default function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="Conditions for using Gritty Fitness"
    >
      <JsonLd data={termsJsonLd} />
      <h2>1. Scope</h2>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) apply to all contracts
        between{" "}
        <strong><span className="placeholder">[Provider]</span></strong>{" "}
        (hereinafter &ldquo;Provider&rdquo;) and the users of the
        &ldquo;Gritty Fitness&rdquo; mobile application and its associated
        website.
      </p>

      <h2>2. Subject of the contract</h2>
      <p>
        The Provider offers a mobile application that uses an AI-powered
        training assistant to create personalized training plans, record
        workouts, and provide analytics. The app is available in a free
        basic version and a paid Premium version.
      </p>

      <h2>3. Conclusion of contract</h2>
      <p>
        The contract for the use of the free basic version is concluded upon
        registration in the app. Premium subscriptions are purchased through
        the respective app stores (Apple App Store, Google Play); their
        terms apply additionally. As soon as Premium is also available via
        this website, the contract is concluded upon confirmation by the
        payment service provider.
      </p>

      <h2>4. Scope of services</h2>
      <ul>
        <li>
          The free basic version comprises the features marked as
          &ldquo;free&rdquo; in the current feature set.
        </li>
        <li>
          The Premium subscription unlocks additional features, the current
          scope of which is described in the app and on the website.
        </li>
        <li>
          The Provider is entitled to further develop and adapt the feature
          set within the limits of applicable law.
        </li>
      </ul>

      <h2>5. Prices and payment</h2>
      <p>
        The applicable prices for Premium subscriptions are shown in the app
        and on the website. Billing is handled by the chosen payment service
        provider. All prices are final prices including any applicable VAT.
      </p>

      <h2>6. Term and termination</h2>
      <p>
        Premium subscriptions are concluded for the chosen term and renew
        automatically unless cancelled in advance. Cancellation is performed
        via the respective payment service provider or the app store
        settings. The statutory right to terminate for cause remains
        unaffected.
      </p>

      <h2>7. Right of withdrawal for consumers</h2>
      <p>
        Consumers in the EU generally have a right of withdrawal. For digital
        content, the right of withdrawal expires once the Provider has begun
        performance after the consumer has expressly agreed and confirmed
        their knowledge that this terminates the right of withdrawal. The
        full withdrawal instructions are provided before the contractual
        declaration is submitted.
      </p>

      <h2>8. User obligations</h2>
      <p>
        The user is obliged to keep their access credentials confidential
        and to use the app only within the bounds of applicable law. Abusive
        use, the transmission of unlawful content, and the automated
        querying of the app&apos;s functions are prohibited.
      </p>

      <h2>9. Note on training recommendations</h2>
      <p>
        The training recommendations provided by the AI feature do not
        replace individual medical or physiotherapeutic advice. Before
        starting a new training program we recommend a medical check-up,
        especially in case of pre-existing conditions.
      </p>

      <h2>10. Liability</h2>
      <p>
        The Provider is liable without limitation for intent and gross
        negligence. For ordinary negligence, liability is limited to the
        foreseeable damage typical of the contract and only applies in the
        event of a breach of essential contractual obligations.
      </p>

      <h2>11. Final provisions</h2>
      <p>
        German law applies, excluding the UN Convention on Contracts for
        the International Sale of Goods. Should individual provisions of
        these Terms be invalid, the validity of the remaining provisions
        shall remain unaffected.
      </p>

      <p className="text-xs mt-12">
        Last updated: <span className="placeholder">[YYYY-MM-DD]</span>
      </p>
    </LegalLayout>
  );
}
