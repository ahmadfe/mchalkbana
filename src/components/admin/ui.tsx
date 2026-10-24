import clsx from 'clsx';
import type { ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Card({ title, aside, className, children }: { title?: string; aside?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx('rounded-3xl bg-[#1c1c1f] p-5 sm:p-6', className)}>
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3 mb-5">
          {title && <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Field({ label, required, hint, className, children }: { label: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={clsx('block', className)}>
      <span className="block text-sm font-semibold text-white/80 mb-2">
        {label}{required && <span className="text-red-400"> *</span>}
      </span>
      {children}
      {hint && <span className="block text-sm text-white/50 mt-2 leading-relaxed">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full h-12 px-4 rounded-xl bg-[#26262a] border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-white/40 transition [color-scheme:dark]';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx(inputCls, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx(inputCls, 'pr-3', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx(inputCls, 'h-auto min-h-[96px] py-3', props.className)} />;
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 w-6 h-6 rounded-md accent-white shrink-0" />
      <span className="text-[15px] leading-snug">{children}</span>
    </label>
  );
}

type Variant = 'primary' | 'secondary' | 'danger';

export function Button({ variant = 'secondary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-white text-black hover:bg-white/90',
        variant === 'secondary' && 'bg-white/10 text-white hover:bg-white/15 border border-white/10',
        variant === 'danger' && 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
        className,
      )}
    />
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'red'; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide',
        tone === 'neutral' && 'bg-white/10 text-white/70',
        tone === 'blue' && 'bg-sky-500/15 text-sky-300',
        tone === 'green' && 'bg-emerald-500/15 text-emerald-300',
        tone === 'amber' && 'bg-amber-500/15 text-amber-300',
        tone === 'red' && 'bg-red-500/15 text-red-300',
      )}
    >
      {children}
    </span>
  );
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm', ...opts });
}
