'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { MapPin, Mail, Phone, Clock, Shield, Calendar, CreditCard } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-br from-swedish-blue via-brand-700 to-brand-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-1 w-8 bg-swedish-yellow rounded-full" />
            <span className="text-swedish-yellow text-sm font-semibold uppercase tracking-widest">Kontakta oss</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">Vi hjälper dig gärna</h1>
          <p className="text-brand-100 text-lg mt-4 max-w-2xl">
            Har du frågor om våra kurser, bokning eller utbildning? Tveka inte att höra av dig.
          </p>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="section-title">Why Choose Us?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: <Shield className="w-8 h-8" />, title: 'Certified Training', desc: "All courses comply with the Swedish Transport Agency's requirements for risk training.", color: 'bg-brand-50 text-swedish-blue' },
              { icon: <Calendar className="w-8 h-8" />, title: 'Easy Online Booking', desc: 'Book, pay, and manage your courses entirely online — any time of day.', color: 'bg-yellow-50 text-yellow-700' },
              { icon: <CreditCard className="w-8 h-8" />, title: 'Secure Payment', desc: 'We use Stripe for secure payment with card, Swish, and Apple Pay.', color: 'bg-green-50 text-green-700' },
            ].map((f) => (
              <div key={f.title} className="text-center p-8 rounded-2xl bg-white border border-gray-100">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact content */}
      <section className="py-16 bg-white flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

            {/* Contact info */}
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Kontaktuppgifter</h2>
              <div className="space-y-5">
                {[
                  { icon: <MapPin className="w-5 h-5" />, label: 'Adress', value: 'Norrlövsta 147, 747 91 Alunda', color: 'bg-brand-50 text-swedish-blue' },
                  { icon: <Mail className="w-5 h-5" />, label: 'E-post', value: 'info@uppsalahalkbana.se', color: 'bg-green-50 text-green-700' },
                  { icon: <Phone className="w-5 h-5" />, label: 'Telefon', value: '07 07 66 66 61', color: 'bg-yellow-50 text-yellow-700' },
                  { icon: <Clock className="w-5 h-5" />, label: 'Öppettider', value: 'Lör–Tor 08:00–17:00', color: 'bg-purple-50 text-purple-700' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{item.label}</p>
                      <p className="text-gray-800 font-medium">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Map placeholder */}
              <div className="mt-8 rounded-2xl bg-gray-100 border border-gray-200 overflow-hidden" style={{ height: '220px' }}>
                <iframe
                  title="Uppsala Halkbana"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2013.0!2d17.6389!3d59.8586!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNTnCsDUxJzMxLjAiTiAxN8KwMzgnMjAuMCJF!5e0!3m2!1ssv!2sse!4v1"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            </div>

            {/* Contact form */}
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-6">Skicka ett meddelande</h2>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Namn</label>
                  <input type="text" className="input-field" placeholder="Ditt namn" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-post</label>
                  <input type="email" className="input-field" placeholder="din@email.se" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ämne</label>
                  <input type="text" className="input-field" placeholder="Vad gäller det?" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Meddelande</label>
                  <textarea rows={5} className="input-field resize-none" placeholder="Skriv ditt meddelande här..." />
                </div>
                <button type="submit" className="w-full btn-primary py-3">
                  Skicka meddelande
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
