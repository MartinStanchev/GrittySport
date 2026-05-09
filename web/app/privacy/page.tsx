import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Gritty Fitness",
  description:
    "Information on the processing of personal data pursuant to Art. 13 GDPR.",
};

// IMPORTANT: This is a starter Privacy Policy. Have it reviewed by a lawyer
// or use a generator like https://datenschutz-generator.de/ before going
// live, especially once you add analytics, Stripe, or other processors.
export default function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="Information pursuant to Art. 13 GDPR"
    >
      <h2>1. Controller</h2>
      <p>
        The controller responsible for data processing on this website is:
      </p>
      <p>
        <strong><span className="placeholder">[Name / Company]</span></strong>
        <br />
        <span className="placeholder">[Address]</span>
        <br />
        Email: <a href="mailto:hello@grittyfitness.app">hello@grittyfitness.app</a>
      </p>

      <h2>2. Data collected when visiting this website</h2>
      <p>
        When you access this website, our hosting provider automatically
        processes technical information transmitted by your browser. This
        includes in particular:
      </p>
      <ul>
        <li>IP address (anonymised where possible)</li>
        <li>Date and time of access</li>
        <li>Page accessed and amount of data transferred</li>
        <li>Browser type and operating system</li>
        <li>Referrer URL</li>
      </ul>
      <p>
        This data is evaluated solely to ensure trouble-free operation and to
        improve our offering. The legal basis is Art. 6(1)(f) GDPR (legitimate
        interest).
      </p>

      <h2>3. Hosting</h2>
      <p>
        This website is hosted by <strong>DigitalOcean LLC</strong> in a data
        centre within the European Union. A data processing agreement
        pursuant to Art. 28 GDPR has been concluded with the provider.
      </p>

      <h2>4. Cookies</h2>
      <p>
        This website currently uses <strong>no</strong> cookies or
        comparable tracking technologies that are not strictly technically
        necessary. Should we introduce analytics or marketing technologies
        in the future, we will obtain your consent in advance (Art. 6(1)(a)
        GDPR).
      </p>

      <h2>5. Contact by email</h2>
      <p>
        If you contact us by email, your details will be stored to process
        your request and for any follow-up questions. The legal basis is
        Art. 6(1)(b) GDPR (pre-contractual measures) or Art. 6(1)(f) GDPR
        (legitimate interest in answering your enquiry).
      </p>

      <h2>6. Data processing in the Gritty Fitness app</h2>
      <p>
        The privacy policy published here applies solely to visits to this
        website. Information on which data is processed within the Gritty
        Fitness app can be found in the app store listings and the in-app
        privacy policy. Where the app involves separate processing
        activities, those notices apply in addition.
      </p>

      <h2>7. Recipients and processors</h2>
      <p>
        We share personal data only with the following categories of
        recipients, and only where necessary for the respective purpose:
      </p>
      <ul>
        <li>Hosting provider (DigitalOcean, EU region)</li>
        <li>Email service provider for transactional emails</li>
        <li>
          Payment service providers when you take out a Premium subscription
          (e.g. Stripe, Apple App Store, Google Play)
        </li>
      </ul>

      <h2>8. Your rights</h2>
      <p>
        You have the right at any time to access (Art. 15 GDPR),
        rectification (Art. 16 GDPR), erasure (Art. 17 GDPR), restriction
        of processing (Art. 18 GDPR), data portability (Art. 20 GDPR), and
        objection (Art. 21 GDPR). To exercise your rights, please contact
        the email address above.
      </p>
      <p>
        You also have the right to lodge a complaint with a data protection
        supervisory authority. The competent authority is generally the one
        for your habitual residence or place of work.
      </p>

      <h2>9. Retention period</h2>
      <p>
        Personal data is deleted as soon as the purpose of its processing
        ceases to apply and no statutory retention obligations require
        otherwise.
      </p>

      <h2>10. Changes to this Privacy Policy</h2>
      <p>
        We reserve the right to amend this policy where changes to our
        processing activities or legal requirements make this necessary.
        The current version is always available at this URL.
      </p>

      <p className="text-xs mt-12">
        Last updated: <span className="placeholder">[YYYY-MM-DD]</span>
      </p>
    </LegalLayout>
  );
}
