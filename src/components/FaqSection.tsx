'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_SV: FaqItem[] = [
  {
    question: 'Vad är Risk 1 och Risk 2?',
    answer:
      'Risk 1 är en obligatorisk utbildning om alkohol, droger, trötthet och riskbeteenden i trafiken. Risk 2 är en praktisk körövning på halt underlag (halkbana) för att lära sig hantera ett fordon vid kritiska situationer. Båda är krav för att ta körkort i Sverige.',
  },
  {
    question: 'Hur bokar jag en kurs?',
    answer:
      'Klicka på "Boka nu" eller gå till sidan "Kurser". Välj den kurs du vill gå, välj ett tillgängligt tillfälle och betala säkert online. Du får en bokningsbekräftelse direkt till din e-post.',
  },
  {
    question: 'Vad behöver jag ta med mig?',
    answer:
      'Ta med giltig legitimation och ditt körkortstillstånd. För Risk 2 rekommenderar vi varma och vattentåliga kläder. Vi tillhandahåller fordon och utrustning.',
  },
  {
    question: 'Kan jag avboka eller byta tid?',
    answer:
      'Kontakta oss så snart möjligt om du behöver avboka eller ändra din bokning. Avbokning kan göras upp till 48 timmar före kursdatum för att undvika avgift. Kontakta oss via info@uppsalahalkbana.se.',
  },
  {
    question: 'Erbjuder ni kurser för motorcykel?',
    answer:
      'Ja! Vi erbjuder riskutbildning för både bil och motorcykel. Välj rätt fordonstyp när du bokar din kurs.',
  },
  {
    question: 'Hur lång tid tar kursen?',
    answer:
      'Risk 1 varar ungefär 3 timmar och genomförs i klassrum eller online. Risk 2 på halkbana varar normalt 4–5 timmar inklusive praktiska övningar.',
  },
  {
    question: 'Är ni godkända av Transportstyrelsen?',
    answer:
      'Ja, Uppsala Halkbana är godkänd av Transportstyrelsen och alla våra kurser uppfyller de lagstadgade kraven för riskutbildning i Sverige.',
  },
];

const FAQ_EN: FaqItem[] = [
  {
    question: 'What is Risk 1 and Risk 2?',
    answer:
      'Risk 1 is a mandatory course about alcohol, drugs, fatigue and risk behaviour in traffic. Risk 2 is a practical driving exercise on a skid track to learn how to handle a vehicle in critical situations. Both are required to obtain a driving licence in Sweden.',
  },
  {
    question: 'How do I book a course?',
    answer:
      'Click "Book now" or go to the "Courses" page. Select the course you want, choose an available time slot and pay securely online. You will receive a booking confirmation directly to your email.',
  },
  {
    question: 'What do I need to bring?',
    answer:
      'Bring valid ID and your learner\'s permit. For Risk 2 we recommend warm, waterproof clothing. We provide vehicles and equipment.',
  },
  {
    question: 'Can I cancel or reschedule?',
    answer:
      'Contact us as soon as possible if you need to cancel or change your booking. Cancellations can be made up to 48 hours before the course date to avoid a fee. Contact us at info@uppsalahalkbana.se.',
  },
  {
    question: 'Do you offer courses for motorcycles?',
    answer:
      'Yes! We offer risk training for both cars and motorcycles. Select the correct vehicle type when booking your course.',
  },
  {
    question: 'How long does the course take?',
    answer:
      'Risk 1 lasts approximately 3 hours and is conducted in a classroom or online. Risk 2 on the skid track normally takes 4–5 hours including practical exercises.',
  },
  {
    question: 'Are you approved by the Swedish Transport Agency?',
    answer:
      'Yes, Uppsala Halkbana is approved by Transportstyrelsen and all our courses meet the statutory requirements for risk training in Sweden.',
  },
];

export default function FaqSection({ locale }: { locale: string }) {
  const items = locale === 'en' ? FAQ_EN : FAQ_SV;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-extrabold text-gray-900">
            {locale === 'en' ? 'Frequently Asked Questions' : 'Vanliga frågor'}
          </h2>
          <p className="mt-3 text-gray-500">
            {locale === 'en'
              ? "Can't find your answer? Contact us at info@uppsalahalkbana.se"
              : 'Hittar du inte svaret? Kontakta oss på info@uppsalahalkbana.se'}
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm"
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
              >
                <span className="font-semibold text-gray-900 text-sm sm:text-base">
                  {item.question}
                </span>
                <ChevronDown
                  className={clsx(
                    'w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200',
                    open === i && 'rotate-180'
                  )}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
