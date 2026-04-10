'use client';

import { useLocale } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Mail, Phone, ExternalLink } from 'lucide-react';

export default function Footer() {
  const locale = useLocale();
  const base = `/${locale}`;

  return (
    <footer className="bg-gray-900 pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">

          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image src="/logo.png" alt="Uppsala Halkbana" width={44} height={44} className="rounded-xl object-contain" />
              <span className="font-headline font-bold text-white text-sm leading-tight">Uppsala<br />Halkbana</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              Professionell riskutbildning för bil och motorcykel i Uppsala. Godkänd av Transportstyrelsen.
            </p>
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-swedish-blue shrink-0" />
                <span>Norrlövsta 147, 747 91 Alunda</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-swedish-blue shrink-0" />
                <span>info@uppsalahalkbana.se</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-swedish-blue shrink-0" />
                <span>07 07 66 66 61</span>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Snabblänkar</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href={`${base}/courses`} className="text-gray-400 hover:text-swedish-blue transition-colors">Kurser</Link></li>
              <li><Link href={`${base}/about`} className="text-gray-400 hover:text-swedish-blue transition-colors">Om oss</Link></li>
              <li><Link href={`${base}/contact`} className="text-gray-400 hover:text-swedish-blue transition-colors">Kontakta oss</Link></li>
              <li><Link href={`${base}/login`} className="text-gray-500 hover:text-swedish-blue transition-colors">För trafikskolor</Link></li>
            </ul>
          </div>

          {/* External */}
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Officiella länkar</h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { href: 'https://fp.trafikverket.se/boka/', label: 'Trafikverket – Boka prov' },
                { href: 'https://www.transportstyrelsen.se', label: 'Transportstyrelsen' },
                { href: 'https://ntf.se/', label: 'NTF' },
              ].map((l) => (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer"
                    className="text-gray-400 hover:text-swedish-blue transition-colors flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-bold text-white text-sm uppercase tracking-wider mb-4">Juridiskt</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="#" className="text-gray-400 hover:text-swedish-blue transition-colors">Integritetspolicy</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-swedish-blue transition-colors">Cookiepolicy</Link></li>
              <li><Link href="#" className="text-gray-400 hover:text-swedish-blue transition-colors">Bokningsvillkor</Link></li>
            </ul>
            <div className="mt-5 p-3 bg-gray-800 rounded-xl text-xs text-gray-400">
              <p className="font-semibold text-gray-300 mb-1">GDPR</p>
              <p>Vi behandlar dina personuppgifter i enlighet med GDPR och Dataskyddslagen (2018:218).</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-6 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Uppsala Halkbana. Alla rättigheter förbehållna.</p>
          <p>Uppsala/Stockholm Region, Sverige</p>
        </div>
      </div>
    </footer>
  );
}
