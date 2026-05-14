'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { GraduationCap, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react';

export default function InstruktorRegistreraPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const locale = useLocale();
  const router = useRouter();

  const [invite, setInvite] = useState<{ email: string; name: string | null } | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/public/instructor-invite/${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setTokenError(d.error); }
        else { setInvite(d); setName(d.name || ''); }
        setLoading(false);
      })
      .catch(() => { setTokenError('Kunde inte ladda inbjudan.'); setLoading(false); });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Lösenorden matchar inte'); return; }
    if (password.length < 8) { setError('Lösenordet måste vara minst 8 tecken'); return; }
    setSubmitting(true);
    const res = await fetch(`/api/public/instructor-invite/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error || 'Fel'); return; }
    setDone(true);
    setTimeout(() => router.push(`/${locale}/login`), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-swedish-blue border-t-transparent rounded-full animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-swedish-blue mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Skapa instruktörskonto</h1>
            <p className="text-gray-500 text-sm mt-1">Uppsala Halkbana</p>
          </div>

          <div className="card shadow-sm">
            {tokenError ? (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{tokenError}</p>
              </div>
            ) : done ? (
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-semibold text-gray-900 mb-1">Konto skapat!</p>
                <p className="text-sm text-gray-500">Du skickas till inloggningssidan...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {invite?.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">E-post</label>
                    <input type="email" value={invite.email} disabled className="input-field bg-gray-50 text-gray-500 cursor-not-allowed" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Namn *</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ditt namn" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Lösenord *</label>
                  <div className="relative">
                    <input required type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minst 8 tecken" className="input-field pr-10" />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bekräfta lösenord *</label>
                  <input required type={showPwd ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Upprepa lösenord" className="input-field" />
                </div>
                {error && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}
                <button type="submit" disabled={submitting} className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Skapar konto...</> : 'Skapa konto'}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
