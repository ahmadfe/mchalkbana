'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';

/**
 * Elevens anteckning med "Ändra" – delad mellan admin och trafikskolan.
 * onSave returnerar ett felmeddelande, eller null när det gick bra.
 */
export default function NoteEdit({ note, onSave, suffix }: { note: string | null; onSave: (text: string) => Promise<string | null>; suffix?: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const error = await onSave(text);
    setBusy(false);
    if (error) { alert(error); return; }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus
          maxLength={500}
          rows={2}
          placeholder="T.ex. behöver tolk, kommer lite sent, referens för fakturan"
          aria-label="Anteckning"
          className="w-full px-3 py-2 rounded-xl bg-[#26262a] border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/40"
        />
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="h-9 px-4 rounded-full bg-white text-black text-sm font-semibold disabled:opacity-50">{busy ? 'Sparar…' : 'Spara'}</button>
          <button onClick={() => { setText(note ?? ''); setEditing(false); }} disabled={busy} className="h-9 px-4 rounded-full bg-white/10 text-sm font-semibold">Avbryt</button>
        </div>
      </div>
    );
  }

  return note ? (
    <button onClick={() => { setText(note); setEditing(true); }} title="Ändra anteckning" className="group mt-2 w-full text-left text-xs sm:text-sm text-amber-200/90 bg-amber-500/10 hover:bg-amber-500/15 rounded-lg px-2.5 py-1.5 whitespace-pre-wrap flex items-start gap-2">
      <span className="flex-1">📝 {note}{suffix}</span>
      <Pencil className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50 group-hover:opacity-100" />
    </button>
  ) : (
    <button onClick={() => { setText(''); setEditing(true); }} className="mt-1.5 inline-flex items-center gap-1 text-xs text-white/40 hover:text-white">
      <Pencil className="w-3 h-3" /> Anteckning
    </button>
  );
}
