import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Shield, Users, MapPin, Award } from 'lucide-react';

export async function generateMetadata() {
  return {
    title: 'Om oss – Uppsala Halkbana',
    description:
      'Lär känna Uppsala Halkbana – godkänd av Transportstyrelsen. Vi erbjuder professionell riskutbildning för bil och motorcykel nära Uppsala, Stockholm och Gävle.',
    alternates: { canonical: '/sv/about' },
    openGraph: {
      title: 'Om oss – Uppsala Halkbana',
      description: 'Professionell riskutbildning godkänd av Transportstyrelsen sedan många år.',
      url: 'https://www.uppsalahalkbana.se/sv/about',
    },
  };
}

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-swedish-blue via-brand-700 to-brand-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1 w-8 bg-swedish-yellow rounded-full" />
            <span className="text-swedish-yellow text-sm font-semibold uppercase tracking-widest">Om oss</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Uppsala Halkbana</h1>
          <p className="text-brand-100 text-lg mt-4 max-w-2xl">
            Vi erbjuder professionell riskutbildning för bil och motorcykel – godkänd av Transportstyrelsen sedan över 15 år.
          </p>
        </div>
      </section>

      {/* About content */}
      <section className="py-16 bg-white flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Vår historia</h2>
              <p className="text-gray-500 leading-relaxed mb-4">
                Uppsala Halkbana grundades med målet att göra svenska vägar säkrare. Vi har utbildat tusentals förare i hur man hanterar fordon i kritiska situationer – alkohol och droger i trafiken, halt väglag och oförutsedda händelser.
              </p>
              <p className="text-gray-500 leading-relaxed">
                Vår moderna anläggning i Uppsala är utrustad med professionell utrustning och erfarna instruktörer som guidar dig genom utbildningen på ett tryggt och engagerande sätt.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <Award className="w-7 h-7" />, label: 'Transportstyrelsen godkänd', color: 'bg-brand-50 text-swedish-blue' },
                { icon: <Users className="w-7 h-7" />, label: '2 400+ nöjda elever', color: 'bg-green-50 text-green-700' },
                { icon: <Shield className="w-7 h-7" />, label: '15+ år i branschen', color: 'bg-yellow-50 text-yellow-700' },
                { icon: <MapPin className="w-7 h-7" />, label: 'Centralt i Uppsala', color: 'bg-purple-50 text-purple-700' },
              ].map((item) => (
                <div key={item.label} className="p-5 rounded-2xl bg-gray-50 border border-gray-100 text-center">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 ${item.color}`}>
                    {item.icon}
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Values */}
          <div className="bg-gray-50 rounded-3xl p-10">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-8 text-center">Våra värderingar</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Säkerhet', desc: 'Trafiksäkerhet är vår kärna. Vi utbildar förare att hantera riktiga risker – inte bara klara ett prov.' },
                { title: 'Kvalitet', desc: 'Alla kurser håller högsta standard och uppfyller Transportstyrelsens krav till fullo.' },
                { title: 'Tillgänglighet', desc: 'Enkel onlinebokning, tydliga priser och flexibla tider för att passa alla.' },
              ].map((v) => (
                <div key={v.title}>
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{v.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
