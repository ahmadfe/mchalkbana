import LegalPage, { KLARNA_PRIVACY_URL } from '@/components/LegalPage';

export async function generateMetadata() {
  return {
    title: 'Integritetspolicy – Uppsala Halkbana',
    description: 'Hur Uppsala Halkbana behandlar dina personuppgifter när du bokar riskutbildning.',
    alternates: { canonical: '/sv/integritetspolicy' },
  };
}

export default function IntegritetspolicyPage() {
  return (
    <LegalPage eyebrow="Dataskydd" title="Integritetspolicy" updated="3 november 2026">
      <section>
        <h2>Personuppgiftsansvarig</h2>
        <p>
          Uppsala Halkbana, org.nr 559188-6410, Norrlövsta 147, 747 91 Alunda, är personuppgiftsansvarig för behandlingen av dina
          personuppgifter. Kontakta oss på <a href="mailto:info@uppsalahalkbana.se">info@uppsalahalkbana.se</a>.
        </p>
      </section>

      <section>
        <h2>Vilka uppgifter vi behandlar och varför</h2>
        <ul>
          <li><strong>Bokning:</strong> namn, personnummer, e-post och telefon – för att hantera din bokning och skicka bekräftelse och påminnelser.</li>
          <li><strong>Kursen:</strong> närvaro, vilken legitimation du visade och resultat – för att genomföra riskutbildningen enligt Transportstyrelsens krav.</li>
          <li><strong>Rapportering:</strong> personnummer, namn och kursdatum rapporteras till Transportstyrelsen när du har genomfört kursen (rättslig förpliktelse).</li>
          <li><strong>Betalning:</strong> belopp, betalsätt och transaktionsuppgifter – för bokföring och eventuell återbetalning.</li>
        </ul>
      </section>

      <section>
        <h2>Betalning med Swish och Klarna</h2>
        <p>
          När du betalar med Swish behandlas betalningen av din bank och Swish. När du betalar med Klarna lämnar vi dina uppgifter
          (namn, e-post, telefon, kurs och belopp) till Klarna Bank AB (publ) för att Klarna ska kunna hantera betalningen. Klarna
          behandlar uppgifterna enligt <a href={KLARNA_PRIVACY_URL} target="_blank" rel="noopener noreferrer">Klarnas dataskyddsinformation</a>.
        </p>
      </section>

      <section>
        <h2>Hur länge vi sparar uppgifterna</h2>
        <p>
          Uppgifter om genomförd riskutbildning sparas i fem år enligt kraven för riskutbildning. Bokförings- och betalningsuppgifter
          sparas i sju år enligt bokföringslagen. Övriga uppgifter raderas när de inte längre behövs.
        </p>
      </section>

      <section>
        <h2>Dina rättigheter</h2>
        <p>
          Du har rätt att få veta vilka uppgifter vi har om dig, få felaktiga uppgifter rättade och i vissa fall få uppgifter raderade
          eller begränsade. Kontakta oss på <a href="mailto:info@uppsalahalkbana.se">info@uppsalahalkbana.se</a>. Du kan också lämna
          klagomål till Integritetsskyddsmyndigheten (<a href="https://www.imy.se" target="_blank" rel="noopener noreferrer">imy.se</a>).
        </p>
      </section>
    </LegalPage>
  );
}
