import clsx from 'clsx';
import Image from 'next/image';

/** Klarnas märke: rosa bricka med "Klarna." (Klarnas varumärkesfärger) */
export function KlarnaBadge({ small = false, className }: { small?: boolean; className?: string }) {
  return (
    <span
      aria-label="Klarna"
      className={clsx(
        'inline-flex items-center justify-center rounded-md bg-[#FFB3C7] text-[#0B051D] font-extrabold tracking-tight leading-none',
        small ? 'h-6 px-2 text-xs' : 'h-8 px-3 text-sm',
        className,
      )}
    >
      Klarna.
    </span>
  );
}

/** Liten rad med betalsätt – används på kurskorten */
export function PayWith({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2 text-xs text-gray-500', className)}>
      <span>Betala med</span>
      <Image src="/swish-logo.png" alt="Swish" width={24} height={24} className="rounded object-contain" />
      <KlarnaBadge small />
    </div>
  );
}

/** Information efter köp med Klarna – bekräftelsesidan (krav i Klarnas go-live-lista) */
export function KlarnaAfterPurchase() {
  return (
    <div className="rounded-2xl border border-[#FFB3C7] bg-[#FFF0F5] p-4 text-left text-sm text-gray-800">
      <p className="flex items-center gap-2 font-semibold mb-1.5"><KlarnaBadge small /> Du har valt att betala med Klarna</p>
      <p>Du får ett mejl från Klarna med information om din betalning. Beloppet dras när kursen är genomförd – avbokar du senast 48 timmar före kursstart betalar du ingenting.</p>
      <p className="mt-1.5">
        Se och hantera betalningen i <a href="https://www.klarna.com/se/app/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Klarna-appen</a>.
        Frågor om betalningen: <a href="https://www.klarna.com/se/kundservice/" target="_blank" rel="noopener noreferrer" className="font-semibold underline">Klarnas kundservice</a>.
      </p>
    </div>
  );
}
