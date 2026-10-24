'use client';

import { useEffect, useState } from 'react';

interface Data {
  kurs: { title: string; startTime: string; endTime: string; location: string; filial: { name: string }; instructors: { name: string }[] };
  participants: { bookingId: number; name: string; personnummer: string; phone: string; status: string; paid: boolean; schoolName: string | null }[];
}

const tz = { timeZone: 'Europe/Stockholm' } as const;
const hm = (iso: string) => new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', ...tz });

/** Utskriftsvänlig deltagarlista – spara som PDF via webbläsarens utskrift. */
export default function DeltagarlistaPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/admin/kurser/${params.id}`)
      .then(async r => (r.ok ? setData(await r.json()) : setError('Du måste vara inloggad som admin.')));
  }, [params.id]);

  useEffect(() => {
    if (data) setTimeout(() => window.print(), 300);
  }, [data]);

  if (error) return <p className="p-8">{error}</p>;
  if (!data) return <p className="p-8">Laddar…</p>;

  const { kurs } = data;
  const rows = data.participants.filter(p => p.status !== 'Canceled');
  const date = new Date(kurs.startTime).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', ...tz });

  return (
    <div className="min-h-screen bg-white text-black p-8 print:p-0 text-sm">
      <style>{'@page { size: A4; margin: 15mm; }'}</style>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{kurs.title}</h1>
          <p className="mt-1 first-letter:uppercase">{date} · {hm(kurs.startTime)}–{hm(kurs.endTime)}</p>
          <p>{kurs.location} · {kurs.filial.name}</p>
          {kurs.instructors.length > 0 && <p>Lärare: {kurs.instructors.map(i => i.name).join(', ')}</p>}
        </div>
        <button onClick={() => window.print()} className="print:hidden px-4 py-2 rounded-lg bg-black text-white font-semibold">Skriv ut / spara PDF</button>
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-2 w-8">#</th>
            <th className="py-2 pr-2">Namn</th>
            <th className="py-2 pr-2">Personnummer</th>
            <th className="py-2 pr-2">Telefon</th>
            <th className="py-2 pr-2">Betalning</th>
            <th className="py-2 pr-2">Legitimation</th>
            <th className="py-2 w-40">Signatur</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.bookingId} className="border-b border-gray-300 align-top">
              <td className="py-3 pr-2">{i + 1}</td>
              <td className="py-3 pr-2 font-semibold">{p.name}</td>
              <td className="py-3 pr-2 font-mono">{p.personnummer}</td>
              <td className="py-3 pr-2">{p.phone}</td>
              <td className="py-3 pr-2">{p.schoolName ? `Skola (${p.schoolName})` : p.paid ? 'Betald' : 'EJ BETALD'}</td>
              <td className="py-3 pr-2">☐ Körkort ☐ Pass ☐ Id-kort</td>
              <td className="py-3" />
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="mt-4">Inga anmälda deltagare.</p>}
      <p className="mt-6 text-xs text-gray-500">Utskriven {new Date().toLocaleString('sv-SE', tz)} · Innehåller personnummer – förvara säkert och förstör efter användning.</p>
    </div>
  );
}
