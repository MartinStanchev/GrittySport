import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Datenschutzerklärung — Gritty Fitness",
  description:
    "Informationen zur Verarbeitung personenbezogener Daten gemäß Art. 13 DSGVO.",
};

// IMPORTANT: This is a starter Datenschutzerklärung. Have it reviewed by a
// lawyer or use a generator like https://datenschutz-generator.de/ before
// going live, especially once you add analytics, Stripe, or other processors.
export default function DatenschutzPage() {
  return (
    <LegalLayout
      title="Datenschutzerklärung"
      subtitle="Informationen gemäß Art. 13 DSGVO"
    >
      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Datenverarbeitung auf dieser Website ist:
      </p>
      <p>
        <strong><span className="placeholder">[Name / Firma]</span></strong>
        <br />
        <span className="placeholder">[Anschrift]</span>
        <br />
        E-Mail: <a href="mailto:hello@grittyfitness.app">hello@grittyfitness.app</a>
      </p>

      <h2>2. Erhebung und Verarbeitung von Daten beim Besuch der Website</h2>
      <p>
        Beim Aufruf dieser Website werden durch unseren Hosting-Provider
        automatisch technische Informationen verarbeitet, die Ihr Browser
        übermittelt. Dies umfasst insbesondere:
      </p>
      <ul>
        <li>IP-Adresse (anonymisiert verarbeitet, soweit möglich)</li>
        <li>Datum und Uhrzeit des Zugriffs</li>
        <li>Aufgerufene Seite und übertragene Datenmenge</li>
        <li>Browsertyp und Betriebssystem</li>
        <li>Referrer-URL</li>
      </ul>
      <p>
        Diese Daten werden ausschließlich zur Sicherstellung eines
        störungsfreien Betriebs sowie zur Verbesserung unseres Angebots
        ausgewertet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse).
      </p>

      <h2>3. Hosting</h2>
      <p>
        Diese Website wird gehostet bei{" "}
        <strong>DigitalOcean LLC</strong> in einem Rechenzentrum in der
        Europäischen Union. Mit dem Anbieter wurde ein Vertrag zur
        Auftragsverarbeitung gemäß Art. 28 DSGVO geschlossen.
      </p>

      <h2>4. Cookies</h2>
      <p>
        Diese Website verwendet derzeit <strong>keine</strong> Cookies oder
        vergleichbare Tracking-Technologien, die nicht technisch zwingend
        erforderlich sind. Sollten zukünftig Analyse- oder
        Marketing-Technologien eingesetzt werden, holen wir vorab Ihre
        Einwilligung ein (Art. 6 Abs. 1 lit. a DSGVO, § 25 TTDSG).
      </p>

      <h2>5. Kontaktaufnahme per E-Mail</h2>
      <p>
        Wenn Sie uns per E-Mail kontaktieren, werden Ihre Angaben zur
        Bearbeitung der Anfrage und für den Fall von Anschlussfragen
        gespeichert. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
        (vorvertragliche Maßnahmen) bzw. Art. 6 Abs. 1 lit. f DSGVO
        (berechtigtes Interesse an der Beantwortung Ihres Anliegens).
      </p>

      <h2>6. Verarbeitung von Daten in der Gritty-Fitness-App</h2>
      <p>
        Die hier veröffentlichte Datenschutzerklärung bezieht sich
        ausschließlich auf den Besuch dieser Website. Welche Daten in der
        Gritty-Fitness-App verarbeitet werden, finden Sie in den
        App-Store-Einträgen sowie der In-App-Datenschutzerklärung. Soweit es
        sich dort um eigenständige Verarbeitungsvorgänge handelt, gelten
        diese ergänzend.
      </p>

      <h2>7. Empfänger und Auftragsverarbeiter</h2>
      <p>
        Wir geben personenbezogene Daten nur an folgende Kategorien von
        Empfängern weiter, soweit dies für den jeweiligen Zweck erforderlich
        ist:
      </p>
      <ul>
        <li>Hosting-Provider (DigitalOcean, EU-Region)</li>
        <li>E-Mail-Dienstleister für Transaktions-E-Mails</li>
        <li>
          Zahlungsdienstleister bei Abschluss eines Premium-Abonnements
          (z.&nbsp;B. Stripe, Apple App Store, Google Play)
        </li>
      </ul>

      <h2>8. Ihre Rechte</h2>
      <p>
        Sie haben jederzeit das Recht auf Auskunft (Art. 15 DSGVO),
        Berichtigung (Art. 16 DSGVO), Löschung (Art. 17 DSGVO),
        Einschränkung der Verarbeitung (Art. 18 DSGVO), Datenübertragbarkeit
        (Art. 20 DSGVO) und Widerspruch (Art. 21 DSGVO). Wenden Sie sich zur
        Ausübung Ihrer Rechte an die oben genannte E-Mail-Adresse.
      </p>
      <p>
        Sie haben außerdem das Recht, sich bei einer
        Datenschutz-Aufsichtsbehörde zu beschweren. Zuständig ist in der
        Regel die Aufsichtsbehörde Ihres üblichen Aufenthaltsortes oder Ihres
        Arbeitsplatzes.
      </p>

      <h2>9. Speicherdauer</h2>
      <p>
        Personenbezogene Daten werden gelöscht, sobald der Zweck ihrer
        Verarbeitung entfällt und keine gesetzlichen Aufbewahrungspflichten
        entgegenstehen.
      </p>

      <h2>10. Änderungen dieser Datenschutzerklärung</h2>
      <p>
        Wir behalten uns vor, diese Erklärung anzupassen, soweit
        Änderungen unserer Verarbeitungstätigkeiten oder gesetzliche
        Vorgaben dies erforderlich machen. Die jeweils aktuelle Fassung ist
        stets unter dieser URL abrufbar.
      </p>

      <p className="text-xs mt-12">
        Stand: <span className="placeholder">[TT.MM.JJJJ]</span>
      </p>
    </LegalLayout>
  );
}
