import LegalPage, { KLARNA_PRIVACY_URL, KLARNA_TERMS_URL } from '@/components/LegalPage';

export async function generateMetadata() {
  return {
    title: 'Bokningsvillkor – Uppsala Halkbana',
    description: 'Villkor för bokning, betalning med Swish eller Klarna, avbokning och byte av tid hos Uppsala Halkbana.',
    alternates: { canonical: '/sv/bokningsvillkor' },
  };
}

export default function BokningsvillkorPage() {
  return (
    <LegalPage eyebrow="Villkor" title="Bokningsvillkor" updated="3 november 2026">
      <section>
        <h2>1. Bokning</h2>
        <p>
          När du bokar en kurs på uppsalahalkbana.se och betalningen är godkänd är din plats bokad. Du får en bokningsbekräftelse
          via e-post. Kontrollera att namn och personnummer stämmer – de rapporteras till Transportstyrelsen när du har genomfört kursen.
        </p>
      </section>

      <section>
        <h2>2. Betalning</h2>
        <p>Du kan betala med <strong>Swish</strong> eller <strong>Klarna</strong>. Alla priser är i svenska kronor inklusive 25 % moms.</p>
        <ul>
          <li><strong>Swish</strong> – beloppet dras direkt när du bokar.</li>
          <li>
            <strong>Klarna</strong> – du kan betala direkt eller betala senare. Beloppet reserveras när du bokar och dras när kursen är genomförd.
            Frågor om själva betalningen besvaras av Klarnas kundservice eller i Klarna-appen.
          </li>
        </ul>
        <p>
          När du betalar med Klarna godkänner du Klarnas villkor. Klarna Bank AB (publ) hanterar din betalning och behandlar dina
          personuppgifter enligt sin dataskyddsinformation:
        </p>
        <ul>
          <li><a href={KLARNA_TERMS_URL} target="_blank" rel="noopener noreferrer">Klarnas shoppingtjänst – villkor</a></li>
          <li><a href={KLARNA_PRIVACY_URL} target="_blank" rel="noopener noreferrer">Klarnas dataskyddsinformation</a></li>
        </ul>
      </section>

      <section>
        <h2>3. Avbokning</h2>
        <p>
          Du kan avboka kostnadsfritt <strong>senast 48 timmar</strong> före kursens starttid. Kontakta oss på{' '}
          <a href="mailto:info@uppsalahalkbana.se">info@uppsalahalkbana.se</a> eller <a href="tel:+46707666661">07 07 66 66 61</a>.
          Vid avbokning i tid återbetalas en Swish-betalning, och en Klarna-reservation släpps så att du inte debiteras något.
        </p>
        <p>
          Avbokar du <strong>senare än 48 timmar</strong> före kursstart, eller uteblir du från kursen, debiteras hela kursavgiften.
        </p>
      </section>

      <section>
        <h2>4. Byte av tid</h2>
        <p>
          Du kan byta tid via länken i din bokningsbekräftelse fram till 48 timmar före kursstart, i mån av lediga platser.
          Därefter kontaktar du oss.
        </p>
      </section>

      <section>
        <h2>5. Legitimation</h2>
        <p>
          Ta med giltig legitimation (körkort, pass eller nationellt id-kort). Utan godkänd legitimation kan du inte delta,
          och kursavgiften återbetalas inte.
        </p>
      </section>

      <section>
        <h2>6. Om vi ställer in kursen</h2>
        <p>
          Ställer vi in en kurs, till exempel på grund av väder eller sjukdom, erbjuder vi dig en ny tid. Vill du inte ha en ny tid
          återbetalas hela beloppet, eller släpps reservationen om du betalat med Klarna.
        </p>
      </section>

      <section>
        <h2>7. Bokning via trafikskola</h2>
        <p>Har din trafikskola bokat åt dig faktureras skolan enligt avtal med oss. Avbokning sker då via trafikskolan.</p>
      </section>

      <section>
        <h2>8. Kontakt</h2>
        <p>
          Uppsala Halkbana · Norrlövsta 147, 747 91 Alunda · Org.nr 559188-6410<br />
          <a href="mailto:info@uppsalahalkbana.se">info@uppsalahalkbana.se</a> · <a href="tel:+46707666661">07 07 66 66 61</a>
        </p>
      </section>
    </LegalPage>
  );
}
