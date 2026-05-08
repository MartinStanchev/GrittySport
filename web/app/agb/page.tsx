import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "AGB — Gritty Fitness",
  description:
    "Allgemeine Geschäftsbedingungen für die Nutzung der Gritty-Fitness-App und der Premium-Abonnements.",
};

// IMPORTANT: This is a placeholder skeleton. Once you sell Premium via the web
// (Stripe), have these AGB reviewed by a lawyer for B2C compliance, including
// Widerrufsrecht (§§ 312g, 355 BGB) and the Schaltflächengestaltung
// ("Buttonlösung", § 312j BGB).
export default function AGBPage() {
  return (
    <LegalLayout
      title="Allgemeine Geschäftsbedingungen"
      subtitle="Bedingungen für die Nutzung von Gritty Fitness"
    >
      <h2>§ 1 Geltungsbereich</h2>
      <p>
        Diese Allgemeinen Geschäftsbedingungen (&bdquo;AGB&ldquo;) gelten für
        alle Verträge zwischen{" "}
        <strong><span className="placeholder">[Anbieter]</span></strong>{" "}
        (nachfolgend &bdquo;Anbieter&ldquo;) und den Nutzern der mobilen
        Anwendung &bdquo;Gritty Fitness&ldquo; sowie der zugehörigen
        Webseite.
      </p>

      <h2>§ 2 Vertragsgegenstand</h2>
      <p>
        Der Anbieter stellt eine mobile Anwendung zur Verfügung, die mithilfe
        eines KI-gestützten Trainingsassistenten personalisierte
        Trainingspläne erstellt, Workouts erfasst und Auswertungen
        bereitstellt. Die App ist in einer kostenlosen Basisversion sowie
        einer kostenpflichtigen Premium-Version verfügbar.
      </p>

      <h2>§ 3 Vertragsschluss</h2>
      <p>
        Der Vertrag über die Nutzung der kostenlosen Basisversion kommt mit
        der Registrierung in der App zustande. Premium-Abonnements werden
        über die jeweiligen App-Stores (Apple App Store, Google Play)
        abgeschlossen; insoweit gelten ergänzend deren Bedingungen. Sobald
        Premium auch über diese Webseite verfügbar ist, kommt der Vertrag
        mit Bestätigung durch den Zahlungsdienstleister zustande.
      </p>

      <h2>§ 4 Leistungsumfang</h2>
      <ul>
        <li>
          Die kostenlose Basisversion umfasst die im jeweils aktuellen
          Funktionsumfang als &bdquo;frei&ldquo; gekennzeichneten Funktionen.
        </li>
        <li>
          Das Premium-Abonnement schaltet zusätzliche Funktionen frei, deren
          jeweils aktueller Umfang in der App und auf der Webseite
          beschrieben ist.
        </li>
        <li>
          Der Anbieter ist berechtigt, den Funktionsumfang im Rahmen der
          gesetzlichen Zulässigkeit weiterzuentwickeln und anzupassen.
        </li>
      </ul>

      <h2>§ 5 Preise und Zahlung</h2>
      <p>
        Die jeweils geltenden Preise für Premium-Abonnements sind in der App
        bzw. auf der Webseite ausgewiesen. Die Abrechnung erfolgt über den
        gewählten Zahlungsdienstleister. Sämtliche Preise verstehen sich als
        Endpreise inklusive der gesetzlichen Umsatzsteuer.
      </p>

      <h2>§ 6 Laufzeit und Kündigung</h2>
      <p>
        Premium-Abonnements werden für die jeweils gewählte Laufzeit
        abgeschlossen und verlängern sich automatisch, sofern nicht zuvor
        gekündigt wird. Die Kündigung erfolgt über den jeweiligen
        Zahlungsdienstleister bzw. die App-Store-Einstellungen. Das
        gesetzliche Recht zur Kündigung aus wichtigem Grund bleibt
        unberührt.
      </p>

      <h2>§ 7 Widerrufsrecht für Verbraucher</h2>
      <p>
        Verbraucher haben grundsätzlich ein Widerrufsrecht. Bei digitalen
        Inhalten erlischt das Widerrufsrecht, wenn der Anbieter mit der
        Ausführung des Vertrags begonnen hat, nachdem der Verbraucher
        ausdrücklich zugestimmt und seine Kenntnis vom Erlöschen des
        Widerrufsrechts bestätigt hat. Die vollständige Widerrufsbelehrung
        wird vor Abgabe der Vertragserklärung zur Verfügung gestellt.
      </p>

      <h2>§ 8 Pflichten des Nutzers</h2>
      <p>
        Der Nutzer ist verpflichtet, seine Zugangsdaten geheim zu halten
        und die App ausschließlich im Rahmen der geltenden Gesetze zu
        nutzen. Eine missbräuchliche Nutzung, die Übermittlung
        rechtswidriger Inhalte sowie die automatisierte Abfrage der
        App-Funktionen sind untersagt.
      </p>

      <h2>§ 9 Hinweis zu Trainingsempfehlungen</h2>
      <p>
        Die durch die KI-Funktion bereitgestellten Trainingsempfehlungen
        ersetzen keine individuelle ärztliche oder physiotherapeutische
        Beratung. Vor Beginn eines neuen Trainingsprogramms wird empfohlen,
        eine ärztliche Abklärung durchführen zu lassen, insbesondere bei
        Vorerkrankungen.
      </p>

      <h2>§ 10 Haftung</h2>
      <p>
        Der Anbieter haftet uneingeschränkt für Vorsatz und grobe
        Fahrlässigkeit sowie nach den Vorschriften des
        Produkthaftungsgesetzes. Bei einfacher Fahrlässigkeit ist die
        Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt
        und nur bei Verletzung wesentlicher Vertragspflichten gegeben.
      </p>

      <h2>§ 11 Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts. Sollten
        einzelne Bestimmungen dieser AGB unwirksam sein, bleibt die
        Wirksamkeit der übrigen Bestimmungen unberührt.
      </p>

      <p className="text-xs mt-12">
        Stand: <span className="placeholder">[TT.MM.JJJJ]</span>
      </p>
    </LegalLayout>
  );
}
