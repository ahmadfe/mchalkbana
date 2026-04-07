'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Eye, EyeOff, GraduationCap, CheckCircle2 } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const { refetch } = useAuth();

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    language: locale,
    agreeTerms: false,
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Namn krävs';
    if (!form.email.includes('@')) e.email = 'Ogiltig e-postadress';
    if (form.password.length < 8) e.password = 'Minst 8 tecken';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Lösenorden stämmer inte överens';
    if (!form.agreeTerms) e.agreeTerms = 'Du måste godkänna villkoren';
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        language: form.language,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setErrors({ email: data.error || 'Registrering misslyckades' });
      return;
    }

    await refetch();
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-md text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Konto skapat!</h1>
            <p className="text-gray-500 mb-8">
              Välkommen, <strong>{form.name}</strong>! Ditt konto är aktivt.
            </p>
            <button
              onClick={() => router.push(`/${locale}/dashboard`)}
              className="btn-primary inline-block"
            >
              Gå till min sida
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const field = (key: string, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <input
        type={type}
        value={(form as unknown as Record<string, string>)[key] ?? ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className={clsx('input-field', errors[key] && 'border-red-400 focus:ring-red-400')}
      />
      {errors[key] && <p className="text-xs text-red-600 mt-1">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-swedish-blue mb-4">
              <GraduationCap className="w-8 h-8 text-swedish-yellow" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{t('register_title')}</h1>
            <p className="text-gray-500 text-sm mt-1">Uppsala Halkbana</p>
          </div>

          <div className="card shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {field('name', t('full_name'), 'text', 'Anna Svensson')}
              {field('email', t('email'), 'email', t('email_placeholder'))}
              {field('phone', t('phone'), 'tel', '070-123 45 67')}

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('password')}</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={t('password_placeholder')}
                    className={clsx('input-field pr-10', errors.password && 'border-red-400')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-600 mt-1">{errors.password}</p>}
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('confirm_password')}</label>
                <input
                  type="password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  placeholder="Upprepa lösenord"
                  className={clsx('input-field', errors.confirmPassword && 'border-red-400')}
                />
                {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>}
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('language')}</label>
                <select
                  value={form.language}
                  onChange={(e) => setForm({ ...form, language: e.target.value })}
                  className="input-field"
                >
                  <option value="sv">Svenska</option>
                  <option value="en">English</option>
                </select>
              </div>

              {/* Terms */}
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.agreeTerms}
                    onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-swedish-blue"
                  />
                  <span className="text-sm text-gray-600">
                    {t('agree_terms')}{' '}
                    <Link href="#" className="text-swedish-blue hover:underline">
                      Integritetspolicyn
                    </Link>
                  </span>
                </label>
                {errors.agreeTerms && <p className="text-xs text-red-600 mt-1">{errors.agreeTerms}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3 text-base flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Skapar konto...
                  </>
                ) : (
                  t('register_btn')
                )}
              </button>
            </form>

            <p className="text-center text-sm text-gray-500 mt-6">
              {t('has_account')}{' '}
              <Link href={`/${locale}/login`} className="text-swedish-blue font-medium hover:underline">
                {t('login_btn')}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
