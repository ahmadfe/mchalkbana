'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Pencil, Plus, X, Save, Trash2, ImagePlus, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface InfoCard {
  id: number;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
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
  imageUrl: '',
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
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const openEdit = (card: InfoCard) => {
    setEditCard(card);
    setForm({
      title: card.title,
      description: card.description,
      price: card.price,
      imageUrl: card.imageUrl,
      buttonText: card.buttonText,
      buttonLink: card.buttonLink,
      sortOrder: card.sortOrder,
      visible: card.visible,
    });
    setPreviewUrl(card.imageUrl);
    setShowAdd(false);
  };

  const openAdd = () => {
    setEditCard(null);
    setForm(emptyForm);
    setPreviewUrl('');
    setShowAdd(true);
  };

  const closeModal = () => {
    setEditCard(null);
    setShowAdd(false);
    setPreviewUrl('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);

    const fd = new FormData();
    fd.append('file', file);

    const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);

    if (res.ok) {
      setForm((prev) => ({ ...prev, imageUrl: data.url }));
    } else {
      alert(data.error || 'Uppladdning misslyckades');
      setPreviewUrl(form.imageUrl);
    }
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
        setPreviewUrl('');
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
        setPreviewUrl('');
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Ta bort detta kort?')) return;
    await fetch(`/api/admin/info-cards/${id}`, { method: 'DELETE' });
    setCards((prev) => prev.filter((c) => c.id !== id));
    closeModal();
  };

  const visibleCards = isAdmin ? cards : cards.filter((c) => c.visible);
  if (!isAdmin && visibleCards.length === 0) return null;

  return (
    <section className="py-16" style={{ background: '#fefcf5' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-12">
          <div className="flex-1 text-center">
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
              <div className="relative overflow-hidden bg-gray-100" style={{ height: '210px' }}>
                {card.imageUrl ? (
                  <img
                    src={card.imageUrl}
                    alt={card.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ImagePlus className="w-12 h-12" />
                  </div>
                )}

                {/* Admin edit overlay */}
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

      {/* Add / Edit Modal */}
      {(editCard || showAdd) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">{editCard ? 'Redigera kort' : 'Nytt kort'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Image upload area */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">Bild</label>
              <div
                onClick={() => fileRef.current?.click()}
                className={clsx(
                  'relative rounded-xl overflow-hidden border-2 border-dashed cursor-pointer transition group',
                  previewUrl ? 'border-transparent' : 'border-gray-300 hover:border-swedish-blue bg-gray-50'
                )}
                style={{ height: '180px' }}
              >
                {previewUrl ? (
                  <>
                    <img src={previewUrl} alt="Förhandsgranskning" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-white text-sm font-semibold flex items-center gap-2">
                        <ImagePlus className="w-4 h-4" />
                        Byt bild
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                    {uploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-swedish-blue" />
                    ) : (
                      <>
                        <ImagePlus className="w-8 h-8" />
                        <span className="text-sm font-medium">Klicka för att ladda upp bild</span>
                        <span className="text-xs">JPG, PNG, WebP · Max 5 MB</span>
                      </>
                    )}
                  </div>
                )}
                {uploading && previewUrl && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

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
                disabled={saving || uploading || !form.title || !form.description}
                className="flex-1 bg-swedish-blue text-white py-2.5 rounded-xl hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
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
