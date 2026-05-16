import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  title: "Impressum — Gritty Fitness",
  description:
    "Anbieterkennzeichnung gemäß § 5 TMG für Gritty Fitness.",
  alternates: { canonical: "https://grittyfitness.app/impressum" },
  openGraph: {
    title: "Impressum — Gritty Fitness",
    description: "Anbieterkennzeichnung gemäß § 5 TMG für Gritty Fitness.",
    type: "website",
    locale: "de_DE",
    url: "https://grittyfitness.app/impressum",
  },
};

const impressumJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Impressum — Gritty Fitness",
  url: "https://grittyfitness.app/impressum",
  inLanguage: "de",
  isPartOf: {
    "@type": "WebSite",
    name: "Gritty Fitness",
    url: "https://grittyfitness.app",
  },
  description: "Anbieterkennzeichnung gemäß § 5 TMG.",
};

// IMPORTANT: Replace every <span class="placeholder">...</span> with your real
// legal information before going live. Required by § 5 TMG.
export default function ImpressumPage() {
  return (
    <LegalLayout
      title="Impressum"
      subtitle="Angaben gemäß § 5 TMG"
    >
      <JsonLd data={impressumJsonLd} />
      <h2>Anbieter</h2>
      <p>
        <strong><span className="placeholder">[Vollständiger Name / Firmenname]</span></strong>
        <br />
        <span className="placeholder">[Straße und Hausnummer]</span>
        <br />
        <span className="placeholder">[PLZ Ort]</span>
        <br />
        Deutschland
      </p>

      <h2>Kontakt</h2>
      <p>
        Telefon: <span className="placeholder">[+49 ...]</span>
        <br />
        E-Mail: <a href="mailto:hello@grittyfitness.app">hello@grittyfitness.app</a>
      </p>

      <h2>Vertretungsberechtigte Person</h2>
      <p>
        <span className="placeholder">[Name der vertretungsberechtigten Person, falls Firma]</span>
      </p>

      <h2>Registereintrag</h2>
      <p>
        Eintragung im <span className="placeholder">[Handelsregister / Vereinsregister / nicht zutreffend]</span>
        <br />
        Registergericht: <span className="placeholder">[Amtsgericht ...]</span>
        <br />
        Registernummer: <span className="placeholder">[HRB ...]</span>
      </p>

      <h2>Umsatzsteuer-ID</h2>
      <p>
        Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:
        <br />
        <span className="placeholder">[DE ...]</span>
      </p>

      <h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
      <p>
        <span className="placeholder">[Name]</span>
        <br />
        <span className="placeholder">[Anschrift wie oben]</span>
      </p>

      <h2>EU-Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur
        Online-Streitbeilegung (OS) bereit:{" "}
        <a
          href="https://ec.europa.eu/consumers/odr/"
          target="_blank"
          rel="noopener noreferrer"
        >
          https://ec.europa.eu/consumers/odr/
        </a>
        . Unsere E-Mail-Adresse finden Sie oben im Impressum.
      </p>

      <h2>Verbraucherstreitbeilegung / Universalschlichtungsstelle</h2>
      <p>
        Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
        vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte
        auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
        §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht
        verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
        überwachen oder nach Umständen zu forschen, die auf eine
        rechtswidrige Tätigkeit hinweisen.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Unser Angebot enthält Links zu externen Websites Dritter, auf deren
        Inhalte wir keinen Einfluss haben. Deshalb können wir für diese
        fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der
        verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber
        der Seiten verantwortlich.
      </p>

      <h2>Urheberrecht</h2>
      <p>
        Die durch die Seitenbetreiber erstellten Inhalte und Werke auf
        diesen Seiten unterliegen dem deutschen Urheberrecht.
        Vervielfältigung, Bearbeitung, Verbreitung und jede Art der
        Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der
        schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
      </p>
    </LegalLayout>
  );
}
