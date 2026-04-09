import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Mail, Phone, ExternalLink } from 'lucide-react';

export default function Footer() {
  const t = useTranslations('footer');
  const locale = useLocale();
  const base = `/${locale}`;

  return (
    <footer className="bg-gray-900 text-gray-300 pt-12 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Image src="/logo.png" alt="Uppsala Halkbana" width={40} height={40} className="rounded-full object-contain bg-white" />
              <span className="font-bold text-white text-lg">Uppsala Halkbana</span>
            </div>
            <p className="text-sm leading-relaxed">
              Professionell riskutbildning för bil och motorcykel i Uppsala. Godkänd av Transportstyrelsen.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-swedish-yellow shrink-0" />
                <span>Norrlövsta 147, 747 91 Alunda</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-swedish-yellow shrink-0" />
                <span>info@uppsalahalkbana.se</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-swedish-yellow shrink-0" />
                <span>07 07 66 66 61</span>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Snabblänkar</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href={`${base}/about`} className="hover:text-swedish-yellow transition-colors">Om oss</Link></li>
              <li><Link href={`${base}/contact`} className="hover:text-swedish-yellow transition-colors">Kontakta oss</Link></li>
              <li><Link href={`${base}/courses`} className="hover:text-swedish-yellow transition-colors">Kurser</Link></li>
              <li><Link href={`${base}/login`} className="hover:text-swedish-yellow transition-colors text-gray-500">För trafikskolor</Link></li>
            </ul>
          </div>

          {/* External links */}
          <div>
            <h3 className="font-semibold text-white mb-4">Officiella länkar</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://fp.trafikverket.se/boka/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-swedish-yellow transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Trafikverket – Boka prov
                </a>
              </li>
              <li>
                <a
                  href="https://www.transportstyrelsen.se"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-swedish-yellow transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Transportstyrelsen
                </a>
              </li>
              <li>
                <a
                  href="https://ntf.se/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-swedish-yellow transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  NTF
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-white mb-4">Juridiskt</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-swedish-yellow transition-colors">{t('privacy')}</Link></li>
              <li><Link href="#" className="hover:text-swedish-yellow transition-colors">{t('cookies')}</Link></li>
              <li><Link href="#" className="hover:text-swedish-yellow transition-colors">{t('terms')}</Link></li>
            </ul>
            <div className="mt-4 p-3 bg-gray-800 rounded-lg text-xs">
              <p className="font-semibold text-white mb-1">GDPR</p>
              <p>Vi behandlar dina personuppgifter i enlighet med GDPR och Dataskyddslagen (2018:218).</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
          <p>© {new Date().getFullYear()} Uppsala Halkbana. {t('rights')}.</p>
          <div className="flex items-center gap-2">
            <div className="w-5 h-3.5 rounded-sm overflow-hidden flex">
              <div className="w-full h-full bg-swedish-blue relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1 h-full bg-swedish-yellow"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-swedish-yellow mt-0.5"></div>
                </div>
              </div>
            </div>
            <span>Stockholm/Uppsala Region</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
