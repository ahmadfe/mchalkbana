'use client';

import { Tag } from 'lucide-react';
import { SchoolPage, useSchool } from '@/components/school/SchoolShell';
import { kr } from '@/components/school/shared';
import { Card } from '@/components/admin/ui';

const PART_LABEL: Record<string, string> = { both: 'Risk 1 + 2', risk1: 'Bara Risk 1', risk2: 'Bara Risk 2' };
// Priser sparas inkl. 25 % moms
const exVat = (n: number) => Math.round(n / 1.25);

export default function SchoolPricesPage() {
  const { prices } = useSchool();

  return (
    <SchoolPage title="Priser" subtitle="Ert pris per elev">
      <Card title="Era avtalade priser">
        {prices.length === 0 ? (
          <div className="text-center py-10">
            <Tag className="w-9 h-9 mx-auto mb-3 text-white/25" strokeWidth={1.5} />
            <p className="font-semibold">Inga egna priser</p>
            <p className="text-sm text-white/50 mt-1">Ni betalar ordinarie pris. Kontakta oss om ni vill ha ett avtalspris.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5 -my-2">
            {prices.map(p => (
              <li key={`${p.courseId}:${p.part}`} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.title}</p>
                  {p.kombo && <p className="text-sm text-white/50 mt-0.5">{PART_LABEL[p.part] ?? p.part}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold">{kr(exVat(p.price))} <span className="text-xs font-normal text-white/50">exkl. moms</span></p>
                  <p className="text-xs text-white/45 mt-0.5">{kr(p.price)} inkl. moms</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="text-sm text-white/45 px-1">Kurser som inte finns i listan faktureras till ordinarie pris. Har ni frågor om priserna – kontakta oss.</p>
    </SchoolPage>
  );
}
