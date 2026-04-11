'use client';

import { useLocale } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, Mail, Phone, ExternalLink } from 'lucide-react';

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.254h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.54V6.78a4.85 4.85 0 01-1.02-.09z" />
    </svg>
  );
}

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

            {/* Social links */}
            <div className="mt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Följ oss</p>
              <div className="flex items-center gap-3">
                <a
                  href="https://www.facebook.com/UppsalaHalkbanaOfficial"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-[#1877F2] hover:text-white transition-all"
                >
                  <FacebookIcon />
                </a>
                <a
                  href="https://www.instagram.com/uppsalahalkbana"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-gradient-to-br hover:from-[#f09433] hover:via-[#e6683c] hover:to-[#bc1888] hover:text-white transition-all"
                >
                  <InstagramIcon />
                </a>
                <a
                  href="https://www.tiktok.com/@uppsalahalkbana"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="TikTok"
                  className="w-9 h-9 rounded-xl bg-gray-800 flex items-center justify-center text-gray-400 hover:bg-black hover:text-white transition-all"
                >
                  <TikTokIcon />
                </a>
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

        <div className="border-t border-gray-700 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-500">
          <p>© {new Date().getFullYear()} Uppsala Halkbana. Alla rättigheter förbehållna.</p>

          {/* Payment method */}
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Betalning via</span>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A2683] rounded-lg">
              {/* Swish wave/arc mark */}
              <svg viewBox="0 0 20 14" fill="none" className="w-5 h-3.5" aria-hidden="true">
                <path
                  d="M1 10 C4 4, 7 1, 10 3 C13 5, 14 9, 17 8 C18.5 7.5, 19 6, 19 4"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span className="text-white font-bold tracking-wide text-xs">swish</span>
            </div>
          </div>

          <p>Uppsala/Stockholm Region, Sverige</p>
        </div>
      </div>
    </footer>
  );
}
