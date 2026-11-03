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
      'Du kan avboka eller byta tid kostnadsfritt senast 48 timmar före kursstart. Byt tid via länken i din bokningsbekräftelse, eller kontakta oss på info@uppsalahalkbana.se. Avbokar du senare, eller uteblir, debiteras hela kursavgiften.',
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
  {
    question: 'Kan jag betala med Klarna?',
    answer:
      'Ja. I kassan väljer du Swish eller Klarna. Med Klarna kan du betala direkt (t.ex. med kort eller bank) eller betala senare. Beloppet reserveras när du bokar och dras när kursen är genomförd. Avbokar du senast 48 timmar före kursstart släpps reservationen och du betalar ingenting.',
  },
  {
    question: 'Var ser jag min Klarna-betalning?',
    answer:
      'Du får ett mejl från Klarna med information om betalningen. Du kan se och hantera den i Klarna-appen eller på klarna.com/se. Frågor om själva betalningen besvarar Klarnas kundservice: klarna.com/se/kundservice.',
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
  {
    question: 'Can I pay with Klarna?',
    answer:
      'Yes. At checkout you choose Swish or Klarna. With Klarna you can pay now (e.g. by card or bank) or pay later. The amount is reserved when you book and charged when the course is completed. If you cancel at least 48 hours before the course starts, the reservation is released and you pay nothing.',
  },
  {
    question: 'Where can I see my Klarna payment?',
    answer:
      'Klarna sends you an email about the payment. You can view and manage it in the Klarna app or at klarna.com. Questions about the payment itself are answered by Klarna customer service: klarna.com/se/kundservice.',
  },
];

export default function FaqSection({ locale }: { locale: string }) {
  const items = locale === 'en' ? FAQ_EN : FAQ_SV;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section id="klarna" className="py-16 bg-gray-50 scroll-mt-20">
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
