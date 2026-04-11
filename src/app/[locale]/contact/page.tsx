'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { MapPin, Mail, Phone, Clock, Shield, Calendar, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSending(false);
    if (res.ok) {
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } else {
      const data = await res.json();
      setError(data.error || 'Något gick fel. Försök igen.');
    }
  };

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
                  src="https://maps.google.com/maps?q=Norrl%C3%B6vsta+147%2C+747+91+Alunda&output=embed"
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
              {sent ? (
                <div className="flex flex-col items-center justify-center py-16 text-center bg-green-50 rounded-2xl border border-green-100">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="font-semibold text-gray-900 text-lg">Meddelandet skickat!</p>
                  <p className="text-gray-500 text-sm mt-1">Vi återkommer så snart vi kan.</p>
                  <button onClick={() => setSent(false)} className="mt-5 text-sm text-swedish-blue hover:underline">Skicka ett till</button>
                </div>
              ) : (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Namn</label>
                    <input type="text" className="input-field" placeholder="Ditt namn" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">E-post</label>
                    <input type="email" className="input-field" placeholder="din@email.se" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Ämne</label>
                    <input type="text" className="input-field" placeholder="Vad gäller det?" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Meddelande</label>
                    <textarea rows={5} className="input-field resize-none" placeholder="Skriv ditt meddelande här..." required value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
                  </div>
                  <button type="submit" disabled={sending} className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-60">
                    {sending ? <><Loader2 className="w-4 h-4 animate-spin" />Skickar...</> : 'Skicka meddelande'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
