'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, X, Save, Trash2 } from 'lucide-react';
import clsx from 'clsx';

interface InfoCard {
  id: number;
  title: string;
  description: string;
  price: string;
  imageKeyword: string;
  buttonText: string;
  buttonLink: string;
  sortOrder: number;
  visible: boolean;
}

interface Props {
  initialCards: InfoCard[];
  isAdmin: boolean;
}

const emptyForm = {
  title: '',
  description: '',
  price: '',
  imageKeyword: 'driving',
  buttonText: 'Läs mer',
  buttonLink: '/courses',
  sortOrder: 0,
  visible: true,
};

export default function HomeCardsSection({ initialCards, isAdmin }: Props) {
  const [cards, setCards] = useState<InfoCard[]>(initialCards);
  const [editCard, setEditCard] = useState<InfoCard | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openEdit = (card: InfoCard) => {
    setEditCard(card);
    setForm({
      title: card.title,
      description: card.description,
      price: card.price,
      imageKeyword: card.imageKeyword,
      buttonText: card.buttonText,
      buttonLink: card.buttonLink,
      sortOrder: card.sortOrder,
      visible: card.visible,
    });
    setShowAdd(false);
  };

  const openAdd = () => {
    setEditCard(null);
    setForm(emptyForm);
    setShowAdd(true);
  };

  const closeModal = () => {
    setEditCard(null);
    setShowAdd(false);
  };

  const handleSave = async () => {
    if (!form.title || !form.description) return;
    setSaving(true);

    if (editCard) {
      const res = await fetch(`/api/admin/info-cards/${editCard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const { card } = await res.json();
        setCards((prev) => prev.map((c) => c.id === card.id ? card : c));
        setEditCard(null);
      }
    } else {
      const res = await fetch('/api/admin/info-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const { card } = await res.json();
        setCards((prev) => [...prev, card]);
        setShowAdd(false);
        setForm(emptyForm);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ta bort detta kort?')) return;
    await fetch(`/api/admin/info-cards/${id}`, { method: 'DELETE' });
    setCards((prev) => prev.filter((c) => c.id !== id));
    setEditCard(null);
  };

  const visibleCards = isAdmin ? cards : cards.filter((c) => c.visible);
  if (!isAdmin && visibleCards.length === 0) return null;

  return (
    <section className="py-16" style={{ background: '#fefcf5' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div className="text-center flex-1">
            <h2 className="section-title">Våra utbildningar</h2>
            <p className="section-subtitle">Lagstadgade kurser för körkort</p>
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-swedish-blue text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition shrink-0 ml-4"
            >
              <Plus className="w-4 h-4" />
              Lägg till kort
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {visibleCards.map((card) => (
            <div
              key={card.id}
              className={clsx(
                'bg-white rounded-[28px] overflow-hidden shadow-sm hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 relative group',
                !card.visible && isAdmin && 'opacity-60'
              )}
              style={{ border: '1px solid #ece5d8' }}
            >
              {/* Image */}
              <div className="relative overflow-hidden" style={{ height: '210px' }}>
                <img
                  src={`https://picsum.photos/seed/${encodeURIComponent(card.imageKeyword)}/800/400`}
                  alt={card.title}
                  className="w-full h-full object-cover"
                />
                {/* Admin edit overlay on image */}
                {isAdmin && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(card)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-900 text-xs font-semibold rounded-lg hover:bg-blue-50 shadow"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Redigera
                    </button>
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 shadow"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Ta bort
                    </button>
                  </div>
                )}
                {/* Hidden badge for admin */}
                {isAdmin && !card.visible && (
                  <div className="absolute top-2 right-2 bg-gray-800 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    Dold
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="font-bold text-gray-900 mb-2" style={{ fontSize: '1.35rem' }}>{card.title}</h3>
                {card.price && (
                  <p className="font-semibold mb-3" style={{ color: '#c25d1a' }}>Från {card.price}</p>
                )}
                <p className="text-gray-500 text-sm leading-relaxed mb-5">{card.description}</p>
                <Link
                  href={card.buttonLink}
                  className="inline-flex items-center gap-1.5 font-semibold text-sm transition-colors hover:underline"
                  style={{ color: '#c25d1a' }}
                >
                  {card.buttonText} →
                </Link>
              </div>
            </div>
          ))}

          {/* Admin empty state */}
          {isAdmin && cards.length === 0 && (
            <div className="col-span-3 bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
              <p className="text-sm mb-3">Inga kort ännu.</p>
              <button onClick={openAdd} className="text-swedish-blue text-sm font-medium hover:underline">
                + Lägg till ditt första kort
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Edit / Add Modal */}
      {(editCard || showAdd) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">{editCard ? 'Redigera kort' : 'Nytt kort'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Live image preview */}
            {form.imageKeyword && (
              <div className="mb-4 rounded-xl overflow-hidden h-36">
                <img
                  src={`https://picsum.photos/seed/${encodeURIComponent(form.imageKeyword)}/600/300`}
                  alt="Förhandsgranskning"
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Titel *</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Risk 2 – Halkbanekörning"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Beskrivning *</label>
                <textarea
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Praktisk körning på halkbana..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pris</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="2 500 kr"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bildsökord (engelska)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="t.ex. driving, car, winter, road"
                  value={form.imageKeyword}
                  onChange={(e) => setForm({ ...form, imageKeyword: e.target.value })}
                />
                <p className="text-xs text-gray-400 mt-1">Bilden uppdateras automatiskt baserat på sökordet.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Knapptext</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Läs mer"
                    value={form.buttonText}
                    onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Knapp-länk</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="/courses"
                    value={form.buttonLink}
                    onChange={(e) => setForm({ ...form, buttonLink: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sortering</label>
                  <input
                    type="number"
                    className="input-field w-24"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Synlig</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, visible: !form.visible })}
                    className={clsx(
                      'relative inline-flex h-6 w-11 rounded-full transition-colors',
                      form.visible ? 'bg-swedish-blue' : 'bg-gray-300'
                    )}
                  >
                    <span className={clsx(
                      'inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-1',
                      form.visible ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              {editCard && (
                <button
                  onClick={() => handleDelete(editCard.id)}
                  className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-sm font-medium"
                >
                  Ta bort
                </button>
              )}
              <button onClick={closeModal} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50 text-sm">
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title || !form.description}
                className="flex-1 bg-swedish-blue text-white py-2.5 rounded-xl hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Sparar...' : editCard ? 'Spara ändringar' : 'Skapa kort'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
