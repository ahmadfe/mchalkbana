'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Pencil, Plus, X, Save, Trash2, ImagePlus, Video, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

interface InfoCard {
  id: number;
  badge: string;
  title: string;
  description: string;
  price: string;
  imageUrl: string;
  videoUrl: string;
  primaryButtonText: string;
  primaryButtonLink: string;
  secondaryButtonText: string;
  secondaryButtonLink: string;
  sortOrder: number;
  visible: boolean;
}

interface Props {
  initialCards: InfoCard[];
  isAdmin: boolean;
}

const emptyForm = {
  badge: '',
  title: '',
  description: '',
  price: '',
  imageUrl: '',
  videoUrl: '',
  primaryButtonText: 'Läs mer',
  primaryButtonLink: '/courses',
  secondaryButtonText: '',
  secondaryButtonLink: '',
  sortOrder: 0,
  visible: true,
};

export default function HomeCardsSection({ initialCards, isAdmin }: Props) {
  // ── Admin state ───────────────────────────────────────────────────────────
  const [cards, setCards] = useState<InfoCard[]>(initialCards);
  const [editCard, setEditCard] = useState<InfoCard | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Carousel state ────────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [cardMinWidth, setCardMinWidth] = useState('calc(33.33% - 16px)');

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCardMinWidth('calc(33.33% - 16px)');
      else if (w >= 640) setCardMinWidth('calc(50% - 12px)');
      else setCardMinWidth('82%');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const visibleCards = isAdmin ? cards : cards.filter((c) => c.visible);

  // ── Admin handlers ────────────────────────────────────────────────────────
  const openEdit = (card: InfoCard) => { setEditCard(card); setForm({ ...card }); setShowAdd(false); };
  const openAdd = () => { setEditCard(null); setForm(emptyForm); setShowAdd(true); };
  const closeModal = () => { setEditCard(null); setShowAdd(false); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, imageUrl: reader.result as string, videoUrl: '' }));
    reader.readAsDataURL(file);
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
        closeModal();
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
        closeModal();
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

  // ── Carousel helpers ──────────────────────────────────────────────────────
  const scrollTo = useCallback((index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const child = container.children[index] as HTMLElement | undefined;
    if (!child) return;
    const offset = child.getBoundingClientRect().left - container.getBoundingClientRect().left;
    container.scrollBy({ left: offset, behavior: 'smooth' });
  }, []);

  const goTo = useCallback((index: number) => {
    const clamped = ((index % visibleCards.length) + visibleCards.length) % visibleCards.length;
    activeRef.current = clamped;
    setActiveIndex(clamped);
    scrollTo(clamped);
  }, [visibleCards.length, scrollTo]);

  // ── Auto-advance ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isPaused || visibleCards.length <= 1) return;
    const timer = setInterval(() => {
      const next = (activeRef.current + 1) % visibleCards.length;
      activeRef.current = next;
      setActiveIndex(next);
      scrollTo(next);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPaused, visibleCards.length, scrollTo]);

  // ── Sync dot indicator on manual swipe ───────────────────────────────────
  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const children = Array.from(container.children) as HTMLElement[];
    const scrollLeft = container.scrollLeft;
    let closest = 0;
    let minDist = Infinity;
    children.forEach((child, i) => {
      const dist = Math.abs(child.offsetLeft - scrollLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    activeRef.current = closest;
    setActiveIndex(closest);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (!isAdmin && visibleCards.length === 0) return null;

  return (
    <section className="py-16" style={{ background: '#fefcf5' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex-1 text-center">
            <h2 className="section-title">Våra utbildningar</h2>
            <p className="section-subtitle">Lagstadgade kurser för körkort</p>
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 bg-swedish-blue text-white text-sm font-medium rounded-xl hover:bg-swedish-dark transition shrink-0 ml-4"
            >
              <Plus className="w-4 h-4" />
              Lägg till kort
            </button>
          )}
        </div>

        {/* Carousel */}
        <div
          className="relative"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Prev arrow */}
          {visibleCards.length > 1 && (
            <button
              onClick={() => goTo(activeIndex - 1)}
              className="absolute left-0 top-[calc(50%-24px)] -translate-x-5 z-10
                         w-11 h-11 bg-white border border-gray-200 rounded-full shadow-md
                         items-center justify-center hover:bg-gray-50 transition-colors
                         hidden sm:flex"
              aria-label="Föregående"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
          )}

          {/* Scrollable track */}
          <div
            ref={scrollRef}
            className="flex gap-6 overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}
          >
            {visibleCards.map((card) => (
              <div
                key={card.id}
                className={clsx(
                  'flex-shrink-0 bg-white rounded-[28px] overflow-hidden shadow-sm',
                  'group relative flex flex-col hover:-translate-y-1 transition-transform duration-200',
                  !card.visible && isAdmin && 'opacity-60',
                )}
                style={{
                  minWidth: cardMinWidth,
                  border: '1px solid #ece5d8',
                  scrollSnapAlign: 'start',
                }}
              >
                {/* Admin hidden badge */}
                {isAdmin && !card.visible && (
                  <span className="absolute top-3 left-3 z-10 bg-gray-800 text-white text-xs font-medium px-2 py-0.5 rounded-full">Dold</span>
                )}

                {/* Admin controls */}
                {isAdmin && (
                  <div className="absolute top-3 right-3 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => openEdit(card)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-800 text-xs font-semibold rounded-lg shadow hover:bg-brand-50"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Redigera
                    </button>
                    <button
                      onClick={() => handleDelete(card.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg shadow hover:bg-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Ta bort
                    </button>
                  </div>
                )}

                {/* Image / Video */}
                <div className="w-full bg-gray-100 relative overflow-hidden" style={{ height: '220px' }}>
                  {card.videoUrl ? (
                    <video autoPlay muted loop playsInline className="w-full h-full object-cover absolute inset-0">
                      <source src={card.videoUrl} type="video/mp4" />
                    </video>
                  ) : card.imageUrl ? (
                    <img src={card.imageUrl} alt={card.title} className="w-full h-full object-cover absolute inset-0" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                      <ImagePlus className="w-12 h-12" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex flex-col flex-1 p-6">
                  {card.badge && (
                    <span className="text-xs font-semibold text-swedish-blue uppercase tracking-wide mb-2">{card.badge}</span>
                  )}
                  <h3 className="font-bold text-gray-900 text-xl leading-snug mb-2">{card.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-4 flex-1">{card.description}</p>
                  {card.price && <p className="font-bold text-lg mb-3 text-gray-900">{card.price}</p>}
                  <div className="flex flex-wrap gap-2">
                    {card.primaryButtonText && (
                      <Link
                        href={card.primaryButtonLink}
                        className="inline-block bg-swedish-yellow text-gray-900 text-sm font-bold px-4 py-2 rounded-xl hover:bg-yellow-300 transition"
                      >
                        {card.primaryButtonText} →
                      </Link>
                    )}
                    {card.secondaryButtonText && (
                      <Link
                        href={card.secondaryButtonLink}
                        className="text-sm font-semibold text-swedish-blue hover:underline flex items-center gap-1"
                      >
                        {card.secondaryButtonText} →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Next arrow */}
          {visibleCards.length > 1 && (
            <button
              onClick={() => goTo(activeIndex + 1)}
              className="absolute right-0 top-[calc(50%-24px)] translate-x-5 z-10
                         w-11 h-11 bg-white border border-gray-200 rounded-full shadow-md
                         items-center justify-center hover:bg-gray-50 transition-colors
                         hidden sm:flex"
              aria-label="Nästa"
            >
              <ChevronRight className="w-5 h-5 text-gray-700" />
            </button>
          )}
        </div>

        {/* Dot indicators + mobile arrows */}
        {visibleCards.length > 1 && (
          <div className="flex justify-center items-center gap-3 mt-8">
            {/* Mobile prev */}
            <button
              onClick={() => goTo(activeIndex - 1)}
              className="sm:hidden w-9 h-9 bg-white border border-gray-200 rounded-full shadow flex items-center justify-center hover:bg-gray-50 transition"
              aria-label="Föregående"
            >
              <ChevronLeft className="w-4 h-4 text-gray-700" />
            </button>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {visibleCards.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={clsx(
                    'rounded-full transition-all duration-300',
                    i === activeIndex
                      ? 'w-6 h-2 bg-swedish-blue'
                      : 'w-2 h-2 bg-gray-300 hover:bg-gray-400',
                  )}
                  aria-label={`Gå till kort ${i + 1}`}
                />
              ))}
            </div>

            {/* Mobile next */}
            <button
              onClick={() => goTo(activeIndex + 1)}
              className="sm:hidden w-9 h-9 bg-white border border-gray-200 rounded-full shadow flex items-center justify-center hover:bg-gray-50 transition"
              aria-label="Nästa"
            >
              <ChevronRight className="w-4 h-4 text-gray-700" />
            </button>
          </div>
        )}

        {/* Admin empty state */}
        {isAdmin && cards.length === 0 && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-16 text-center text-gray-400">
            <p className="text-sm mb-3">Inga kort ännu.</p>
            <button onClick={openAdd} className="text-swedish-blue text-sm font-medium hover:underline">
              + Lägg till ditt första kort
            </button>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {(editCard || showAdd) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-lg">{editCard ? 'Redigera kort' : 'Nytt kort'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Badge-text <span className="text-gray-400 font-normal">(valfri)</span></label>
                <input type="text" className="input-field" placeholder="t.ex. Sveriges ledande riskutbildning" value={form.badge} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Rubrik *</label>
                <input type="text" className="input-field" placeholder="Riskutbildning för körkort A & B" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Beskrivning *</label>
                <textarea rows={3} className="input-field resize-none" placeholder="Teori och praktik på vår moderna halkbana..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pris <span className="text-gray-400 font-normal">(valfri)</span></label>
                <input type="text" className="input-field" placeholder="2 500 kr" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-gray-700">Knappar</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Primär knapptext</label>
                    <input type="text" className="input-field text-sm" placeholder="Våra kurser" value={form.primaryButtonText} onChange={(e) => setForm({ ...form, primaryButtonText: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Primär länk</label>
                    <input type="text" className="input-field text-sm" placeholder="/courses" value={form.primaryButtonLink} onChange={(e) => setForm({ ...form, primaryButtonLink: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sekundär knapptext <span className="text-gray-400">(valfri)</span></label>
                    <input type="text" className="input-field text-sm" placeholder="Boka riskutbildning" value={form.secondaryButtonText} onChange={(e) => setForm({ ...form, secondaryButtonText: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sekundär länk</label>
                    <input type="text" className="input-field text-sm" placeholder="/courses" value={form.secondaryButtonLink} onChange={(e) => setForm({ ...form, secondaryButtonLink: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                <p className="text-sm font-semibold text-gray-700">Media <span className="text-gray-400 font-normal">(bild eller video)</span></p>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Ladda upp bild</label>
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={clsx(
                      'relative rounded-xl overflow-hidden border-2 border-dashed cursor-pointer transition group',
                      form.imageUrl && !form.videoUrl ? 'border-transparent' : 'border-gray-300 hover:border-swedish-blue bg-white'
                    )}
                    style={{ height: '150px' }}
                  >
                    {form.imageUrl && !form.videoUrl ? (
                      <>
                        <img src={form.imageUrl} alt="Förhandsgranskning" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="text-white text-sm font-semibold flex items-center gap-2"><ImagePlus className="w-4 h-4" />Byt bild</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                        <ImagePlus className="w-7 h-7" />
                        <span className="text-sm">Klicka för att välja bild</span>
                        <span className="text-xs">JPG, PNG, WebP · Max 5 MB</span>
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
                </div>

                <div className="flex items-center gap-3 text-gray-400">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs font-medium">ELLER</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    <Video className="w-3.5 h-3.5 inline mr-1" />
                    Video-URL (MP4)
                  </label>
                  <input
                    type="url"
                    className="input-field text-sm"
                    placeholder="https://example.com/video.mp4"
                    value={form.videoUrl}
                    onChange={(e) => setForm({ ...form, videoUrl: e.target.value, imageUrl: e.target.value ? '' : form.imageUrl })}
                  />
                  <p className="text-xs text-gray-400 mt-1">Om du anger en video-URL används den istället för bilden.</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Sortering</label>
                  <input type="number" className="input-field w-24" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">Synlig</label>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, visible: !form.visible })}
                    className={clsx('relative inline-flex h-6 w-11 rounded-full transition-colors', form.visible ? 'bg-swedish-blue' : 'bg-gray-300')}
                  >
                    <span className={clsx('inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-1', form.visible ? 'translate-x-6' : 'translate-x-1')} />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
              {editCard && (
                <button onClick={() => handleDelete(editCard.id)} className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl hover:bg-red-50 text-sm font-medium">
                  Ta bort
                </button>
              )}
              <button onClick={closeModal} className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl hover:bg-gray-50 text-sm">
                Avbryt
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title || !form.description}
                className="flex-1 bg-swedish-blue text-white py-2.5 rounded-xl hover:bg-swedish-dark text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60 transition"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Sparar...' : editCard ? 'Spara ändringar' : 'Skapa kort'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
